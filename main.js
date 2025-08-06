
let gameMode = null;
let board = null;
let game = null;
let stockfishWorker = null;
let allowMovement = true;
let myColor = null;
let opponentColor = null;
let turnColor = 'white';
let evaluation = 0;

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
const evaluationBar = document.querySelector('.evaluation-bar');
const evaluationText = document.querySelector('.evaluation-text');

// At the top of main.js
window.main = {
    handleWebSocketMessage: function(data) {
        if (data.type === "playerList") {
            playerInfo.textContent = data.players.join(', ') || "Waiting for opponent...";
        } else if (data.type === "color") {
            myColor = data.color;
            opponentColor = data.color === 'white' ? 'black' : 'white';
            turnColor = 'white';
            allowMovement = myColor === turnColor;
            gameContainer.style.display = 'flex';
            newGame();
        } else if (data.type === "move") {
            makeMove(data.startSquare, data.endSquare, data.promotedTo);
        } else if (data.type === "resign") {
            showAlert(`${data.winner} wins! ${myColor === data.winner ? 'You' : 'Opponent'} resigned.`);
            allowMovement = false;
        } else if (data.type === "error") {
            showAlert(data.message);
        }
    },
    myColor,
    opponentColor,
    turnColor,
    allowMovement,
    gameContainer,
    newGame,
    showAlert,
    makeMove
};

document.addEventListener('DOMContentLoaded', (event) => {
    initializeStockfish();
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

function initializeStockfish() {
    if (!stockfishWorker) {
        stockfishWorker = new Worker("lib/stockfish-nnue-16.js");
        stockfishWorker.onmessage = handleStockfishMessage;
        stockfishWorker.onerror = (error) => {
            console.error("Stockfish Worker Error:", error);
            showAlert("AI engine error. Please refresh.");
        };
        stockfishWorker.postMessage("uci");
        stockfishWorker.postMessage("isready");
        stockfishWorker.postMessage("setoption name multipv value 3");
    }
}

function handleStockfishMessage(event) {
    const message = event.data;
    if (message.startsWith("bestmove")) {
        const move = message.split(" ")[1];
        if (move && allowMovement) {
            const moveData = {
                type: "move",
                startSquare: move.substring(0, 2),
                endSquare: move.substring(2, 4),
                promotedTo: move.length > 4 ? move.substring(4, 5) : null
            };
            makeMove(moveData.startSquare, moveData.endSquare, moveData.promotedTo);
        }
    } else if (message.startsWith("info")) {
        const infoParts = message.split(" ");
        const scoreIndex = infoParts.indexOf("score");
        if (scoreIndex !== -1 && infoParts[scoreIndex + 1] === "cp") {
            evaluation = parseInt(infoParts[scoreIndex + 2]) / 100;
            updateEvaluationBar();
        }
    }
}

function setGameMode(mode) {
    gameMode = mode;
    gameModeSelectionDiv.style.display = 'none';
    if (gameMode === 'singlePlayer') {
        topContainer.style.display = 'flex';
        evaluationContainer.style.display = 'flex';
        joinDiv.style.display = 'none';
        gamePlayerInfo.style.display = 'none';
        playerInfo.style.display = 'none';
        gameContainer.style.display = 'flex';
        newGame();
    } else if (gameMode === 'multiplayer') {
        topContainer.style.display = 'none';
        evaluationContainer.style.display = 'none';
        joinDiv.style.display = 'flex';
        gamePlayerInfo.style.display = 'flex';
        playerInfo.style.display = 'flex';
        gameContainer.style.display = 'none';
    }
}

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

function newGame() {
    allowMovement = true;
    myColor = 'white';
    opponentColor = 'black';
    turnColor = 'white';
    game = new Chess();
    board = Chessboard('chessboard', {
        position: 'start',
        draggable: true,
        onDrop: onDrop,
        orientation: myColor
    });
    if (gameMode === 'singlePlayer') {
        stockfishWorker.postMessage(`position fen ${game.fen()}`);
        stockfishWorker.postMessage("go depth 15");
    }
    updateEvaluationBar();
}

function resignGame() {
    if (gameMode === 'multiplayer' && typeof ws !== 'undefined' && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resign', winner: opponentColor }));
    }
    showAlert(`${myColor} resigned. ${opponentColor} wins!`);
    allowMovement = false;
}

function onDrop(source, target) {
    if (!allowMovement) return 'snapback';

    const move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    if (move === null) return 'snapback';

    board.position(game.fen());
    turnColor = turnColor === 'white' ? 'black' : 'white';

    if (gameMode === 'singlePlayer') {
        stockfishWorker.postMessage(`position fen ${game.fen()}`);
        stockfishWorker.postMessage("go depth 15");
    } else if (gameMode === 'multiplayer' && typeof ws !== 'undefined' && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'move',
            startSquare: source,
            endSquare: target,
            promotedTo: move.promotion
        }));
    }

    if (game.in_checkmate()) {
        showAlert(`${turnColor === 'white' ? 'Black' : 'White'} wins by checkmate!`);
        allowMovement = false;
    } else if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
        showAlert("Game ended in a draw!");
        allowMovement = false;
    } else if (game.in_check()) {
        showAlert(`${turnColor === 'white' ? 'White' : 'Black'} is in check!`);
    }

    updateEvaluationBar();
    return 'snapback';
}

function handleSquareClick(event) {
    if (!allowMovement) return;

    const square = event.target.getAttribute('square');
    if (square) {
        const piece = game.get(square);
        if (piece && piece.color === myColor && turnColor === myColor) {
            const moves = game.moves({ square, verbose: true });
            if (moves.length > 0) {
                board.move('a1-a1'); // Temporary move to trigger redraw
                moves.forEach(move => {
                    const $square = $(`#chessboard .square-${move.to}`);
                    $square.addClass('highlight');
                });
            }
        }
    }
}

function makeMove(startSquare, endSquare, promotedTo) {
    if (!allowMovement) return;

    const move = game.move({
        from: startSquare,
        to: endSquare,
        promotion: promotedTo
    });

    if (move === null) return;

    board.position(game.fen());
    turnColor = turnColor === 'white' ? 'black' : 'white';

    if (gameMode === 'singlePlayer') {
        stockfishWorker.postMessage(`position fen ${game.fen()}`);
        stockfishWorker.postMessage("go depth 15");
    }

    if (game.in_checkmate()) {
        showAlert(`${turnColor === 'white' ? 'Black' : 'White'} wins by checkmate!`);
        allowMovement = false;
    } else if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
        showAlert("Game ended in a draw!");
        allowMovement = false;
    } else if (game.in_check()) {
        showAlert(`${turnColor === 'white' ? 'White' : 'Black'} is in check!`);
    }

    updateEvaluationBar();
}

function handlePromotion(event) {
    const promotedTo = event.target.getAttribute('data-piece');
    if (typeof ws !== 'undefined' && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'move',
            startSquare: promotionStartSquare,
            endSquare: promotionEndSquare,
            promotedTo: promotedTo
        }));
    }
    promotionOverlay.style.display = 'none';
    makeMove(promotionStartSquare, promotionEndSquare, promotedTo);
}

function showAlert(message) {
    alertMessage.textContent = message;
    alertDiv.style.display = 'flex';
}

function updateEvaluationBar() {
    if (evaluationContainer.style.display !== 'none') {
        evaluationText.textContent = `Evaluation: ${evaluation.toFixed(2)}`;
        const barWidth = Math.min(Math.max((evaluation + 5) / 10 * 100, 0), 100);
        evaluationBar.style.width = `${barWidth}%`;
        evaluationBar.style.backgroundColor = evaluation > 0 ? '#00ff00' : evaluation < 0 ? '#ff0000' : '#ffff00';
    }
}