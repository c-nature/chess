let gameMode = null;
let board = null;
let game = null;
let stockfishWorker = null;
let allowMovement = true;
let myColor = null; // 'white' or 'black'
let opponentColor = null;
let turnColor = 'white'; // 'white' or 'black' (corresponds to game.turn() 'w' or 'b')
let evaluation = 0;
let selectedSquare = null; // For click-to-move
let promotionDetails = null; // Stores { from, to } for promotion

const gameModeSelectionDiv = document.getElementById('game-mode-selection');
const joinDiv = document.getElementById('joinDiv');
const singlePlayerBtn = document.getElementById('singlePlayerBtn');
const multiplayerBtn = document.getElementById('multiplayerBtn');
const joinGameBtn = document.getElementById('joinGameBtn');
const usernameInput = document.getElementById('usernameInput');
const gamePlayerInfo = document.getElementById('gamePlayerInfo');
const playerInfo = document.getElementById('playerInfo');
const topContainer = document.getElementById('topContainer');
const gameContainer = document.getElementById('gameContainer');
const newGameBtn = document.getElementById('newGameBtn');
const resignBtn = document.getElementById('resignBtn');
const alertDiv = document.getElementById('alert');
const alertMessage = document.getElementById('alertMessage');
const alertOkBtn = document.getElementById('alertOkBtn');
const promotionOverlay = document.getElementById('promotion-overlay');
const promotionPieces = document.querySelectorAll('.promotion-piece');
const evaluationContainer = document.querySelector('.evaluation-container');
const evaluationText = document.querySelector('.evaluation-text');
const whiteFill = document.querySelector('.eval-fill-white'); // Element for white's evaluation fill
const blackFill = document.querySelector('.eval-fill-black'); // Element for black's evaluation fill

// Expose necessary variables/functions for external access if needed by /client
window.main = {
    handleWebSocketMessage: function(data) {
        if (data.type === "playerList") {
            playerInfo.textContent = data.players.join(', ') || "Waiting for opponent...";
        } else if (data.type === "color") {
            myColor = data.color;
            opponentColor = data.color === 'white' ? 'black' : 'white';
            turnColor = 'white'; // Game always starts with white
            allowMovement = myColor === turnColor;
            gameContainer.style.display = 'flex';
            newGame(); // Call the global newGame function
        } else if (data.type === "move") {
            // Multiplayer move received
            makeMove(data.startSquare, data.endSquare, data.promotedTo); // Call the global makeMove function
        } else if (data.type === "resign") {
            showAlert(`${data.winner} wins! ${myColor === data.winner ? 'You' : 'Opponent'} resigned.`); // Call the global showAlert function
            allowMovement = false;
        } else if (data.type === "error") {
            showAlert(data.message); // Call the global showAlert function
        }
    }
};

document.addEventListener('DOMContentLoaded', (event) => {
    singlePlayerBtn.addEventListener('click', () => setGameMode('singlePlayer'));
    multiplayerBtn.addEventListener('click', () => setGameMode('multiplayer'));
    joinGameBtn.addEventListener('click', joinGame);
    newGameBtn.addEventListener('click', newGame);
    resignBtn.addEventListener('click', resignGame);
    alertOkBtn.addEventListener('click', () => {
        alertDiv.style.display = 'none';
    });
    promotionPieces.forEach(piece => {
        piece.addEventListener('click', handlePromotion);
    });

    // Event listener for the chessboard container for click-to-move
    document.getElementById('chessboard').addEventListener('click', handleSquareClick);
});

/**
 * Initializes the Stockfish Web Worker.
 * Sets up message and error handlers and sends initial UCI commands.
 */
function initializeStockfish() {
    if (!stockfishWorker) {
        stockfishWorker = new Worker("lib/stockfish-nnue-16.js");
        stockfishWorker.onmessage = handleStockfishMessage;
        stockfishWorker.onerror = (error) => {
            console.error("Stockfish Worker Error:", error);
            // Check if the error is due to SharedArrayBuffer
            if (error.message.includes("SharedArrayBuffer is not defined")) {
                showAlert("AI engine error: Cross-Origin Isolation required. Please ensure your server sends 'Cross-Origin-Opener-Policy: same-origin' and 'Cross-Origin-Embedder-Policy: require-corp' headers.");
            } else {
                showAlert("AI engine error. Please refresh.");
            }
        };
        // Send UCI commands to Stockfish
        stockfishWorker.postMessage("uci");
        stockfishWorker.postMessage("isready");
        stockfishWorker.postMessage("setoption name multipv value 3"); // Request top 3 lines for potential display
    }
}

/**
 * Handles messages received from the Stockfish Web Worker.
 * Parses bestmove and info (evaluation) messages.
 * @param {MessageEvent} event - The message event from the worker.
 */
function handleStockfishMessage(event) {
    const message = event.data;
    if (message.startsWith("bestmove")) {
        const move = message.split(" ")[1];
        if (move) { // Ensure move exists
            const startSquare = move.substring(0, 2);
            const endSquare = move.substring(2, 4);
            const promotedTo = move.length > 4 ? move.substring(4, 5) : null;
            // AI makes its move
            makeMove(startSquare, endSquare, promotedTo);
        }
    } else if (message.startsWith("info")) {
        const infoParts = message.split(" ");
        const scoreIndex = infoParts.indexOf("score");
        if (scoreIndex !== -1 && infoParts[scoreIndex + 1] === "cp") {
            evaluation = parseFloat(infoParts[scoreIndex + 2]) / 100; // Convert centipawns to pawns
            updateEvaluationBar();
        }
        // You could parse 'pv' (principal variation) here if you want to display AI's thought process
        // const pvIndex = infoParts.indexOf("pv");
        // if (pvIndex !== -1) {
        //     const pvMoves = infoParts.slice(pvIndex + 1);
        //     console.log("Principal Variation:", pvMoves.join(" "));
        // }
    }
}

/**
 * Sets the game mode (single player or multiplayer) and updates UI visibility.
 * @param {string} mode - 'singlePlayer' or 'multiplayer'.
 */
function setGameMode(mode) {
    gameMode = mode;
    gameModeSelectionDiv.style.display = 'none'; // Hide mode selection buttons

    if (gameMode === 'singlePlayer') {
        topContainer.style.display = 'flex'; // Show game controls and evaluation
        evaluationContainer.style.display = 'flex';
        joinDiv.style.display = 'none'; // Hide multiplayer join UI
        gamePlayerInfo.style.display = 'none';
        playerInfo.style.display = 'none';
        gameContainer.style.display = 'flex'; // Show chessboard
        myColor = 'white'; // Player is always white in single player
        opponentColor = 'black'; // AI is always black
        initializeStockfish(); // Initialize Stockfish when single player is selected
        newGame(); // Start a new single player game
    } else if (gameMode === 'multiplayer') {
        topContainer.style.display = 'none'; // Hide single player controls
        evaluationContainer.style.display = 'none';
        joinDiv.style.display = 'flex'; // Show multiplayer join UI
        gamePlayerInfo.style.display = 'flex';
        playerInfo.style.display = 'flex';
        gameContainer.style.display = 'none'; // Hide chessboard initially
        // Multiplayer color will be assigned by the server via WebSocket
    }
}

/**
 * Handles joining a multiplayer game.
 * Sends username to server via WebSocket.
 */
function joinGame() {
    const username = usernameInput.value.trim();
    if (username) {
        joinDiv.style.display = 'none';
        gamePlayerInfo.style.display = 'flex';
        playerInfo.textContent = `Waiting for opponent... (You: ${username})`;
        // Check if WebSocket connection is available and open
        if (typeof ws !== 'undefined' && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'join', username }));
        } else {
            showAlert("WebSocket connection not available. Please try again.");
        }
    } else {
        showAlert("Please enter a username.");
    }
}

/**
 * Starts a new game.
 * Resets game state, initializes Chess.js and Chessboard.js.
 * If single player, tells Stockfish to start a new game.
 */
function newGame() {
    allowMovement = true;
    game = new Chess(); // Initialize new Chess game
    board = Chessboard('chessboard', { // Initialize new Chessboard
        position: 'start',
        draggable: true,
        onDrop: onDrop, // Callback for drag-and-drop moves
        onSnapEnd: onSnapEnd, // Callback after piece animation ends
        orientation: myColor, // Set board orientation based on player color
        // Configure pieceTheme to load images from the root directory
        // This function will be called by chessboard.js for each piece
        pieceTheme: function(piece) {
            // piece is like 'wP', 'bN', 'bQ', etc.
            const color = piece.charAt(0) === 'w' ? 'white' : 'black';
            const type = piece.charAt(1);
            let pieceName;
            switch (type) {
                case 'P': pieceName = 'Pawn'; break;
                case 'N': pieceName = 'Knight'; break;
                case 'B': pieceName = 'Bishop'; break;
                case 'R': pieceName = 'Rook'; break;
                case 'Q': pieceName = 'Queen'; break;
                case 'K': pieceName = 'King'; break;
                default: return ''; // Should not happen
            }
            // Construct the path to your PNG files, assuming they are in the root
            return `${color}-${pieceName}.png`;
        }
    });

    // Reset turn color to white (Chess.js default)
    turnColor = 'white';

    // If single player, reset Stockfish and potentially make AI move
    if (gameMode === 'singlePlayer') {
        // Only send Stockfish commands if the worker is successfully initialized
        if (stockfishWorker) {
            stockfishWorker.postMessage("ucinewgame"); // Tell Stockfish to start a new game
            stockfishWorker.postMessage("isready");
            stockfishWorker.postMessage(`position startpos`); // Set initial position for Stockfish
            if (myColor === 'black') { // If player is black, AI (white) moves first
                allowMovement = false; // Prevent player movement during AI turn
                stockfishWorker.postMessage("go depth 15"); // Ask AI for a move
            } else {
                allowMovement = true; // Player (white) moves first
            }
        } else {
            console.warn("Stockfish worker not initialized. AI will not function.");
        }
    }
    updateEvaluationBar(); // Update evaluation display
    clearHighlights(); // Clear any previous highlights on the board
}

/**
 * Handles a player resigning the game.
 * If multiplayer, sends resign message to server.
 */
function resignGame() {
    if (gameMode === 'multiplayer' && typeof ws !== 'undefined' && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resign', winner: opponentColor }));
    }
    showAlert(`${myColor} resigned. ${opponentColor} wins!`);
    allowMovement = false; // Disable further moves
}

/**
 * Chessboard.js onDrop handler for drag-and-drop moves.
 * Attempts to make a move and handles pawn promotion.
 * @param {string} source - The source square (e.g., 'e2').
 * @param {string} target - The target square (e.g., 'e4').
 * @returns {string|void} 'snapback' if move is illegal, otherwise nothing.
 */
function onDrop(source, target) {
    // Prevent movement if not allowed or if it's not the player's turn
    if (!allowMovement || game.turn() !== myColor.charAt(0)) {
        return 'snapback';
    }

    const piece = game.get(source);
    const isPawn = piece && piece.type === 'p';
    const isPromotionRank = (piece.color === 'w' && target[1] === '8') ||
                            (piece.color === 'b' && target[1] === '1');

    // If it's a pawn reaching the promotion rank, show promotion overlay
    if (isPawn && isPromotionRank) {
        promotionDetails = { from: source, to: target }; // Store details for promotion
        promotionOverlay.classList.add('active'); // Show promotion overlay
        // Update promotion piece images based on the color of the pawn promoting
        promotionPieces.forEach(p => {
            const pieceType = p.getAttribute('data-piece');
            p.src = `${piece.color === 'w' ? 'white' : 'black'}-${pieceType.toUpperCase()}.png`;
            // Add a class to the promotion piece images to indicate color for CSS styling
            p.classList.remove('white-piece', 'black-piece');
            p.classList.add(piece.color === 'w' ? 'white-piece' : 'black-piece');
        });
        return; // Do not make the move yet, wait for promotion choice
    }

    // Attempt to make the move (defaulting to queen for non-promotion moves)
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    // If the move is illegal, snap the piece back
    if (move === null) {
        return 'snapback';
    }

    // If move is valid, update board and handle game state
    handleMoveMade(move);
}

/**
 * Chessboard.js onSnapEnd handler.
 * Ensures the visual board position is in sync with the Chess.js game state
 * after a piece animation (e.g., after a snapback or valid move).
 */
function onSnapEnd() {
    board.position(game.fen());
}

/**
 * Central function to apply a move to the game state and update UI.
 * This function is called by onDrop, handleSquareClick (after promotion),
 * and when an AI/multiplayer opponent makes a move.
 * @param {string} startSquare - The starting square of the move.
 * @param {string} endSquare - The ending square of the move.
 * @param {string} promotedTo - The piece type to promote to (e.g., 'q' for queen), or null.
 */
function makeMove(startSquare, endSquare, promotedTo) {
    // Prevent movement if not allowed or if it's not the player's turn
    // This check is crucial to prevent AI from moving when it's not its turn
    // or player moving when it's not their turn.
    if (!allowMovement && gameMode === 'singlePlayer' && game.turn() === myColor.charAt(0)) {
        // If it's single player and AI's turn, and player tries to move, prevent it.
        // This scenario is mainly for drag-and-drop; click-to-move is already guarded.
        return 'snapback';
    }

    const move = game.move({
        from: startSquare,
        to: endSquare,
        promotion: promotedTo // Use the provided promotion piece
    });

    if (move === null) {
        // This should ideally not happen if the move comes from Stockfish
        // or a validated multiplayer message, but good for robustness.
        console.error("Illegal move attempted:", startSquare, endSquare, promotedTo);
        return; // Do not proceed with an illegal move
    }

    board.position(game.fen()); // Update the visual board
    turnColor = game.turn() === 'w' ? 'white' : 'black'; // Update turn based on chess.js

    clearHighlights(); // Clear any move highlights after a move is completed

    // If it's single player and now AI's turn, ask Stockfish for a move
    if (gameMode === 'singlePlayer' && turnColor !== myColor) {
        allowMovement = false; // Prevent player movement during AI turn
        if (stockfishWorker) { // Ensure worker is initialized before sending messages
            stockfishWorker.postMessage(`position fen ${game.fen()}`);
            stockfishWorker.postMessage("go depth 15"); // Request AI to calculate a move
        } else {
            console.warn("Stockfish worker not initialized. AI will not function.");
        }
    } else {
        allowMovement = true; // Allow player movement if it's their turn
    }

    // If multiplayer, send move details to the server
    if (gameMode === 'multiplayer' && typeof ws !== 'undefined' && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'move',
            startSquare: move.from,
            endSquare: move.to,
            promotedTo: move.promotion
        }));
    }

    checkGameStatus(); // Check for checkmate, draw, etc.
    updateEvaluationBar(); // Update the evaluation display
}


/**
 * Handles click events on chessboard squares for click-to-move functionality.
 * Selects pieces, shows legal moves, and attempts to make moves.
 * @param {MouseEvent} event - The click event.
 */
function handleSquareClick(event) {
    // Prevent interaction if movement is not allowed or it's not the player's turn
    if (!allowMovement || game.turn() !== myColor.charAt(0)) return;

    const squareElement = event.target.closest('.square-55d63'); // Use chessboard.js square class
    if (!squareElement) return;

    const square = squareElement.getAttribute('data-square'); // Get square ID from data-square attribute
    const piece = game.get(square);

    // Clear previous highlights
    clearHighlights();

    if (selectedSquare === square) {
        // Clicking the same square again deselects it
        selectedSquare = null;
        return;
    }

    if (selectedSquare) {
        // A piece is already selected, try to move it to the clicked square
        const move = game.move({
            from: selectedSquare,
            to: square,
            promotion: 'q' // Default to queen for initial move attempt
        });

        if (move) {
            // If the move is valid, check for promotion
            if (move.promotion && (move.color === 'w' && move.to[1] === '8' || move.color === 'b' && move.to[1] === '1')) {
                promotionDetails = { from: selectedSquare, to: square };
                promotionOverlay.classList.add('active'); // Show promotion overlay
                // Update promotion piece images based on the color of the pawn promoting
                promotionPieces.forEach(p => {
                    const pieceType = p.getAttribute('data-piece');
                    p.src = `${move.color === 'w' ? 'white' : 'black'}-${pieceType.toUpperCase()}.png`;
                    p.classList.remove('white-piece', 'black-piece');
                    p.classList.add(move.color === 'w' ? 'white-piece' : 'black-piece');
                });
            } else {
                // If no promotion, process the move using the makeMove function
                makeMove(selectedSquare, square, move.promotion);
            }
            selectedSquare = null; // Clear selected square after attempting move
        } else {
            // Invalid move, if the clicked square has our piece, select it instead
            if (piece && piece.color === myColor.charAt(0)) {
                selectedSquare = square;
                squareElement.classList.add('selected');
                highlightLegalMoves(square);
            } else {
                selectedSquare = null; // Clicked an empty square or opponent's piece, deselect current
            }
        }
    } else {
        // No piece selected, try to select the clicked piece
        if (piece && piece.color === myColor.charAt(0)) { // Check if it's the player's piece
            selectedSquare = square;
            squareElement.classList.add('selected'); // Highlight selected square
            highlightLegalMoves(square); // Show legal moves for the selected piece
        }
    }
}

/**
 * Highlights legal moves on the board for a given square.
 * @param {string} square - The square from which to highlight moves.
 */
function highlightLegalMoves(square) {
    const moves = game.moves({ square: square, verbose: true });
    moves.forEach(move => {
        const targetSquareElement = document.querySelector(`.square-55d63[data-square="${move.to}"]`); // Use chessboard.js square class
        if (targetSquareElement) {
            // Add classes for highlighting based on move type (capture or regular move)
            if (move.flags.includes('c')) { // 'c' for capture
                targetSquareElement.classList.add('legal-capture');
            } else {
                targetSquareElement.classList.add('legal-move');
            }
        }
    });
}

/**
 * Clears all highlight classes from the chessboard squares.
 */
function clearHighlights() {
    document.querySelectorAll('.square-55d63.selected, .square-55d63.legal-move, .square-55d63.legal-capture').forEach(s => {
        s.classList.remove('selected', 'legal-move', 'legal-capture');
    });
}

/**
 * Handles the promotion piece selection.
 * Makes the final move with the chosen promotion piece.
 * @param {MouseEvent} event - The click event on a promotion piece image.
 */
function handlePromotion(event) {
    const promotedTo = event.target.getAttribute('data-piece'); // Get the piece type from data-piece attribute
    if (promotionDetails) {
        // Make the move with the selected promotion piece
        makeMove(promotionDetails.from, promotionDetails.to, promotedTo);
        promotionDetails = null; // Clear promotion details
    }
    promotionOverlay.classList.remove('active'); // Hide promotion overlay
}

/**
 * Displays an alert message to the user.
 * @param {string} message - The message to display.
 */
function showAlert(message) {
    alertMessage.textContent = message;
    alertDiv.style.display = 'flex'; // Show the alert dialog
}

/**
 * Checks the current game status (checkmate, draw, etc.) and displays alerts.
 */
function checkGameStatus() {
    if (game.in_checkmate()) {
        showAlert(`${turnColor === 'white' ? 'Black' : 'White'} wins by checkmate!`);
        allowMovement = false;
    } else if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition() || game.insufficient_material()) {
        showAlert("Game ended in a draw!");
        allowMovement = false;
    } else if (game.in_check()) {
        // Only show check alert if it's the player's turn and they are in check
        // Or if it's the AI's turn and the player just put AI in check
        showAlert(`${turnColor === 'white' ? 'White' : 'Black'} is in check!`);
    }
}

/**
 * Updates the visual evaluation bar and text based on the current evaluation score.
 */
function updateEvaluationBar() {
    if (evaluationContainer.style.display !== 'none' && whiteFill && blackFill) {
        // Clamp evaluation between -10 and 10 for a reasonable visual range
        const clampedEvaluation = Math.max(-10, Math.min(10, evaluation));

        // Normalize evaluation to a 0-1 scale, where 0 is -10 (black winning) and 1 is +10 (white winning)
        const normalizedEval = (clampedEvaluation + 10) / 20;

        // Calculate heights for white and black fills
        const whiteHeightPercentage = normalizedEval * 100;
        const blackHeightPercentage = (1 - normalizedEval) * 100;

        // Adjust displayed evaluation based on player's color for their perspective
        let displayEvaluation = evaluation;
        if (myColor === 'black') {
            displayEvaluation = -evaluation; // Invert evaluation if player is black
        }
        evaluationText.textContent = `Evaluation: ${displayEvaluation.toFixed(2)}`;

        // Apply calculated heights to the fill elements
        whiteFill.style.height = `${whiteHeightPercentage}%`;
        blackFill.style.height = `${blackHeightPercentage}%`;

        // Optional: Change color based on who has a significant advantage
        if (clampedEvaluation > 2) { // White has a significant advantage
            whiteFill.style.backgroundColor = '#4CAF50'; // Green for white's advantage
            blackFill.style.backgroundColor = '#b58863'; // Default black color
        } else if (clampedEvaluation < -2) { // Black has a significant advantage
            whiteFill.style.backgroundColor = '#f0d9b5'; // Default white color
            blackFill.style.backgroundColor = '#d9534f'; // Red for black's advantage
        } else { // Close game or slight advantage
            whiteFill.style.backgroundColor = '#f0d9b5'; // Default white
            blackFill.style.backgroundColor = '#b58863'; // Default black
        }
    }
}
