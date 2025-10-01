const box = document.getElementById('box');
const arrow = document.getElementById('arrow');
const BOX_SIZE = 50; // ボックスのサイズ (CSSと合わせる)

const LAUNCH_MULTIPLIER = 0.8; // 引っ張った距離に対する発射力の倍率
const FRICTION = 0.99;        // 減速係数

let isDragging = false;
let startX, startY;     // マウス押下時の画面座標
let launchCenterInitialX, launchCenterInitialY; // 発射の起点となるボックスの中心座標
let boxCurrentX, boxCurrentY; // マウス押下時のボックスの左上隅の座標

let velocityX = 0;
let velocityY = 0;
// 💡 変更: requestAnimationFrameのIDではなく、setIntervalのIDを使用
let intervalId = null; 

// =======================================================
// カウンター関連
// =======================================================
let reboundCount = 0; // 跳ね返り回数を保持する変数
const reboundCounterElement = document.getElementById('rebound-counter'); // HTML要素を取得

function updateReboundCountDisplay() {
    reboundCounterElement.textContent = reboundCount;
}

// 💡 変更点 A: 初期化データ
// =======================================================
const NUM_OF_BLUE_BALLS = 10; // 生成されるボールの個数


// ボールの初期位置をランダムに生成する関数 (変更なし)
function generateRandomPositions(count, boxSize) {
    const positions = [];
    const minDistanceSq = (boxSize * 1.5) ** 2; 
    const radius = boxSize / 2;
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;
    
    const redBoxCenter = {
        x: containerWidth / 2,
        y: containerHeight / 2
    };

    let attempts = 0;
    while (positions.length < count && attempts < count * 1000) {
        attempts++;

        const x = radius + Math.random() * (containerWidth - boxSize);
        const y = radius + Math.random() * (containerHeight - boxSize);
        const newPos = { x, y };

        let isValid = true;

        // 1. 赤ボックスとの衝突判定
        const dxRed = newPos.x - redBoxCenter.x;
        const dyRed = newPos.y - redBoxCenter.y;
        if (dxRed * dxRed + dyRed * dyRed < minDistanceSq) {
            isValid = false;
        }

        // 2. 既存の青いボールとの衝突判定
        if (isValid) {
            for (const existingPos of positions) {
                const dx = newPos.x - existingPos.x;
                const dy = newPos.y - existingPos.y;
                if (dx * dx + dy * dy < minDistanceSq) {
                    isValid = false;
                    break;
                }
            }
        }

        if (isValid) {
            positions.push(newPos);
        }
    }
    
    return positions.map(p => [p.x, p.y]);
}

const BLUE_BALL_INITIAL_POSITIONS = generateRandomPositions(NUM_OF_BLUE_BALLS, BOX_SIZE);


// ボックスの中心座標を取得 (変更なし)
function getBoxCenter() {
    const x = parseFloat(box.style.left) || 0;
    const y = parseFloat(box.style.top) || 0;
    return {
        x: x + BOX_SIZE / 2,
        y: y + BOX_SIZE / 2
    };
}

// ボックスの位置を左上隅の座標で設定 (変更なし)
function setBoxPosition(x, y) {
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
}


// =======================================================
// 複数の青いボールを管理するためのクラス (変更なし)
// =======================================================
class Ball {
    constructor(initialX, initialY, index) { 
        this.element = document.createElement('div');
        this.element.className = 'blue-ball';
        this.element.id = `ball-${index}`;
        document.body.appendChild(this.element);
        
        this.center = { x: initialX, y: initialY };
        this.radius = BOX_SIZE / 2;
        this.velocity = { x: 0, y: 0 };
    }

    get velocityX() { return this.velocity.x; }
    set velocityX(v) { this.velocity.x = v; }
    get velocityY() { return this.velocity.y; }
    set velocityY(v) { this.velocity.y = v; }

    setPosition(centerX, centerY) {
        this.center.x = centerX;
        this.center.y = centerY;
        this.element.style.left = `${centerX - this.radius}px`;
        this.element.style.top = `${centerY - this.radius}px`;
    }
    
    // 画面端の衝突時にカウント
    checkWallCollision(containerWidth, containerHeight) {
        let newCenterX = this.center.x + this.velocity.x;
        let newCenterY = this.center.y + this.velocity.y;
        let rebounded = false;

        // X軸の衝突
        if (newCenterX - this.radius < 0) {
            newCenterX = this.radius;
            this.velocity.x *= -1;
            rebounded = true;
        } else if (newCenterX + this.radius > containerWidth) {
            newCenterX = containerWidth - this.radius;
            this.velocity.x *= -1;
            rebounded = true;
        }

        // Y軸の衝突
        if (newCenterY - this.radius < 0) {
            newCenterY = this.radius;
            this.velocity.y *= -1;
            rebounded = true;
        } else if (newCenterY + this.radius > containerHeight) {
            newCenterY = containerHeight - this.radius;
            this.velocity.y *= -1;
            rebounded = true;
        }
        
        if (rebounded) {
            reboundCount++;
            updateReboundCountDisplay();
        }
        
        this.center.x = newCenterX;
        this.center.y = newCenterY;
        this.setPosition(newCenterX, newCenterY);
    }

    applyFriction() {
        this.velocity.x *= FRICTION;
        this.velocity.y *= FRICTION;
    }
}


// 赤いボックスを衝突判定ロジックで使用するためのオブジェクト
const redBall = {
    element: box,
    get center() { return getBoxCenter(); },
    radius: BOX_SIZE / 2,
    get velocityX() { return velocityX; },
    set velocityX(v) { velocityX = v; },
    get velocityY() { return velocityY; },
    set velocityY(v) { velocityY = v; },
    
    setPosition: function(centerX, centerY) {
        setBoxPosition(centerX - this.radius, centerY - this.radius);
    },
    
    // 赤ボックス専用の壁衝突処理でカウント
    checkWallCollision: function(containerWidth, containerHeight) {
        const center = getBoxCenter();
        const radius = BOX_SIZE / 2;
        let rebounded = false;

        let newCenterX = center.x + velocityX;
        let newCenterY = center.y + velocityY;

        // X軸の衝突
        if (newCenterX - radius < 0) {
            newCenterX = radius;
            velocityX *= -1;
            rebounded = true;
        } else if (newCenterX + radius > containerWidth) {
            newCenterX = containerWidth - radius;
            velocityX *= -1;
            rebounded = true;
        }

        // Y軸の衝突
        if (newCenterY - radius < 0) {
            newCenterY = radius;
            velocityY *= -1;
            rebounded = true;
        } else if (newCenterY + radius > containerHeight) {
            newCenterY = containerHeight - radius;
            velocityY *= -1;
            rebounded = true;
        }
        
        if (rebounded) {
            reboundCount++;
            updateReboundCountDisplay();
        }

        this.setPosition(newCenterX, newCenterY);
    }
};

const blueBalls = [];
BLUE_BALL_INITIAL_POSITIONS.forEach((pos, index) => {
    const newBall = new Ball(pos[0], pos[1], index);
    blueBalls.push(newBall);
    newBall.setPosition(pos[0], pos[1]);
});

const allBalls = [redBall, ...blueBalls]; 

// 初期位置を設定 (画面中央)
redBall.setPosition(window.innerWidth / 2, window.innerHeight / 2);


// =======================================================
// 衝突判定と反発処理の関数 (変更なし)
// =======================================================
function checkCollisionAndRespond(ballA, ballB) {
    const dx = ballB.center.x - ballA.center.x;
    const dy = ballB.center.y - ballA.center.y;
    const distanceSq = dx * dx + dy * dy;
    const sumOfRadii = ballA.radius + ballB.radius;
    const sumOfRadiiSq = sumOfRadii * sumOfRadii;

    if (distanceSq < sumOfRadiiSq) {
        reboundCount++;
        updateReboundCountDisplay();
        
        const distance = Math.sqrt(distanceSq);
        const overlap = sumOfRadii - distance;
        const normalX = dx / distance;
        const normalY = dy / distance;
        
        const correctionX = normalX * overlap * 0.5;
        const correctionY = normalY * overlap * 0.5;

        ballA.setPosition(ballA.center.x - correctionX, ballA.center.y - correctionY);
        ballB.setPosition(ballB.center.x + correctionX, ballB.center.y + correctionY);

        const vA_normal = ballA.velocityX * normalX + ballA.velocityY * normalY;
        const vA_tangent = ballA.velocityX * (-normalY) + ballA.velocityY * normalX;
        const vB_normal = ballB.velocityX * normalX + ballB.velocityY * normalY;
        const vB_tangent = ballB.velocityX * (-normalY) + ballB.velocityY * normalX;

        const vA_normal_final = vB_normal;
        const vB_normal_final = vA_normal;

        const vA_normal_vecX = vA_normal_final * normalX;
        const vA_normal_vecY = vA_normal_final * normalY;
        const vB_normal_vecX = vB_normal_final * normalX;
        const vB_normal_vecY = vB_normal_final * normalY;

        const vA_tangent_vecX = vA_tangent * (-normalY);
        const vA_tangent_vecY = vA_tangent * normalX;
        const vB_tangent_vecX = vB_tangent * (-normalY);
        const vB_tangent_vecY = vB_tangent * normalX;

        ballA.velocityX = vA_normal_vecX + vA_tangent_vecX;
        ballA.velocityY = vA_normal_vecY + vA_tangent_vecY;
        ballB.velocityX = vB_normal_vecX + vB_tangent_vecX;
        ballB.velocityY = vB_normal_vecY + vB_tangent_vecY;
    }
}


// ========== イベントハンドラ ==========

// 1. マウス/タッチ開始時
function handleMouseDown(e) {
    // 💡 変更: intervalIdでチェック
    if (intervalId !== null) return; 

    isDragging = true;
    box.style.cursor = 'grabbing';
    
    reboundCount = 0;
    updateReboundCountDisplay();
    
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;

    startX = clientX;
    startY = clientY;
    
    const center = getBoxCenter();
    launchCenterInitialX = center.x;
    launchCenterInitialY = center.y;
    boxCurrentX = parseFloat(box.style.left);
    boxCurrentY = parseFloat(box.style.top);

    arrow.style.display = 'block';

    if (e.cancelable) e.preventDefault();
}

// 2. マウス/タッチ移動時 (変更なし)
function handleMouseMove(e) {
    if (!isDragging) return;

    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    const newBoxX = boxCurrentX + deltaX;
    const newBoxY = boxCurrentY + deltaY;
    setBoxPosition(newBoxX, newBoxY);

    const arrowVectorX = launchCenterInitialX - (newBoxX + BOX_SIZE / 2);
    const arrowVectorY = launchCenterInitialY - (newBoxY + BOX_SIZE / 2);
    const distance = Math.sqrt(arrowVectorX * arrowVectorX + arrowVectorY * arrowVectorY);
    const angle = Math.atan2(arrowVectorY, arrowVectorX);

    arrow.style.left = `${launchCenterInitialX}px`;
    arrow.style.top = `${launchCenterInitialY}px`;
    
    arrow.style.width = `${distance}px`;
    arrow.style.transform = `rotate(${angle}rad)`;
    
    if (e.cancelable) e.preventDefault();
}

// 3. マウス/タッチ終了時 (発射)
function handleLaunch(e) {
    if (!isDragging) return;

    isDragging = false;
    box.style.cursor = 'grab';
    arrow.style.display = 'none';

    const clientX = e.clientX || (e.changedTouches ? e.changedTouches[0].clientX : startX);
    const clientY = e.clientY || (e.changedTouches ? e.changedTouches[0].clientY : startY);
    
    const dragDeltaX = clientX - startX;
    const dragDeltaY = clientY - startY;

    velocityX = -dragDeltaX * LAUNCH_MULTIPLIER;
    velocityY = -dragDeltaY * LAUNCH_MULTIPLIER;

    const center = getBoxCenter();
    setBoxPosition(launchCenterInitialX - BOX_SIZE/2, launchCenterInitialY - BOX_SIZE/2);
    
    // 💡 変更: setIntervalでループを開始
    if (intervalId === null) {
        // 16msごとにanimateを呼び出し（約60FPS相当）
        intervalId = setInterval(animate, 16);
    }

    if (e.cancelable) e.preventDefault();
}

// ========== アニメーションループ ==========

function animate() {
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;

    // 1. 赤ボックスの位置と速度を更新
    velocityX *= FRICTION;
    velocityY *= FRICTION;
    redBall.checkWallCollision(containerWidth, containerHeight);


    // 2. 青いボールの位置と速度を更新
    blueBalls.forEach(ball => {
        ball.center.x += ball.velocity.x;
        ball.center.y += ball.velocity.y;
        
        ball.applyFriction();

        ball.checkWallCollision(containerWidth, containerHeight);
    });

    // 3. ボール同士の衝突判定と反発
    for (let i = 0; i < allBalls.length; i++) {
        for (let j = i + 1; j < allBalls.length; j++) {
            checkCollisionAndRespond(allBalls[i], allBalls[j]);
        }
    }

    // 4. 停止判定 (変更あり)
    const isRedBallStopped = Math.abs(velocityX) < 0.1 && Math.abs(velocityY) < 0.1;
    const isBlueBallsStopped = blueBalls.every(ball => Math.abs(ball.velocity.x) < 0.1 && Math.abs(ball.velocity.y) < 0.1);
    
    if (isRedBallStopped && isBlueBallsStopped) {
        // 💡 変更: clearIntervalでループを停止
        clearInterval(intervalId);
        intervalId = null;
        velocityX = 0;
        velocityY = 0;
        box.style.cursor = 'grab';
        return;
    }
    // 💡 削除: requestAnimationFrame(animate) は不要
}

// ========== イベントリスナーの登録 (変更なし) ==========

box.addEventListener('mousedown', handleMouseDown);
document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('mouseup', handleLaunch);

box.addEventListener('touchstart', handleMouseDown);
document.addEventListener('touchmove', handleMouseMove);
document.addEventListener('touchend', handleLaunch);