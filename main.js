// This file has been updated to fix image paths, modal functionality, and a race condition.

// Initialize the Stockfish web worker
let stockfishWorker = new Worker('/lib/stockfish-nnue-16.js');

// Cache DOM elements
const boardElement = $('#myBoard');
const resetButton = $('#resetButton');
const fenDisplay = $('#fen-display');
const statusMessage = $('#status-message');
const evaluationBar = $('#evalBar .blackBar');
const evaluationScore = $('#evalNum');
const gameOverModal = $('#game-over-modal');
const modalMessage = $('#modal-message');
const closeModalButton = $('#closeModalButton');

// Initialize game state
let game = new Chess();
let board = null;
let aiTurn = false;

// Event listeners
resetButton.on('click', resetGame);
// Correctly use removeClass to hide the modal
closeModalButton.on('click', () => gameOverModal.removeClass('active'));

$(document).ready(function() {
    initGame();
});

// Main game initialization function
function initGame() {
    // Chessboard.js configuration
    const config = {
        draggable: true,
        position: 'start',
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        // Custom piece theme to correctly load images from the /images directory
        pieceTheme: function(piece) {
            const pieceMap = {
                'wP': 'White-Pawn.png', 'wN': 'White-Knight.png', 'wB': 'White-Bishop.png',
                'wR': 'White-Rook.png', 'wQ': 'White-Queen.png', 'wK': 'White-King.png',
                'bP': 'Black-Pawn.png', 'bN': 'Black-Knight.png', 'bB': 'Black-Bishop.png',
                'bR': 'Black-Rook.png', 'bQ': 'Black-Queen.png', 'bK': 'Black-King.png'
            };
            // The path to your images folder
            const path = '/images/' + pieceMap[piece];
            return path;
        }
    };
    try {
        board = Chessboard('myBoard', config);
        // Explicitly set the board to the starting position to prevent conflicts
        board.position(game.fen());
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

// Resets the game to the starting position
function resetGame() {
    game = new Chess();
    board.position('start');
    aiTurn = false;
    updateStatus();
    stockfishWorker.postMessage('ucinewgame');
    // Ensure the modal is hidden on reset
    gameOverModal.removeClass('active');
}

// Handles piece drops on the board
function onDrop(source, target) {
    if (game.get(source).type === 'p' && (target[1] === '8' || target[1] === '1')) {
        showPromotionOverlay(source, target);
        return 'snapback';
    }
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) {
        return 'snapback';
    }
    board.position(game.fen());
    checkGameOver();
    updateStatus();
    if (!game.game_over()) {
        aiTurn = true;
        setTimeout(makeAiMove, 500);
    }
}

// Displays the pawn promotion selection overlay
function showPromotionOverlay(source, target) {
    const overlay = $('#promotion-overlay');
    const choices = $('.promotion-choices');
    choices.empty();
    const pieces = ['q', 'r', 'b', 'n'];
    const color = game.turn() === 'w' ? 'White' : 'Black';
    pieces.forEach(piece => {
        const pieceName = piece.toUpperCase();
        const div = $('<div>').addClass('promotion-choice');
        // Use the same image path logic as the pieceTheme
        div.html(`<img src="/images/${color}-${pieceName}.png" alt="${piece}">`);
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

// Handles board updates after a piece has been moved
function onSnapEnd() {
    board.position(game.fen());
}

// Initiates a move from the AI (Stockfish)
function makeAiMove() {
    if (aiTurn) {
        statusMessage.text('Stockfish is thinking...');
        stockfishWorker.postMessage(`position fen ${game.fen()}`);
        stockfishWorker.postMessage('go movetime 2000');
    }
}

// Handles messages from the Stockfish web worker
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

// Updates the game status display
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

// Checks for game over conditions
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

// Updates the evaluation bar
function updateEvaluationBar(score) {
    const normalizedScore = Math.max(-10, Math.min(10, score));
    const percentage = ((normalizedScore + 10) / 20) * 100;
    
    // Check for window width to determine orientation
    if (window.innerWidth <= 768) {
        evaluationBar.css('width', `${percentage}%`);
        evaluationBar.css('height', '100%');
    } else {
        evaluationBar.css('height', `${100 - percentage}%`);
        evaluationBar.css('width', '100%');
    }

    evaluationScore.text(normalizedScore.toFixed(2));
    if (normalizedScore > 1) {
        evaluationBar.css('backgroundColor', 'rgb(52, 211, 153)');
    } else if (normalizedScore < -1) {
        evaluationBar.css('backgroundColor', 'rgb(248, 113, 113)');
    } else {
        evaluationBar.css('backgroundColor', 'rgb(107, 114, 128)');
    }
}

// Shows a custom modal message
function showModal(message) {
    modalMessage.text(message);
    gameOverModal.addClass('active');
}

// Handle responsive resizing of the evaluation bar
window.addEventListener('resize', () => {
    // Re-render the evaluation bar on resize
    const currentScoreText = evaluationScore.text();
    const currentScore = parseFloat(currentScoreText);
    updateEvaluationBar(currentScore);
});
