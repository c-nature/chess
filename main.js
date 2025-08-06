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
let evaluationElements = null;

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
            board.orientation(myColor);
            newGame();
        } else if (data.type === "move") {
            makeMove(data.startSquare, data.endSquare, data.promotedTo);
        } else if (data.type === "resign") {
            showAlert(`${data.winner} wins! ${myColor === data.winner ? 'You' : 'Opponent'} resigned.`);
            allowMovement = false;
        } else if (data.type === "error") {
            showAlert(data.message);
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
    document.getElementById('chessboard').addEventListener('click', handleSquareClick);
});

/**
 * Initializes the Stockfish Web Worker.
 */
function initializeStockfish() {
    if (!stockfishWorker) {
        stockfishWorker = new Worker("lib/stockfish-nnue-16.js");
        stockfishWorker.onmessage = handleStockfishMessage;
        stockfishWorker.onerror = (error) => {
            console.error("Stockfish Worker Error:", error);
            if (error.message.includes("SharedArrayBuffer is not defined")) {
                showAlert("AI engine error: Cross-Origin Isolation required. Please ensure your server sends 'Cross-Origin-Opener-Policy: same-origin' and 'Cross-Origin-Embedder-Policy: require-corp' headers.");
            } else {
                showAlert("AI engine error. Please refresh.");
            }
        };
        stockfishWorker.postMessage("uci");
        stockfishWorker.postMessage("isready");
        stockfishWorker.postMessage("setoption name multipv value 3");
    }
}

/**
 * Handles messages received from the Stockfish Web Worker.
 */
function handleStockfishMessage(event) {
    const message = event.data;
    if (message.startsWith("bestmove")) {
        const move = message.split(" ")[1];
        if (move) {
            const startSquare = move.substring(0, 2);
            const endSquare = move.substring(2, 4);
            const promotedTo = move.length > 4 ? move.substring(4, 5) : null;
            makeMove(startSquare, endSquare, promotedTo);
        }
    } else if (message.startsWith("info")) {
        const infoParts = message.split(" ");
        const scoreIndex = infoParts.indexOf("score");
        if (scoreIndex !== -1 && infoParts[scoreIndex + 1] === "cp") {
            evaluation = parseFloat(infoParts[scoreIndex + 2]) / 100;
            displayEvaluation();
        }
    }
}

/**
 * Sets the game mode and updates UI visibility.
 */
function setGameMode(mode) {
    gameMode = mode;
    gameModeSelectionDiv.style.display = 'none';

    if (gameMode === 'singlePlayer') {
        topContainer.style.display = 'flex';
        evaluationContainer.style.display = 'flex'; // Assuming this exists in HTML
        joinDiv.style.display = 'none';
        gamePlayerInfo.style.display = 'none';
        playerInfo.style.display = 'none';
        gameContainer.style.display = 'flex';
        myColor = 'white';
        opponentColor = 'black';
        initializeStockfish();
        newGame();
    } else if (gameMode === 'multiplayer') {
        topContainer.style.display = 'none';
        evaluationContainer.style.display = 'none'; // Hide evaluation in multiplayer
        joinDiv.style.display = 'flex';
        gamePlayerInfo.style.display = 'flex';
        playerInfo.style.display = 'flex';
        gameContainer.style.display = 'none';
    }
}

/**
 * Handles joining a multiplayer game.
 */
function joinGame() {
    const username = usernameInput.value.trim();
    if (username) {
        joinDiv.style.display = 'none';
        gamePlayerInfo.style.display = 'flex';
        playerInfo.textContent = `Waiting for opponent... (You: ${username})`;
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
 */
function newGame() {
    allowMovement = true;
    game = new Chess();
    board = Chessboard('chessboard', {
        position: 'start',
        draggable: true,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        orientation: myColor,
        pieceTheme: function(piece) {
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
                default: return '';
            }
            return `${color}-${pieceName}.png`;
        }
    });

    turnColor = 'white';
    if (gameMode === 'singlePlayer' && stockfishWorker) {
        stockfishWorker.postMessage("ucinewgame");
        stockfishWorker.postMessage("isready");
        stockfishWorker.postMessage("position startpos");
        if (myColor === 'black') {
            allowMovement = false;
            stockfishWorker.postMessage("go depth 15");
        }
    }
    displayEvaluation();
    clearHighlights();
}

/**
 * Handles a player resigning the game.
 */
function resignGame() {
    if (gameMode === 'multiplayer' && typeof ws !== 'undefined' && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resign', winner: opponentColor }));
    }
    showAlert(`${myColor} resigned. ${opponentColor} wins!`);
    allowMovement = false;
}

/**
 * Chessboard.js onDrop handler for drag-and-drop moves.
 */
function onDrop(source, target) {
    if (!allowMovement || (gameMode === 'singlePlayer' && game.turn() === 'b')) return 'snapback';
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });
    if (move === null) return 'snapback';
    handleMoveMade(move);
}

/**
 * Chessboard.js onSnapEnd handler.
 */
function onSnapEnd() {
    board.position(game.fen());
}

/**
 * Central function to apply a move to the game state and update UI.
 */
function makeMove(startSquare, endSquare, promotedTo) {
    if (!allowMovement) return;
    const move = game.move({
        from: startSquare,
        to: endSquare,
        promotion: promotedTo
    });
    if (move === null) {
        console.error("Illegal move attempted:", startSquare, endSquare, promotedTo);
        return;
    }
    handleMoveMade(move);
}

/**
 * Handles click events on chessboard squares for click-to-move functionality.
 */
function handleSquareClick(event) {
    if (!allowMovement || (gameMode === 'singlePlayer' && game.turn() === 'b')) return;
    const squareElement = event.target.closest('.square-55d63');
    if (!squareElement) return;
    const square = squareElement.getAttribute('data-square');
    const piece = game.get(square);
    clearHighlights();
    if (selectedSquare === square) {
        selectedSquare = null;
        return;
    }
    if (selectedSquare) {
        const moveAttempt = game.move({
            from: selectedSquare,
            to: square,
            promotion: 'q'
        });
        if (moveAttempt) {
            makeMove(selectedSquare, square, moveAttempt.promotion);
            selectedSquare = null;
        } else if (piece && piece.color === myColor.charAt(0)) {
            selectedSquare = square;
            squareElement.classList.add('selected');
            highlightLegalMoves(square);
        } else {
            selectedSquare = null;
        }
    } else if (piece && piece.color === myColor.charAt(0)) {
        selectedSquare = square;
        squareElement.classList.add('selected');
        highlightLegalMoves(square);
    }
}

/**
 * Handles the move made and updates game state.
 */
function handleMoveMade(move) {
    board.position(game.fen());
    turnColor = game.turn() === 'w' ? 'white' : 'black';
    clearHighlights();
    if (gameMode === 'singlePlayer' && turnColor !== myColor) {
        allowMovement = false;
        if (stockfishWorker) {
            stockfishWorker.postMessage(`position fen ${game.fen()}`);
            stockfishWorker.postMessage("go depth 15");
        }
    } else {
        allowMovement = true;
    }
    if (gameMode === 'multiplayer' && typeof ws !== 'undefined' && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'move',
            startSquare: move.from,
            endSquare: move.to,
            promotedTo: move.promotion
        }));
    }
    checkGameStatus();
    displayEvaluation();
}

/**
 * Highlights legal moves on the board for a given square.
 */
function highlightLegalMoves(square) {
    const moves = game.moves({ square: square, verbose: true });
    moves.forEach(move => {
        const targetSquareElement = document.querySelector(`.square-55d63[data-square="${move.to}"]`);
        if (targetSquareElement) {
            if (move.flags.includes('c')) {
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
 */
function handlePromotion(event) {
    const promotedTo = event.target.getAttribute('data-piece');
    if (promotionDetails) {
        makeMove(promotionDetails.from, promotionDetails.to, promotedTo);
        promotionDetails = null;
    }
    promotionOverlay.classList.remove('active');
}

/**
 * Displays an alert message to the user.
 */
function showAlert(message) {
    alertMessage.textContent = message;
    alertDiv.style.display = 'flex';
}

/**
 * Checks the current game status and displays alerts.
 */
function checkGameStatus() {
    if (game.in_checkmate()) {
        showAlert(`${turnColor === 'white' ? 'Black' : 'White'} wins by checkmate!`);
        allowMovement = false;
    } else if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition() || game.insufficient_material()) {
        showAlert("Game ended in a draw!");
        allowMovement = false;
    } else if (game.in_check()) {
        showAlert(`${turnColor === 'white' ? 'White' : 'Black'} is in check!`);
    }
}

/**
 * Initializes evaluation elements and displays the current evaluation.
 */
function initializeEvaluationElements() {
    evaluationElements = {
        blackBar: document.querySelector(".blackBar"),
        evalNum: document.querySelector(".evalNum"),
        evalMain: document.getElementById("eval"),
        evalText: document.getElementById("evalText"),
        evalLines: [],
        lineElements: []
    };
    for (let i = 1; i <= 3; i++) {
        evaluationElements.evalLines[i-1] = document.getElementById(`eval${i}`);
        evaluationElements.lineElements[i-1] = document.getElementById(`line${i}`);
    }
}

function displayEvaluation() {
    if (!evaluationElements) initializeEvaluationElements();
    if (evaluationElements.blackBar) {
        updateEvaluationBar();
        updateEvaluationText();
        updateEvaluationLines();
    }
}

function updateEvaluationBar() {
    if (evaluationElements.blackBar && evaluationElements.evalNum) {
        const clampedEval = Math.max(-10, Math.min(10, evaluation));
        const barWidth = 100 * (clampedEval + 10) / 20;
        evaluationElements.blackBar.style.width = `${barWidth}%`;
        evaluationElements.evalNum.textContent = evaluation.toFixed(2);
    }
}

function updateEvaluationText() {
    if (evaluationElements.evalMain && evaluationElements.evalText) {
        evaluationElements.evalMain.textContent = "Evaluation";
        evaluationElements.evalText.textContent = evaluation.toFixed(2);
    }
}

function updateEvaluationLines() {
    if (stockfishWorker && evaluationElements.evalLines && evaluationElements.lineElements) {
        // Placeholder for multi-PV lines
        for (let i = 0; i < 3; i++) {
            evaluationElements.evalLines[i].textContent = `Line ${i + 1}: +0.00`;
            evaluationElements.lineElements[i].textContent = "1. e4 e5";
        }
    }
}

// Initialize the game on load
initializeStockfish();
setGameMode('singlePlayer'); // Default to single-player mode