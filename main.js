// Define a function to generate a base64 encoded string from the Stockfish engine code.
// This is necessary to create a Web Worker from a string, as we can't assume a local file path.
const stockfishWorkerCode = () => {
    self.onmessage = function(e) {
        if (e.data.startsWith('uci')) {
            self.postMessage('uciok');
        } else if (e.data.startsWith('isready')) {
            self.postMessage('readyok');
        } else if (e.data.startsWith('position')) {
            // Log the position command for debugging.
            self.postMessage('info string ' + e.data);
        } else if (e.data.startsWith('go')) {
            // Simulate Stockfish output for a hardcoded position
            const position = e.data.split('position ')[1];
            let bestMove = '';
            let evaluation = 0;

            // A simple, deterministic "AI" based on the current position.
            // In a real scenario, this would be the actual Stockfish logic.
            // For now, it's a dummy to show the full application structure.
            // This placeholder code demonstrates how the pieces connect.
            if (position.includes('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')) {
                bestMove = 'e2e4'; // Hardcoded opening move
                evaluation = 0.2;
            } else {
                // For any other position, generate a random move (for demonstration)
                // A real Stockfish engine would be running here.
                // Here we just provide a placeholder to show the flow.
                const moves = ['e7e5', 'd7d5', 'c7c5', 'b7b5', 'g8f6'];
                bestMove = moves[Math.floor(Math.random() * moves.length)];
                evaluation = Math.random() * 2 - 1; // Random score between -1 and 1
            }

            // Post a simulated "best move" and "evaluation" from the engine
            self.postMessage(`bestmove ${bestMove}`);
            self.postMessage(`info score cp ${Math.round(evaluation * 100)} depth 10`);
        } else {
            self.postMessage(`unknown command: ${e.data}`);
        }
    };
};

const stockfishWorkerBlob = new Blob([
    '(' + stockfishWorkerCode.toString() + ')()'
], { type: 'application/javascript' });
const stockfishWorker = new Worker(URL.createObjectURL(stockfishWorkerBlob));

// --- Game variables and UI elements ---
const boardElement = document.getElementById('myBoard');
const resetButton = document.getElementById('resetButton');
const fenDisplay = document.getElementById('fen-display');
const statusMessage = document.getElementById('status-message');
const evaluationBar = document.getElementById('evaluation-bar');
const evaluationScore = document.getElementById('evaluation-score');
const gameOverModal = document.getElementById('game-over-modal');
const modalMessage = document.getElementById('modal-message');

let game = new Chess();
let board = null;
let aiTurn = false;

// --- Event listeners and initialization ---
resetButton.addEventListener('click', resetGame);
window.onload = function() {
    initGame();
};

// --- Game logic functions ---
function initGame() {
    // Set up the board with `chessboard.js`
    const config = {
        draggable: true,
        position: 'start',
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
    };
    board = Chessboard('myBoard', config);
    updateStatus();
    // Start the AI worker
    stockfishWorker.postMessage('uci');
    stockfishWorker.postMessage('isready');
    // Give a little time for the worker to start
    setTimeout(() => {
        stockfishWorker.postMessage('ucinewgame');
    }, 500);
}

function resetGame() {
    game = new Chess();
    board.start();
    aiTurn = false;
    updateStatus();
    stockfishWorker.postMessage('ucinewgame');
}

function onDrop(source, target) {
    // See if the move is legal
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Always promote to a queen for simplicity
    });

    // Illegal move
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
    board.position(game.fen());
}

function makeAiMove() {
    if (aiTurn) {
        statusMessage.textContent = 'Stockfish is thinking...';
        // Instruct the worker to calculate the best move
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

function updateStatus() {
    let status = '';
    const moveColor = (game.turn() === 'w') ? 'White' : 'Black';
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
    modalMessage.textContent = message;
    gameOverModal.classList.add('active');
}
