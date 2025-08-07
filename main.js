// This code acts as the main application logic, connecting the UI, game rules, and AI.
// The core functionality of the chess game is provided by external libraries.

// --- Stockfish Web Worker ---
// This creates a Web Worker that loads the Stockfish engine from your `lib` folder.
// This is how the game communicates with the AI to get the best moves and evaluation.
let stockfishWorker = new Worker('./lib/stockfish.js');

// --- Game variables and UI elements ---
// Get references to all the HTML elements we'll be interacting with.
const boardElement = document.getElementById('myBoard');
const resetButton = document.getElementById('resetButton');
const fenDisplay = document.getElementById('fen-display');
const statusMessage = document.getElementById('status-message');
const evaluationBar = document.getElementById('evaluation-bar');
const evaluationScore = document.getElementById('evaluation-score');
const gameOverModal = document.getElementById('game-over-modal');
const modalMessage = document.getElementById('modal-message');

// Initialize the Chess.js and Chessboard.js objects.
// `game` handles all the chess rules and logic.
let game = new Chess();
// `board` handles the visual display and user interaction with the board.
let board = null;
let aiTurn = false;

// --- Event listeners and initialization ---
resetButton.addEventListener('click', resetGame);
window.onload = function() {
    initGame();
};

// --- Game logic functions ---
function initGame() {
    // Set up the board with `chessboard.js` using a configuration object.
    const config = {
        draggable: true,
        position: 'start',
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
    };
    board = Chessboard('myBoard', config);
    updateStatus();
    // Start the AI worker by sending the UCI protocol commands.
    stockfishWorker.postMessage('uci');
    stockfishWorker.postMessage('isready');
    // Give a little time for the worker to start
    setTimeout(() => {
        stockfishWorker.postMessage('ucinewgame');
    }, 500);
}

function resetGame() {
    // Reset the Chess.js game state and the visual board.
    game = new Chess();
    board.start();
    aiTurn = false;
    updateStatus();
    // Tell the AI worker to start a new game.
    stockfishWorker.postMessage('ucinewgame');
}

function onDrop(source, target) {
    // See if the move is legal by attempting it with Chess.js.
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Always promote to a queen for simplicity
    });

    // If the move is illegal, return 'snapback' to reset the piece's position.
    if (move === null) return 'snapback';

    // Check for game over immediately after a move
    checkGameOver();

    // Update board state and status
    updateStatus();

    // It's the AI's turn, so trigger the AI move
    if (!game.gameOver()) {
        aiTurn = true;
        setTimeout(makeAiMove, 500); // Wait a bit for a smoother experience
    }
}

// This function is called after the piece animation has finished
function onSnapEnd() {
    // Update the visual board to match the current game state from Chess.js.
    board.position(game.fen());
}

function makeAiMove() {
    if (aiTurn) {
        statusMessage.textContent = 'Stockfish is thinking...';
        // Instruct the worker to calculate the best move by sending the FEN string.
        stockfishWorker.postMessage(`position fen ${game.fen()}`);
        stockfishWorker.postMessage('go movetime 2000'); // Think for 2 seconds
    }
}

// Handle messages from the Stockfish worker
stockfishWorker.onmessage = function(event) {
    const message = event.data;
    if (message.startsWith('bestmove')) {
        const bestMove = message.split(' ')[1];
        if (bestMove) {
            // Apply the best move to the Chess.js game and update the visual board.
            game.move(bestMove, { sloppy: true });
            board.position(game.fen());
            aiTurn = false;
            checkGameOver();
            updateStatus();
        }
    } else if (message.startsWith('info score cp')) {
        const score = parseInt(message.split(' ')[2], 10) / 100;
        // Update the evaluation bar based on the score from the AI.
        updateEvaluationBar(score);
    }
};

function updateStatus() {
    let status = '';
    const moveColor = (game.turn() === 'w') ? 'White' : 'Black';
    // Display the current board state in FEN format.
    fenDisplay.textContent = `FEN: ${game.fen()}`;

    if (game.gameOver()) {
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

    // Display the current game status to the user.
    statusMessage.textContent = status;
}

function checkGameOver() {
    // Check the game state and show the modal if the game has ended.
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
    // Normalize the score to a range (e.g., -10 to 10) for visual representation
    const normalizedScore = Math.max(-10, Math.min(10, score));
    const percentage = ((normalizedScore + 10) / 20) * 100;

    // Set the bar height based on the score
    evaluationBar.style.height = `${percentage}%`;

    // Update the score text
    evaluationScore.textContent = normalizedScore.toFixed(2);

    // Change bar color based on who's winning
    if (normalizedScore > 1) {
        evaluationBar.style.backgroundColor = 'rgb(52, 211, 153)'; // Green for White
    } else if (normalizedScore < -1) {
        evaluationBar.style.backgroundColor = 'rgb(248, 113, 113)'; // Red for Black
    } else {
        evaluationBar.style.backgroundColor = 'rgb(107, 114, 128)'; // Gray for even
    }
}

function showModal(message) {
    // Display a modal with a custom message.
    modalMessage.textContent = message;
    gameOverModal.classList.add('active');
}
