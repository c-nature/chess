// This file has been updated to fix the evaluation bar logic by using direct DOM manipulation.

// Initialize the Stockfish web worker
let stockfishWorker = new Worker('/lib/stockfish-nnue-16.js');

// Cache DOM elements using vanilla JavaScript
const boardElement = document.getElementById('myBoard');
const resetButton = document.getElementById('resetButton');
const statusMessage = document.getElementById('status-message');
const evaluationBar = document.querySelector('#evalBar .blackBar');
const evaluationScore = document.getElementById('evalNum');
const gameOverModal = document.getElementById('game-over-modal');
const modalMessage = document.getElementById('modal-message');
const closeModalButton = document.getElementById('closeModalButton');

// Initialize game state
let game = new Chess();
let board = null;
let aiTurn = false;

// Event listeners
resetButton.addEventListener('click', resetGame);
closeModalButton.addEventListener('click', () => gameOverModal.classList.remove('active'));

window.onload = function() {
    initGame();
};

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
    board.start();
    aiTurn = false;
    updateStatus();
    stockfishWorker.postMessage('ucinewgame');
    // Ensure the modal is hidden on reset
    gameOverModal.classList.remove('active');
}

// Handles piece drops on the board
function onDrop(source, target) {
    if (game.get(source).type === 'p' && (target[1] === '8' || target[1] === '1')) {
        showPromotionOverlay(source, target);
        return;
    }
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) {
        return 'snapback';
    }
    checkGameOver();
    updateStatus();
    if (!game.game_over()) {
        aiTurn = true;
        setTimeout(makeAiMove, 500);
    }
    return;
}

// Displays the pawn promotion selection overlay
function showPromotionOverlay(source, target) {
    const overlay = document.getElementById('promotion-overlay');
    const choices = document.querySelector('.promotion-choices');
    choices.innerHTML = '';
    const pieces = ['q', 'r', 'b', 'n'];
    const color = game.turn() === 'w' ? 'White' : 'Black';
    pieces.forEach(piece => {
        const pieceName = piece.toUpperCase();
        const div = document.createElement('div');
        div.className = 'promotion-choice';
        // Use the same image path logic as the pieceTheme
        div.innerHTML = `<img src="/images/${color}-${pieceName}.png" alt="${piece}">`;
        div.addEventListener('click', () => {
            game.move({ from: source, to: target, promotion: piece });
            board.position(game.fen());
            overlay.classList.remove('active');
            updateStatus();
            if (!game.game_over()) {
                aiTurn = true;
                setTimeout(makeAiMove, 500);
            }
        });
        choices.appendChild(div);
    });
    overlay.classList.add('active');
}

// Handles board updates after a piece has been moved
function onSnapEnd() {
    board.position(game.fen());
}

// Initiates a move from the AI (Stockfish)
function makeAiMove() {
    if (aiTurn) {
        statusMessage.textContent = 'Stockfish is thinking...';
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
    
    // Use direct DOM manipulation for the style.height
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

// Shows a custom modal message
function showModal(message) {
    modalMessage.textContent = message;
    gameOverModal.classList.add('active');
}

// Handle responsive resizing of the evaluation bar
window.addEventListener('resize', () => {
    // Re-render the evaluation bar on resize
    const currentScoreText = evaluationScore.textContent;
    const currentScore = parseFloat(currentScoreText);
    updateEvaluationBar(currentScore);
});
