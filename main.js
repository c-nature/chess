let stockfishWorker = new Worker('/lib/stockfish-nnue-16.js');

const boardElement = document.getElementById('myBoard');
const resetButton = document.getElementById('resetButton');
const fenDisplay = document.getElementById('fen-display');
const statusMessage = document.getElementById('status-message');
const evaluationBar = document.querySelector('#evalBar .blackBar');
const evaluationScore = document.getElementById('evalNum');
const gameOverModal = document.getElementById('game-over-modal');
const modalMessage = document.getElementById('modal-message');

let game = new Chess();
let board = null;
let aiTurn = false;

resetButton.addEventListener('click', resetGame);
window.onload = function() {
    initGame();
};

function initGame() {
    const config = {
        draggable: true,
        position: 'start',
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
    };
    try {
        board = Chessboard('myBoard', config);
        updateStatus();
        stockfishWorker.postMessage('uci');
        stockfishWorker.postMessage('isready');
        setTimeout(() => {
            stockfishWorker.postMessage('ucinewgame');
        }, 500);
    } catch (error) {
        console.error('Chessboard initialization error:', error);
    }
}

function resetGame() {
    game = new Chess();
    board.start();
    aiTurn = false;
    updateStatus();
    stockfishWorker.postMessage('ucinewgame');
}

function onDrop(source, target) {
    if (game.get(source).type === 'p' && (target[1] === '8' || target[1] === '1')) {
        showPromotionOverlay(source, target);
        return;
    }
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    checkGameOver();
    updateStatus();
    if (!game.game_over()) {
        aiTurn = true;
        setTimeout(makeAiMove, 500);
    }
}

function showPromotionOverlay(source, target) {
    const overlay = document.getElementById('promotion-overlay');
    const choices = document.querySelector('.promotion-choices');
    choices.innerHTML = '';
    const pieces = ['q', 'r', 'b', 'n'];
    pieces.forEach(piece => {
        const div = document.createElement('div');
        div.className = 'promotion-choice';
        div.innerHTML = `<img src="/images/${game.turn() === 'w' ? 'White' : 'Black'}-${piece.toUpperCase()}.png" alt="${piece}">`;
        div.onclick = () => {
            game.move({ from: source, to: target, promotion: piece });
            board.position(game.fen());
            overlay.classList.remove('active');
            updateStatus();
            if (!game.game_over()) {
                aiTurn = true;
                setTimeout(makeAiMove, 500);
            }
        };
        choices.appendChild(div);
    });
    overlay.classList.add('active');
}

function onSnapEnd() {
    board.position(game.fen());
}

function makeAiMove() {
    if (aiTurn) {
        statusMessage.textContent = 'Stockfish is thinking...';
        stockfishWorker.postMessage(`position fen ${game.fen()}`);
        stockfishWorker.postMessage('go movetime 2000');
    }
}

stockfishWorker.onmessage = function(event) {
    console.log('Stockfish message:', event.data);
    const message = event.data;
    if (message === 'readyok') {
        console.log('Stockfish is ready');
    }
    if (message.startsWith('bestmove')) {
        const bestMove = message.split(' ')[1];
        if (bestMove && bestMove !== '(none)') {
            game.move(bestMove, { sloppy: true });
            board.position(game.fen());
            aiTurn = false;
            checkGameOver();
            updateStatus();
        }
    } else if (message.startsWith('info score cp')) {
        const score = parseInt(message.split(' ')[2], 10) / 100;
        updateEvaluationBar(score);
    }
};

stockfishWorker.onerror = function(error) {
    console.error('Stockfish error:', error);
};

function updateStatus() {
    const moveColor = game.turn() === 'w' ? 'White' : 'Black';
    fenDisplay.textContent = `FEN: ${game.fen()}`;
    let status = '';
    if (game.game_over()) {
        if (game.in_checkmate()) {
            status = `Game over, ${moveColor} is in checkmate.`;
            showModal(`Game over, ${moveColor} is in checkmate.`);
        } else if (game.in_draw()) {
            status = `Game over, draw.`;
            showModal('Game over, draw.');
        } else {
            status = `Game over.`;
            showModal('Game over.');
        }
    } else {
        status = `${moveColor}'s turn`;
    }
    statusMessage.textContent = status;
}

function checkGameOver() {
    if (game.in_checkmate()) {
        const winner = game.turn() === 'w' ? 'Black' : 'White';
        showModal(`Checkmate! ${winner} wins!`);
    } else if (game.in_draw()) {
        showModal('Game is a draw!');
    } else if (game.in_stalemate()) {
        showModal('Stalemate! Game is a draw!');
    }
}

function updateEvaluationBar(score) {
    const normalizedScore = Math.max(-10, Math.min(10, score));
    const percentage = ((normalizedScore + 10) / 20) * 100;
    evaluationBar.style.height = `${100 - percentage}%`;
    evaluationScore.textContent = normalizedScore.toFixed(2);
    if (normalizedScore > 1) {
        evaluationBar.style.backgroundColor = 'rgb(52, 211, 153)';
    } else if (normalizedScore < -1) {
        evaluationBar.style.backgroundColor = 'rgb(248, 113, 113)';
    } else {
        evaluationBar.style.backgroundColor = 'rgb(107, 114, 128)';
    }
}

function showModal(message) {
    modalMessage.textContent = message;
    gameOverModal.classList.add('active');
}