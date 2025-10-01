const cells = document.querySelectorAll('.cell');
const statusDisplay = document.getElementById('player-turn');
const countInfoDisplay = document.getElementById('count-info');
const gamepadStatusDisplay = document.getElementById('gamepad-status');
const resetButton = document.getElementById('reset-button');

// ゲームの状態
let board = Array(9).fill(null);
let currentPlayer = 'O'; // 'O' (青/Player 1) or 'X' (赤/Player 2)
let isGameActive = true;
const maxMarks = 3;
let marksCount = { 'O': 0, 'X': 0 };
// placedMarks: { index: number, player: string } のみを保持
let placedMarks = [];

// コントローラー関連
const gamepads = {};
let cursorIndex = 4; // 初期カーソル位置
let lastStickPos = { x: 0, y: 0 };
const stickThreshold = 0.5; // スティック感度
const stickDelay = 200; // カーソル移動の最短間隔 (ms)
let lastMoveTime = 0;

// Gamepad APIイベントリスナー
window.addEventListener("gamepadconnected", (e) => {
    gamepads[e.gamepad.index] = e.gamepad;
    gamepadStatusDisplay.textContent = `ゲームパッド ${e.gamepad.index + 1} が接続されました: ${e.gamepad.id}`;
    updateCursor(cursorIndex);
    if (!Object.keys(gamepads).some(i => gamepads[i].__loopStarted)) {
        gameLoop();
        gamepads[e.gamepad.index].__loopStarted = true;
    }
});

window.addEventListener("gamepaddisconnected", (e) => {
    delete gamepads[e.gamepad.index];
    const connectedCount = navigator.getGamepads().filter(g => g).length;
    gamepadStatusDisplay.textContent = connectedCount > 0
        ? `${connectedCount}つのゲームパッドが接続されています`
        : "ゲームパッドを接続してください...";
});

// ゲームループ（コントローラーの状態監視用）
function gameLoop() {
    if (!isGameActive) return;

    const currentGamepads = navigator.getGamepads();

    // プレイヤー1 (O) の操作 (Gamepad index 0)
    const gp1 = currentGamepads[0];
    if (gp1) {
        // O のカーソル移動を許可（AボタンはhandleGamepadInput内でターンチェック）
        handleGamepadInput(gp1, 0);
    }

    // プレイヤー2 (X) の操作 (Gamepad index 1)
    const gp2 = currentGamepads[1];
    if (gp2 && currentGamepads.length > 1) {
        // X のカーソル移動を許可（AボタンはhandleGamepadInput内でターンチェック）
        handleGamepadInput(gp2, 1);
    }

    requestAnimationFrame(gameLoop);
}

// コントローラー入力の処理 (変更なし)
function handleGamepadInput(gp, playerIndex) {
    if (!isGameActive) return;

    const currentTime = Date.now();

    const playerMark = playerIndex === 0 ? 'O' : 'X';

    // 修正: 現在のプレイヤーのターンではない場合、Aボタン確定もカーソル移動もすべてブロック
    if (playerMark !== currentPlayer) {
        // ただし、ブロックする前に、ボタンの押しっぱなし状態だけはリセットしておく
        // これがないと、ターンが回ってきた瞬間に意図せず確定処理が走る可能性がある
        if (gp.buttons[0].pressed) {
            gp.__button0Pressed = true;
        } else {
            gp.__button0Pressed = false;
        }
        return; // ★ ターンが一致しない場合はここで処理を終了
    }

    // 以下の処理は、playerMark === currentPlayer の場合のみ実行される

    // Aボタン (buttons[0]) で確定
    if (gp.buttons[0].pressed && !gp.__button0Pressed) {
        handleCellClick(cursorIndex);
        gp.__button0Pressed = true;
    } else if (!gp.buttons[0].pressed) {
        gp.__button0Pressed = false;
    }

    // カーソル移動の処理
    if (currentTime - lastMoveTime > stickDelay) {
        let newIndex = cursorIndex;
        let moved = false;

        // ... (以下、カーソル移動ロジックは変更なし) ...

        // **左スティック (axes[0]: x, axes[1]: y)**
        const lx = gp.axes[0];
        const ly = gp.axes[1];

        // **十字キー (D-Pad)**: 標準マッピングではbuttons[12]:Up, [13]:Down, [14]:Left, [15]:Right
        const dpadUp = gp.buttons[12] && gp.buttons[12].pressed;
        const dpadDown = gp.buttons[13] && gp.buttons[13].pressed;
        const dpadLeft = gp.buttons[14] && gp.buttons[14].pressed;
        const dpadRight = gp.buttons[15] && gp.buttons[15].pressed;

        let moveX = 0;
        let moveY = 0;

        if (lx > stickThreshold || dpadRight) moveX = 1;
        else if (lx < -stickThreshold || dpadLeft) moveX = -1;

        if (ly > stickThreshold || dpadDown) moveY = 1;
        else if (ly < -stickThreshold || dpadUp) moveY = -1;

        lastStickPos.x = lx;
        lastStickPos.y = ly;

        if (moveX !== 0 || moveY !== 0) {
            newIndex += moveX;
            newIndex += moveY * 3;

            // 境界チェックロジック (簡略化)
            const currentRow = Math.floor(cursorIndex / 3);
            const newRow = Math.floor(newIndex / 3);
            const currentColumn = cursorIndex % 3;
            const newColumn = newIndex % 3;

            if (Math.abs(currentRow - newRow) > 1 || Math.abs(currentColumn - newColumn) > 1) {
                newIndex = cursorIndex;
                if (moveX === 1 && currentColumn < 2) newIndex++;
                if (moveX === -1 && currentColumn > 0) newIndex--;
                if (moveY === 1 && currentRow < 2) newIndex += 3;
                if (moveY === -1 && currentRow > 0) newIndex -= 3;
            }

            if (newIndex >= 0 && newIndex <= 8 && newIndex !== cursorIndex) {
                updateCursor(newIndex);
                lastMoveTime = currentTime;
            }
        }
    }
}

// カーソル位置の更新 (変更なし)
function updateCursor(newIndex) {
    if (cells[cursorIndex]) {
        cells[cursorIndex].classList.remove('selected');
    }
    cursorIndex = newIndex;
    if (cells[cursorIndex]) {
        cells[cursorIndex].classList.add('selected');
    }
}


/**
 * 次に消えるマーク（最も古いマーク）に視覚的な強調を適用/解除する
 * @param {string} player - 対象プレイヤー ('O' or 'X')
 */
function updateFadingMark(player) {
    // 全てのセルからfading-outクラスを一度解除
    cells.forEach(cell => cell.classList.remove('fading-out'));

    // 既に3つマークがある場合、最も古いマークを特定して強調
    if (marksCount[player] >= maxMarks) {
        // placedMarksから現在のプレイヤーのマークのみを抽出
        const playerMarks = placedMarks.filter(mark => mark.player === player);

        // playerMarksは配置順に並んでいるため、0番目が最も古いマーク
        const oldestMark = playerMarks[0];

        if (oldestMark) {
            cells[oldestMark.index].classList.add('fading-out');
        }
    }
}

// セルクリック（確定）時の処理
function handleCellClick(index) {
    if (!isGameActive || board[index] !== null) {
        return;
    }

    // 1. マークの制限チェックと古いマークの削除
    if (marksCount[currentPlayer] >= maxMarks) {
        // プレイヤーの最も古いマークを探し、削除
        const oldestMarkIndex = placedMarks.findIndex(mark => mark.player === currentPlayer);
        if (oldestMarkIndex !== -1) {
            const oldestMark = placedMarks.splice(oldestMarkIndex, 1)[0]; // 削除
            board[oldestMark.index] = null;
            cells[oldestMark.index].classList.remove(oldestMark.player);
            cells[oldestMark.index].removeAttribute('data-step');
            cells[oldestMark.index].classList.remove('fading-out'); // 強調も解除
            marksCount[oldestMark.player]--;
        }
    }

    // 2. 新しいマークの配置と記録
    board[index] = currentPlayer;
    marksCount[currentPlayer]++;

    cells[index].classList.add(currentPlayer);
    // 新しいマークを placedMarks の末尾に追加
    placedMarks.push({ index: index, player: currentPlayer });

    // 3. 視覚要素の更新 (data-step="1"～"3")
    updateMarkVisuals(); // ★ 全てのマークのステップを正しく更新

    // 4. 勝利判定 (ターン切り替えの前に移動)
    if (checkWinner()) {
        statusDisplay.textContent = `${currentPlayer === 'O' ? '青の〇' : '赤の✕'} の勝利！`;
        statusDisplay.classList.remove('player1', 'player2');
        statusDisplay.classList.add(currentPlayer === 'O' ? 'player1' : 'player2');
        isGameActive = false;
        cells[cursorIndex].classList.remove('selected');
        cells.forEach(cell => cell.classList.remove('fading-out'));
        return;
    }

    // 5. ターン切り替え
    currentPlayer = currentPlayer === 'O' ? 'X' : 'O';
    updateStatus();

    // ターン切り替え後、次のプレイヤーの次に消えるマークを強調
    updateFadingMark(currentPlayer);
}


// ステップ（data-step）を更新し、最も古いマークの強調も管理するヘルパー関数
function updateMarkVisuals() {
    // 1. data-step (opacity & 数字) の更新

    // 全てのセルから古い data-step を削除
    cells.forEach(cell => cell.removeAttribute('data-step'));

    // O（Player 1）のマークを配置順にフィルタリング
    const playerOMarks = placedMarks.filter(mark => mark.player === 'O');
    playerOMarks.forEach((mark, i) => {
        const step = i + 1; // i=0, 1, 2 => step=1, 2, 3
        cells[mark.index].setAttribute('data-step', step);
    });

    // X（Player 2）のマークを配置順にフィルタリング
    const playerXMarks = placedMarks.filter(mark => mark.player === 'X');
    playerXMarks.forEach((mark, i) => {
        const step = i + 1; // i=0, 1, 2 => step=1, 2, 3
        cells[mark.index].setAttribute('data-step', step);
    });

    // 2. 次に消えるマークの強調更新（handleCellClick内でターン切り替え後に行うため、ここでは省略可能）
    // 念のため、両プレイヤーの強調をリセットし、現在のプレイヤーのマークを置いた直後の強調状態を維持
    updateFadingMark(currentPlayer);
}

// 勝利判定ロジック (変更なし)
const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // 横
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // 縦
    [0, 4, 8], [2, 4, 6]             // 斜め
];

function checkWinner() {
    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return true;
        }
    }
    return false;
}

// 状態表示の更新 (変更なし)
function updateStatus() {
    statusDisplay.textContent = `${currentPlayer === 'O' ? '青の〇' : '赤の✕'} の番です`;
    statusDisplay.classList.remove('player1', 'player2');
    statusDisplay.classList.add(currentPlayer === 'O' ? 'player1' : 'player2');
    countInfoDisplay.textContent = `〇: ${marksCount['O']} / ${maxMarks} | ✕: ${marksCount['X']} / ${maxMarks}`;
}

// ゲームのリセット
function resetGame() {
    board.fill(null);
    cells.forEach(cell => {
        cell.classList.remove('O', 'X', 'selected', 'fading-out'); // fading-outもリセット
        cell.removeAttribute('data-step');
    });
    currentPlayer = 'O';
    isGameActive = true;
    marksCount = { 'O': 0, 'X': 0 };
    placedMarks = [];
    cursorIndex = 4;
    updateCursor(cursorIndex);
    updateStatus();

    // リセット時、fading-outはなし

    if (navigator.getGamepads().filter(g => g).length > 0) {
        gameLoop();
    }
}

// 初期化
resetButton.addEventListener('click', resetGame);
updateStatus();
updateCursor(cursorIndex);
// ゲーム開始時、どちらのプレイヤーもマークが0個なのでfading-outは適用されない