let stockfishWorker = new Worker('/lib/stockfish-nnue-16.js');

const boardElement = $('#myBoard');
const resetButton = $('#resetButton');
const fenDisplay = $('#fen-display');
const statusMessage = $('#status-message');
const evaluationBar = $('#evalBar .blackBar');
const evaluationScore = $('#evalNum');
const gameOverModal = $('#game-over-modal');
const modalMessage = $('#modal-message');

let game = new Chess();
let board = null;
let aiTurn = false;

resetButton.on('click', resetGame);
$(document).ready(function() {
    initGame();
});

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
    board.position('start');
    aiTurn = false;
    updateStatus();
    stockfishWorker.postMessage('ucinewgame');
}

function onDrop(source, target) {
    if (game.get(source).type === 'p' && (target[1] === '8' || target[1] === '1')) {
        showPromotionOverlay(source, target);
        return 'snapback';
    }
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    board.position(game.fen());
    checkGameOver();
    updateStatus();
    if (!game.game_over()) {
        aiTurn = true;
        setTimeout(makeAiMove, 500);
    }
}

function showPromotionOverlay(source, target) {
    const overlay = $('#promotion-overlay');
    const choices = $('.promotion-choices');
    choices.empty();
    const pieces = ['q', 'r', 'b', 'n'];
    pieces.forEach(piece => {
        const div = $('<div>').addClass('promotion-choice');
        div.html(`<img src="/images/${game.turn() === 'w' ? 'White' : 'Black'}-${piece.toUpperCase()}.png" alt="${piece}">`);
        div.on('click', () => {
            game.move({ from: source, to: target, promotion: piece });
            board.position(game.fen());
            overlay.removeClass('active');
            updateStatus();
            if (!game.game_over()) {
                aiTurn = true;
                setTimeout(makeAiMove, 500);
            }
        });
        choices.append(div);
    });
    overlay.addClass('active');
}

function onSnapEnd() {
    board.position(game.fen());
}

function makeAiMove() {
    if (aiTurn) {
        statusMessage.text('Stockfish is thinking...');
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
    fenDisplay.text(`FEN: ${game.fen()}`);
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
    statusMessage.text(status);
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
    evaluationBar.css('height', `${100 - percentage}%`);
    evaluationScore.text(normalizedScore.toFixed(2));
    if (normalizedScore > 1) {
        evaluationBar.css('backgroundColor', 'rgb(52, 211, 153)');
    } else if (normalizedScore < -1) {
        evaluationBar.css('backgroundColor', 'rgb(248, 113, 113)');
    } else {
        evaluationBar.css('backgroundColor', 'rgb(107, 114, 128)');
    }
}

function showModal(message) {
    modalMessage.text(message);
    gameOverModal.addClass('active');
}