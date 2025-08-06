// Global board state
let board = [];
let legalSquares = [];
let isWhiteTurn = true;
let enPassantTargetSquare = null;
let selectedSquare = null;
let selectedPiece = null;
let pawnPromotionTargetSquareId = null;
let isEngineWhite = false;
let selectedLevel = 10; // Default to max level

// Multiplayer state variables
let isMultiplayer = false;
let myColor = null;
let myUsername = null;
let turnColor = 'white';
let allowMovement = false;
let opponentUsername = null;
let ws = null;

// Castling flags
let hasWhiteKingMoved = false;
let hasBlackKingMoved = false;
let hasWhiteKingsideRookMoved = false;
let hasWhiteQueensideRookMoved = false;
let hasBlackKingsideRookMoved = false;
let hasBlackQueensideRookMoved = false;

// Global Stockfish worker instance
let stockfishWorker = null;
let evaluations = [];
let lines = [];
let scoreStrings = [];

// DOM element references
const chessBoard = document.querySelector('.chessBoard');
const boardSquares = document.getElementsByClassName('square');
const pieces = document.getElementsByClassName('piece');
const newGameBtn = document.getElementById("newGame");
const switchSidesBtn = document.getElementById("switchSides");
const levelSelect = document.getElementById("level");
const promotionOverlay = document.getElementById('promotion-overlay');
const promotionChoices = document.querySelector('.promotion-choices');
let evaluationElements = null;

// New DOM elements for mode selection and multiplayer
const modeSelectionContainer = document.getElementById('mode-selection-container');
const startSinglePlayerBtn = document.getElementById('start-single-player-btn');
const showMultiplayerLobbyBtn = document.getElementById('show-multiplayer-lobby-btn');
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.getElementById('game-container');
const usernameInput = document.getElementById('username');
const joinGameBtn = document.getElementById('join-game-btn');
const statusMessage = document.getElementById('status-message');
const playerList = document.getElementById('player-list');
const resignBtn = document.getElementById('resign-btn');
const turnIndicator = document.getElementById('turn-indicator');
const playerInfo = document.getElementById('player-info');
const singlePlayerElements = document.querySelectorAll('.level-select, #newGame, #switchSides');
const multiplayerElements = document.querySelectorAll('#resign-btn');

// Ensure DOM is fully loaded before setting up event listeners
document.addEventListener('DOMContentLoaded', (event) => {
    // Show mode selection screen initially
    modeSelectionContainer.classList.remove('hidden');
    gameContainer.classList.add('hidden');
    lobbyContainer.classList.add('hidden');

    // Initialize Stockfish worker only once
    initStockfishWorker();

    startSinglePlayerBtn.addEventListener('click', startSinglePlayerGame);
    showMultiplayerLobbyBtn.addEventListener('click', showMultiplayerLobby);
    joinGameBtn.addEventListener('click', joinGame);
    resignBtn.addEventListener('click', resignGame);

    // Add event listeners for single player buttons
    newGameBtn.addEventListener('click', newGame);
    switchSidesBtn.addEventListener('click', flipBoard);
    levelSelect.addEventListener('change', updateLevel);
    updateLevel(); // Set initial skill level for single player mode
});

/**
 * Initializes the Stockfish Web Worker.
 */
function initStockfishWorker() {
    try {
        // Assume the worker file is in the lib directory relative to the main page.
        stockfishWorker = new Worker("./lib/stockfish-nnue-16.js");
        stockfishWorker.postMessage("uci");
        stockfishWorker.postMessage("isready");
        stockfishWorker.postMessage("setoption name multipv value 3");
        console.log("Stockfish worker initialized successfully.");
    } catch (e) {
        console.error("Failed to initialize Stockfish worker:", e);
        showMessage("AI engine is unavailable. Playing against a human is still possible.");
    }
}

/**
 * Displays the multiplayer lobby and hides other screens.
 */
function showMultiplayerLobby() {
    isMultiplayer = true;
    modeSelectionContainer.classList.add('hidden');
    lobbyContainer.classList.remove('hidden');
}

/**
 * Starts a single-player game against the AI.
 */
function startSinglePlayerGame() {
    isMultiplayer = false;
    modeSelectionContainer.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    
    // Show single-player elements, hide multiplayer elements
    singlePlayerElements.forEach(el => el.classList.remove('hidden'));
    multiplayerElements.forEach(el => el.classList.add('hidden'));

    // Hide multiplayer player info and show single-player turn indicator
    playerInfo.style.display = 'none';
    turnIndicator.style.display = 'block';

    newGame();
    updateTurnIndicatorSinglePlayer();
}

/**
 * Handles joining a multiplayer game.
 */
function joinGame() {
    myUsername = usernameInput.value.trim();
    if (myUsername === "") {
        showMessage("Please enter a username.");
        return;
    }
    
    statusMessage.textContent = "Connecting...";
    ws = new WebSocket("ws://localhost:3000");

    ws.onopen = function() {
        console.log("WebSocket connection established.");
        ws.send(JSON.stringify({ type: "join", username: myUsername }));
        statusMessage.textContent = "Waiting for an opponent...";
    };

    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    ws.onclose = function() {
        console.log("WebSocket connection closed.");
        showMessage("Connection to server lost. Please refresh.");
        isMultiplayer = false;
        // Show mode selection screen on disconnect
        gameContainer.classList.add('hidden');
        lobbyContainer.classList.add('hidden');
        modeSelectionContainer.classList.remove('hidden');
    };

    ws.onerror = function(error) {
        console.error("WebSocket error:", error);
        showMessage("WebSocket error occurred. Please refresh.");
    };
}

/**
 * Handles all incoming WebSocket messages from the server.
 */
function handleWebSocketMessage(data) {
    switch (data.type) {
        case "playerList":
            // Update the list of players in the lobby
            playerList.innerHTML = '';
            data.players.forEach(p => {
                const li = document.createElement('li');
                li.textContent = p;
                playerList.appendChild(li);
            });
            if (data.players.length === 2) {
                statusMessage.textContent = "Game starting...";
            }
            break;
        case "color":
            // Game starts, assign color and show game board
            isMultiplayer = true;
            myColor = data.color;
            opponentUsername = data.opponent;
            
            lobbyContainer.classList.add('hidden');
            gameContainer.classList.remove('hidden');
            
            turnColor = 'white';
            allowMovement = myColor === turnColor;

            // Hide single-player elements, show multiplayer elements
            singlePlayerElements.forEach(el => el.classList.add('hidden'));
            multiplayerElements.forEach(el => el.classList.remove('hidden'));
            
            // Set up board for multiplayer
            newGame();
            if (myColor === 'black') {
                chessBoard.classList.add('flipped');
            } else {
                chessBoard.classList.remove('flipped');
            }
            
            playerInfo.style.display = 'block';
            turnIndicator.style.display = 'none';

            updateTurnIndicator();
            updatePlayerInfo();
            break;
        case "move":
            // An opponent's move
            performMove(data.startSquare, data.endSquare, data.promotedTo);
            break;
        case "resign":
            // Opponent resigned
            showMessage(`Your opponent has resigned! You win!`);
            allowMovement = false;
            break;
        case "error":
            showMessage(data.message);
            break;
    }
}

/**
 * Sends a move to the WebSocket server.
 */
function sendMoveToServer(startSquare, endSquare, promotedTo = '') {
    if (!isMultiplayer || !ws) return;
    ws.send(JSON.stringify({
        type: "move",
        startSquare: startSquare,
        endSquare: endSquare,
        promotedTo: promotedTo
    }));
}

/**
 * Handles the user resigning from a multiplayer game.
 */
function resignGame() {
    if (isMultiplayer && ws) {
        // use a custom modal instead of alert()
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <p>Are you sure you want to resign?</p>
                <div class="modal-buttons">
                    <button id="confirm-resign">Yes</button>
                    <button id="cancel-resign">No</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('confirm-resign').addEventListener('click', () => {
            ws.send(JSON.stringify({
                type: "resign",
                winner: myColor === 'white' ? 'black' : 'white'
            }));
            showMessage("You have resigned from the game.");
            allowMovement = false;
            modal.remove();
        });

        document.getElementById('cancel-resign').addEventListener('click', () => {
            modal.remove();
        });
    }
}

/**
 * Updates the engine's skill level based on the selected level.
 */
function updateLevel() {
    if (isMultiplayer) return;
    selectedLevel = parseInt(levelSelect.value, 10) || 10;
    const skillLevel = Math.round((selectedLevel - 1) * 2); // Map 1-10 to 0-20 skill levels
    if (stockfishWorker) {
        stockfishWorker.postMessage("setoption name Skill Level value " + skillLevel);
        stockfishWorker.postMessage("setoption name Contempt value 0"); // Neutral contempt for fairness
    }
}

/**
 * Initializes all the necessary global and state variables for a new game.
 */
function newGame() {
    const initialBoardHTML = `
        <div class="square white" id="a8"><div class="coordinate rank blackText">8</div><div class="piece rook" color="black"><img src="black-Rook.png" alt="Black Rook"></div></div>
        <div class="square black" id="b8"><div class="piece knight" color="black"><img src="black-Knight.png" alt="Black Knight"></div></div>
        <div class="square white" id="c8"><div class="piece bishop" color="black"><img src="black-Bishop.png" alt="Black Bishop"></div></div>
        <div class="square black" id="d8"><div class="piece queen" color="black"><img src="black-Queen.png" alt="Black Queen"></div></div>
        <div class="square white" id="e8"><div class="piece king" color="black"><img src="black-King.png" alt="Black King"></div></div>
        <div class="square black" id="f8"><div class="piece bishop" color="black"><img src="black-Bishop.png" alt="Black Bishop"></div></div>
        <div class="square white" id="g8"><div class="piece knight" color="black"><img src="black-Knight.png" alt="Black Knight"></div></div>
        <div class="square black" id="h8"><div class="piece rook" color="black"><img src="black-Rook.png" alt="Black Rook"></div></div>
        <div class="square black" id="a7"><div class="coordinate rank whiteText">7</div><div class="piece pawn" color="black"><img src="black-Pawn.png" alt="Black Pawn"></div></div>
        <div class="square white" id="b7"><div class="piece pawn" color="black"><img src="black-Pawn.png" alt="Black Pawn"></div></div>
        <div class="square black" id="c7"><div class="piece pawn" color="black"><img src="black-Pawn.png" alt="Black Pawn"></div></div>
        <div class="square white" id="d7"><div class="piece pawn" color="black"><img src="black-Pawn.png" alt="Black Pawn"></div></div>
        <div class="square black" id="e7"><div class="piece pawn" color="black"><img src="black-Pawn.png" alt="Black Pawn"></div></div>
        <div class="square white" id="f7"><div class="piece pawn" color="black"><img src="black-Pawn.png" alt="Black Pawn"></div></div>
        <div class="square black" id="g7"><div class="piece pawn" color="black"><img src="black-Pawn.png" alt="Black Pawn"></div></div>
        <div class="square white" id="h7"><div class="piece pawn" color="black"><img src="black-Pawn.png" alt="Black Pawn"></div></div>
        <div class="square white" id="a6"></div><div class="square black" id="b6"></div><div class="square white" id="c6"></div><div class="square black" id="d6"></div><div class="square white" id="e6"></div><div class="square black" id="f6"></div><div class="square white" id="g6"></div><div class="square black" id="h6"></div>
        <div class="square black" id="a5"></div><div class="square white" id="b5"></div><div class="square black" id="c5"></div><div class="square white" id="d5"></div><div class="square black" id="e5"></div><div class="square white" id="f5"></div><div class="square black" id="g5"></div><div class="square white" id="h5"></div>
        <div class="square white" id="a4"></div><div class="square black" id="b4"></div><div class="square white" id="c4"></div><div class="square black" id="d4"></div><div class="square white" id="e4"></div><div class="square black" id="f4"></div><div class="square white" id="g4"></div><div class="square black" id="h4"></div>
        <div class="square black" id="a3"></div><div class="square white" id="b3"></div><div class="square black" id="c3"></div><div class="square white" id="d3"></div><div class="square black" id="e3"></div><div class="square white" id="f3"></div><div class="square black" id="g3"></div><div class="square white" id="h3"></div>
        <div class="square white" id="a2"><div class="piece pawn" color="white"><img src="white-Pawn.png" alt="White Pawn"></div></div>
        <div class="square black" id="b2"><div class="piece pawn" color="white"><img src="white-Pawn.png" alt="White Pawn"></div></div>
        <div class="square white" id="c2"><div class="piece pawn" color="white"><img src="white-Pawn.png" alt="White Pawn"></div></div>
        <div class="square black" id="d2"><div class="piece pawn" color="white"><img src="white-Pawn.png" alt="White Pawn"></div></div>
        <div class="square white" id="e2"><div class="piece pawn" color="white"><img src="white-Pawn.png" alt="White Pawn"></div></div>
        <div class="square black" id="f2"><div class="piece pawn" color="white"><img src="white-Pawn.png" alt="White Pawn"></div></div>
        <div class="square white" id="g2"><div class="piece pawn" color="white"><img src="white-Pawn.png" alt="White Pawn"></div></div>
        <div class="square black" id="h2"><div class="coordinate rank whiteText">2</div><div class="piece pawn" color="white"><img src="white-Pawn.png" alt="White Pawn"></div></div>
        <div class="square black" id="a1"><div class="coordinate file whiteText">a</div><div class="piece rook" color="white"><img src="white-Rook.png" alt="White Rook"></div></div>
        <div class="square white" id="b1"><div class="coordinate file blackText">b</div><div class="piece knight" color="white"><img src="white-Knight.png" alt="White Knight"></div></div>
        <div class="square black" id="c1"><div class="coordinate file whiteText">c</div><div class="piece bishop" color="white"><img src="white-Bishop.png" alt="White Bishop"></div></div>
        <div class="square white" id="d1"><div class="coordinate file blackText">d</div><div class="piece queen" color="white"><img src="white-Queen.png" alt="White Queen"></div></div>
        <div class="square black" id="e1"><div class="coordinate file whiteText">e</div><div class="piece king" color="white"><img src="white-King.png" alt="White King"></div></div>
        <div class="square white" id="f1"><div class="coordinate file blackText">f</div><div class="piece bishop" color="white"><img src="white-Bishop.png" alt="White Bishop"></div></div>
        <div class="square black" id="g1"><div class="coordinate file whiteText">g</div><div class="piece knight" color="white"><img src="white-Knight.png" alt="White Knight"></div></div>
        <div class="square white" id="h1"><div class="coordinate file blackText">h</div><div class="coordinate rank blackText">1</div><div class="piece rook" color="white"><img src="white-Rook.png" alt="White Rook"></div></div>
    `;

    chessBoard.innerHTML = initialBoardHTML;
    board = [];
    legalSquares = [];
    isWhiteTurn = true;
    enPassantTargetSquare = null;
    selectedSquare = null;
    selectedPiece = null;
    pawnPromotionTargetSquareId = null;
    isEngineWhite = false;
    hasWhiteKingMoved = false;
    hasBlackKingMoved = false;
    hasWhiteKingsideRookMoved = false;
    hasWhiteQueensideRookMoved = false;
    hasBlackKingsideRookMoved = false;
    hasBlackQueensideRookMoved = false;

    setupBoardSquares();
    initializeBoardState();
    setupPieces();
    renderBoard();

    if (!isMultiplayer) {
        updateLevel(); // Reapply the current skill level if single player
        updateTurnIndicatorSinglePlayer();
        const currentFEN = generateFEN(board);
        getEvaluation(currentFEN, displayEvaluation);
    }
}

/**
 * Flips the board and switches sides for the AI opponent.
 */
function flipBoard() {
    if (isMultiplayer) return; // Disable in multiplayer
    chessBoard.classList.toggle('flipped');
    isEngineWhite = !isEngineWhite;
    newGame(); // Reset the board and turn
    updateTurnIndicatorSinglePlayer();
    renderBoard();
}

/**
 * Sets up event listeners and IDs for each square on the chessboard.
 */
function setupBoardSquares() {
    const allBoardSquares = document.querySelectorAll('.chessBoard > .square');
    for (let i = 0; i < allBoardSquares.length; i++) {
        allBoardSquares[i].addEventListener('dragover', allowDrop);
        allBoardSquares[i].addEventListener('drop', drop);
        allBoardSquares[i].addEventListener('click', selectSquare);

        let row = 8 - Math.floor(i / 8);
        let column = String.fromCharCode(97 + (i % 8));
        allBoardSquares[i].id = column + row;
    }
}

/**
 * Sets up draggable attribute and IDs for each piece.
 */
function setupPieces() {
    const allPieces = document.getElementsByClassName('piece');
    for (let i = 0; i < allPieces.length; i++) {
        allPieces[i].removeEventListener('dragstart', drag);
        allPieces[i].addEventListener('dragstart', drag);
        allPieces[i].setAttribute('draggable', true);
        allPieces[i].id = allPieces[i].classList[1] + "-" + allPieces[i].parentElement.id;
    }
    const currentPieceImages = document.getElementsByTagName("img");
    for (let i = 0; i < currentPieceImages.length; i++) {
        currentPieceImages[i].setAttribute('draggable', false);
    }
}

/**
 * Helper to convert square ID (e.g., "a1") to board indices [row, col].
 */
function squareIdToCoords(squareId) {
    const file = squareId.charCodeAt(0) - 97;
    const rank = parseInt(squareId.charAt(1));
    const rowIndex = 8 - rank;
    const colIndex = file;
    return [rowIndex, colIndex];
}

/**
 * Helper to convert board indices [row, col] to square ID (e.g., "a1").
 */
function coordsToSquareId(rowIndex, colIndex) {
    const fileChar = String.fromCharCode(97 + colIndex);
    const rankNum = 8 - rowIndex;
    return fileChar + rankNum;
}

/**
 * Initializes the internal board state based on the current HTML.
 */
function initializeBoardState() {
    board = Array(8).fill(null).map(() => Array(8).fill(null));
    const allBoardSquares = document.querySelectorAll('.chessBoard > .square');
    for (let i = 0; i < allBoardSquares.length; i++) {
        const squareElement = allBoardSquares[i];
        const [row, col] = squareIdToCoords(squareElement.id);
        const pieceElement = squareElement.querySelector('.piece');
        if (pieceElement) {
            board[row][col] = {
                type: pieceElement.classList[1],
                color: pieceElement.getAttribute('color')
            };
        }
    }
    hasWhiteKingMoved = false;
    hasBlackKingMoved = false;
    hasWhiteKingsideRookMoved = false;
    hasWhiteQueensideRookMoved = false;
    hasBlackKingsideRookMoved = false;
    hasBlackQueensideRookMoved = false;
    enPassantTargetSquare = null;
}

/**
 * Updates the DOM to reflect the internal board state.
 */
function renderBoard() {
    const chessBoard = document.querySelector('.chessBoard');
    const existingCoordinates = chessBoard.querySelectorAll('.coordinate');
    
    const coordinatesMap = {};
    existingCoordinates.forEach(coord => {
      const square = coord.parentElement;
      if (!coordinatesMap[square.id]) {
        coordinatesMap[square.id] = [];
      }
      coordinatesMap[square.id].push(coord.outerHTML);
    });

    const allBoardSquares = document.querySelectorAll('.chessBoard > .square');
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const squareId = coordsToSquareId(r, c);
            const squareElement = document.getElementById(squareId);
            
            while (squareElement.firstChild) {
                squareElement.removeChild(squareElement.firstChild);
            }

            if (coordinatesMap[squareId]) {
                coordinatesMap[squareId].forEach(coordHTML => {
                    squareElement.insertAdjacentHTML('beforeend', coordHTML);
                });
            }

            const piece = board[r][c];
            if (piece) {
                const pieceDiv = document.createElement('div');
                pieceDiv.classList.add('piece', piece.type);
                pieceDiv.setAttribute('color', piece.color);
                pieceDiv.id = piece.type + "-" + squareId;
                pieceDiv.setAttribute('draggable', true);

                const pieceImg = document.createElement('img');
                pieceImg.src = `${piece.color}-${piece.type.charAt(0).toUpperCase() + piece.type.slice(1)}.png`;
                pieceImg.alt = `${piece.color} ${piece.type}`;
                pieceImg.setAttribute('draggable', false);

                pieceDiv.appendChild(pieceImg);
                squareElement.appendChild(pieceDiv);
            }
        }
    }
    setupPieces();
}

/**
 * Handles the click-to-move logic.
 */
function selectSquare(event) {
    const clickedSquare = event.currentTarget;
    const pieceOnSquare = clickedSquare.querySelector('.piece');
    const clickedSquareId = clickedSquare.id;

    let turnPlayerColor = isMultiplayer ? turnColor : (isWhiteTurn ? 'white' : 'black');

    if (selectedPiece) {
        const originalSquareId = selectedPiece.parentElement.id;
        if (legalSquares.includes(clickedSquareId)) {
            performMove(originalSquareId, clickedSquareId);
            selectedPiece = null;
            legalSquares.length = 0;
        } else {
            selectedPiece = null;
            legalSquares.length = 0;
        }
    } else if (pieceOnSquare) {
        const pieceColor = pieceOnSquare.getAttribute("color");
        const isPlayerTurn = isMultiplayer ? (myColor === turnPlayerColor) :
                             (isWhiteTurn && !isEngineWhite) || (!isWhiteTurn && isEngineWhite);
                             
        if (isPlayerTurn && ((turnPlayerColor === "white" && pieceColor === "white") || (turnPlayerColor === "black" && pieceColor === "black"))) {
            selectedPiece = pieceOnSquare;
            legalSquares = getLegalMovesForPiece(clickedSquareId, pieceOnSquare);
        }
    }
}

/**
 * Allows a drop operation to occur on a valid drop target.
 */
function allowDrop(event) {
    event.preventDefault();
}

/**
 * Handles the start of a drag operation for a chess piece.
 */
function drag(ev) {
    const piece = ev.target.closest('.piece');
    if (!piece) return;
    const pieceColor = piece.getAttribute("color");

    let turnPlayerColor = isMultiplayer ? turnColor : (isWhiteTurn ? 'white' : 'black');

    const isPlayerTurn = isMultiplayer ? (myColor === turnPlayerColor) :
                         (isWhiteTurn && !isEngineWhite) || (!isWhiteTurn && isEngineWhite);

    if (isPlayerTurn && ((turnPlayerColor === "white" && pieceColor === "white") || (turnPlayerColor === "black" && pieceColor === "black"))) {
        selectedPiece = piece;
        ev.dataTransfer.setData("text", piece.id);
        const startingSquareId = piece.parentNode.id;
        legalSquares = getLegalMovesForPiece(startingSquareId, piece);
    } else {
        ev.preventDefault();
    }
}

/**
 * Handles the drop of a piece onto a square.
 */
function drop(ev) {
    ev.preventDefault();
    const data = ev.dataTransfer.getData("text");
    const pieceElement = document.getElementById(data);
    const destinationSquare = ev.currentTarget;
    const destinationSquareId = destinationSquare.id;
    const originalSquareId = pieceElement.parentNode.id;

    if (legalSquares.includes(destinationSquareId)) {
        performMove(originalSquareId, destinationSquareId);
        selectedPiece = null;
        legalSquares.length = 0;
    } else {
        console.log("Illegal move!");
        legalSquares.length = 0;
    }
}

/**
 * Helper function to perform a move based on a move string (e.g., 'e2e4').
 */
function playBestMove(bestMove) {
    if (!bestMove || bestMove === '(none)') {
        console.log("Engine returned no move.");
        return;
    }
    const startingSquareId = bestMove.substring(0, 2);
    const destinationSquareId = bestMove.substring(2, 4);
    let promotedTo = "";
    if (bestMove.length === 5) {
        promotedTo = bestMove.substring(4, 5);
        let pieceMap = { "q": "queen", "r": "rook", "b": "bishop", "n": "knight" };
        promotedTo = pieceMap[promotedTo];
    }
    performMove(startingSquareId, destinationSquareId, promotedTo);
}

/**
 * Performs the actual move on the internal board state and updates the DOM.
 */
function performMove(startingSquareId, destinationSquareId, promotedTo = "") {
    const [fromRow, fromCol] = squareIdToCoords(startingSquareId);
    const [toRow, toCol] = squareIdToCoords(destinationSquareId);

    const piece = board[fromRow][fromCol];
    if (!piece) return;

    const pieceType = piece.type;
    const pieceColor = piece.color;
    const prevEnPassantTargetSquare = enPassantTargetSquare;

    if (pieceType === 'king' && Math.abs(fromCol - toCol) === 2) {
        let rookFromCol, rookToCol;
        if (toCol === 6) { rookFromCol = 7; rookToCol = 5; }
        else if (toCol === 2) { rookFromCol = 0; rookToCol = 3; }
        board[toRow][toCol] = board[fromRow][fromCol];
        board[fromRow][fromCol] = null;
        board[toRow][rookToCol] = board[toRow][rookFromCol];
        board[toRow][rookFromCol] = null;
        if (pieceColor === 'white') {
            hasWhiteKingMoved = true;
            if (rookFromCol === 7) hasWhiteKingsideRookMoved = true;
            else if (rookFromCol === 0) hasWhiteQueensideRookMoved = true;
        } else {
            hasBlackKingMoved = true;
            if (rookFromCol === 7) hasBlackKingsideRookMoved = true;
            else if (rookFromCol === 0) hasBlackQueensideRookMoved = true;
        }
    } 
    else if (pieceType === 'pawn' && destinationSquareId === prevEnPassantTargetSquare) {
        const capturedPawnRow = fromRow;
        const capturedPawnCol = toCol;
        board[capturedPawnRow][capturedPawnCol] = null;
        board[toRow][toCol] = board[fromRow][fromCol];
        board[fromRow][fromCol] = null;
    } 
    else if (pieceType === 'pawn' && (toRow === 0 || toRow === 7) && promotedTo !== "") {
        board[toRow][toCol] = { type: promotedTo, color: pieceColor };
        board[fromRow][fromCol] = null;
    }
    else {
        board[toRow][toCol] = board[fromRow][fromCol];
        board[fromRow][fromCol] = null;
        if (pieceType === 'king') {
            if (pieceColor === 'white') hasWhiteKingMoved = true;
            else hasBlackKingMoved = true;
        } else if (pieceType === 'rook') {
            if (pieceColor === 'white') {
                if (fromCol === 7 && fromRow === 7) hasWhiteKingsideRookMoved = true;
                else if (fromCol === 0 && fromRow === 7) hasWhiteQueensideRookMoved = true;
            } else {
                if (fromCol === 7 && fromRow === 0) hasBlackKingsideRookMoved = true;
                else if (fromCol === 0 && fromRow === 0) hasBlackQueensideRookMoved = true;
            }
        }
    }

    if (pieceType === 'pawn' && Math.abs(fromRow - toRow) === 2) {
        enPassantTargetSquare = coordsToSquareId(fromRow + (toRow - fromRow) / 2, toCol);
    } else {
        enPassantTargetSquare = null;
    }

    renderBoard();
    
    // Check for pawn promotion
    if (pieceType === 'pawn' && (toRow === 0 || toRow === 7) && !promotedTo) {
        pawnPromotionTargetSquareId = destinationSquareId;
        showPromotionUI(pieceColor);
        return;
    }

    finalizeMove(startingSquareId, destinationSquareId, promotedTo);
}

/**
 * Checks if a square is occupied and by what color on the internal board.
 */
function isSquareOccupied(rowIndex, colIndex, boardState = board) {
    if (rowIndex < 0 || rowIndex > 7 || colIndex < 0 || colIndex > 7) {
        return "out-of-bounds";
    }
    const piece = boardState[rowIndex][colIndex];
    return piece ? piece.color : "blank";
}

/**
 * Simulates a move on a temporary board state.
 */
function simulateMove(fromRow, fromCol, toRow, toCol, currentBoard, isEnPassantCapture = false) {
    const simulatedBoard = currentBoard.map(row => row.slice());
    const piece = simulatedBoard[fromRow][fromCol];
    simulatedBoard[toRow][toCol] = piece;
    simulatedBoard[fromRow][fromCol] = null;
    if (isEnPassantCapture) {
        const capturedPawnRow = fromRow;
        const capturedPawnCol = toCol;
        simulatedBoard[capturedPawnRow][capturedPawnCol] = null;
    }
    return simulatedBoard;
}

/**
 * Finds the king's position for a given color on a board state.
 */
function findKing(kingColor, boardState) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece && piece.type === 'king' && piece.color === kingColor) {
                return [r, c];
            }
        }
    }
    return null;
}

/**
 * Checks if a king of a given color is in check on a specific board state.
 */
function isKingInCheck(kingColor, boardState) {
    const kingCoords = findKing(kingColor, boardState);
    if (!kingCoords) return false;
    const [kingRow, kingCol] = kingCoords;
    const opponentColor = kingColor === 'white' ? 'black' : 'white';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece && piece.color === opponentColor) {
                const pseudoLegalMoves = getPseudoLegalMoves(r, c, piece.type, piece.color, boardState, true);
                if (pseudoLegalMoves.some(move => move[0] === kingRow && move[1] === kingCol)) {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * Calculates all pseudo-legal moves for a piece (moves according to piece rules).
 */
function getPseudoLegalMoves(startRow, startCol, pieceType, pieceColor, boardState, forCheckValidation = false) {
    let moves = [];
    const addMove = (r, c) => {
        if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
            moves.push([r, c]);
        }
    };
    const checkAndAddSlidingMove = (r, c) => {
        if (r < 0 || r > 7 || c < 0 || c > 7) return 'stop';
        const targetContent = isSquareOccupied(r, c, boardState);
        if (targetContent === 'blank') {
            addMove(r, c);
            return 'continue';
        } else if (targetContent !== pieceColor) {
            addMove(r, c);
            return 'stop';
        } else {
            return 'stop';
        }
    };
    switch (pieceType) {
        case 'pawn':
            const direction = (pieceColor === "white") ? -1 : 1;
            const startRankRow = (pieceColor === "white") ? 6 : 1;
            const enPassantRank = (pieceColor === "white") ? 3 : 4;
            let nextRow = startRow + direction;
            if (isSquareOccupied(nextRow, startCol, boardState) === "blank") {
                addMove(nextRow, startCol);
                if (startRow === startRankRow) {
                    let twoStepsRow = startRow + (2 * direction);
                    if (isSquareOccupied(twoStepsRow, startCol, boardState) === "blank") {
                        addMove(twoStepsRow, startCol);
                    }
                }
            }
            const captureCols = [startCol - 1, startCol + 1];
            for (const c of captureCols) {
                const targetContent = isSquareOccupied(nextRow, c, boardState);
                if (targetContent !== "blank" && targetContent !== pieceColor) {
                    addMove(nextRow, c);
                }
            }
            if (startRow === enPassantRank && enPassantTargetSquare !== null) {
                for (const c of captureCols) {
                    const targetSquareId = coordsToSquareId(nextRow, c);
                    if (targetSquareId === enPassantTargetSquare) {
                        const pawnBesideRow = startRow;
                        const pawnBesideCol = c;
                        const pieceBeside = boardState[pawnBesideRow][pawnBesideCol];
                        if (pieceBeside && pieceBeside.type === 'pawn' && pieceBeside.color !== pieceColor) {
                            addMove(nextRow, c);
                        }
                    }
                }
            }
            break;
        case 'knight':
            const knightMoves = [
                [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                [1, -2], [1, 2], [2, -1], [2, 1]
            ];
            knightMoves.forEach(([dr, dc]) => {
                const newRow = startRow + dr;
                const newCol = startCol + dc;
                const targetContent = isSquareOccupied(newRow, newCol, boardState);
                if (targetContent === "blank" || targetContent !== pieceColor) {
                    addMove(newRow, newCol);
                }
            });
            break;
        case 'rook':
            const rookDirections = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            rookDirections.forEach(([dr, dc]) => {
                for (let i = 1; i < 8; i++) {
                    const newRow = startRow + dr * i;
                    const newCol = startCol + dc * i;
                    const result = checkAndAddSlidingMove(newRow, newCol);
                    if (result === 'stop') break;
                }
            });
            break;
        case 'bishop':
            const bishopDirections = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
            bishopDirections.forEach(([dr, dc]) => {
                for (let i = 1; i < 8; i++) {
                    const newRow = startRow + dr * i;
                    const newCol = startCol + dc * i;
                    const result = checkAndAddSlidingMove(newRow, newCol);
                    if (result === 'stop') break;
                }
            });
            break;
        case 'queen':
            const queenDirections = [
                [-1, 0], [1, 0], [0, -1], [0, 1],
                [-1, -1], [-1, 1], [1, -1], [1, 1]
            ];
            queenDirections.forEach(([dr, dc]) => {
                for (let i = 1; i < 8; i++) {
                    const newRow = startRow + dr * i;
                    const newCol = startCol + dc * i;
                    const result = checkAndAddSlidingMove(newRow, newCol);
                    if (result === 'stop') break;
                }
            });
            break;
        case 'king':
            const kingMoves = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            kingMoves.forEach(([dr, dc]) => {
                const newRow = startRow + dr;
                const newCol = startCol + dc;
                const targetContent = isSquareOccupied(newRow, newCol, boardState);
                if (targetContent === "blank" || targetContent !== pieceColor) {
                    addMove(newRow, newCol);
                }
            });
            const kingRow = (pieceColor === 'white') ? 7 : 0;
            const kingMovedFlag = (pieceColor === 'white') ? hasWhiteKingMoved : hasBlackKingMoved;
            if (!kingMovedFlag && startRow === kingRow && startCol === 4) {
                const kingsideRookMovedFlag = (pieceColor === 'white') ? hasWhiteKingsideRookMoved : hasBlackKingsideRookMoved;
                const kingsideRookCol = 7;
                if (!kingsideRookMovedFlag && boardState[kingRow][5] === null && boardState[kingRow][6] === null &&
                    boardState[kingRow][kingsideRookCol] && boardState[kingRow][kingsideRookCol].type === 'rook' && boardState[kingRow][kingsideRookCol].color === pieceColor) {
                    const pathClearAndSafe =
                        !isKingInCheck(pieceColor, boardState) &&
                        !isKingInCheck(pieceColor, simulateMove(kingRow, 4, kingRow, 5, boardState)) &&
                        !isKingInCheck(pieceColor, simulateMove(kingRow, 4, kingRow, 6, boardState));
                    if (pathClearAndSafe) {
                        addMove(kingRow, 6);
                    }
                }
                const queensideRookMovedFlag = (pieceColor === 'white') ? hasWhiteQueensideRookMoved : hasBlackQueensideRookMoved;
                const queensideRookCol = 0;
                if (!queensideRookMovedFlag && boardState[kingRow][1] === null && boardState[kingRow][2] === null && boardState[kingRow][3] === null &&
                    boardState[kingRow][queensideRookCol] && boardState[kingRow][queensideRookCol].type === 'rook' && boardState[kingRow][queensideRookCol].color === pieceColor) {
                    const pathClearAndSafe =
                        !isKingInCheck(pieceColor, boardState) &&
                        !isKingInCheck(pieceColor, simulateMove(kingRow, 4, kingRow, 3, boardState)) &&
                        !isKingInCheck(pieceColor, simulateMove(kingRow, 4, kingRow, 2, boardState));
                    if (pathClearAndSafe) {
                        addMove(kingRow, 2);
                    }
                }
            }
            break;
    }
    return moves;
}

/**
 * Generates and filters legal moves for a piece, ensuring the king is not left in check.
 */
function getLegalMovesForPiece(startSquareId, pieceElement) {
    const [startRow, startCol] = squareIdToCoords(startSquareId);
    const pieceType = pieceElement.classList[1];
    const pieceColor = pieceElement.getAttribute('color');
    const pseudoLegalMoves = getPseudoLegalMoves(startRow, startCol, pieceType, pieceColor, board);
    let filteredLegalMoves = [];
    for (const [toRow, toCol] of pseudoLegalMoves) {
        let simulatedBoard;
        let isEnPassantCapture = false;
        if (pieceType === 'pawn' && coordsToSquareId(toRow, toCol) === enPassantTargetSquare) {
            const pawnBesideRow = startRow;
            const pawnBesideCol = toCol;
            const pieceBeside = board[pawnBesideRow][pawnBesideCol];
            if (pieceBeside && pieceBeside.type === 'pawn' && pieceBeside.color !== pieceColor) {
                isEnPassantCapture = true;
            }
        }
        simulatedBoard = simulateMove(startRow, startCol, toRow, toCol, board, isEnPassantCapture);
        if (!isKingInCheck(pieceColor, simulatedBoard)) {
            filteredLegalMoves.push(coordsToSquareId(toRow, toCol));
        }
    }
    return filteredLegalMoves;
}

/**
 * Checks the current game status (check, checkmate, stalemate).
 */
function checkGameStatus() {
    const currentPlayerColor = isMultiplayer ? turnColor : (isWhiteTurn ? 'white' : 'black');
    const opponentPlayerColor = currentPlayerColor === 'white' ? 'black' : 'white';
    const kingInCheck = isKingInCheck(currentPlayerColor, board);
    let hasLegalMoves = false;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === currentPlayerColor) {
                const pieceSquareId = coordsToSquareId(r, c);
                const dummyPieceElement = {
                    classList: [null, piece.type],
                    getAttribute: (attr) => attr === 'color' ? piece.color : null
                };
                const legalMovesForThisPiece = getLegalMovesForPiece(pieceSquareId, dummyPieceElement);
                if (legalMovesForThisPiece.length > 0) {
                    hasLegalMoves = true;
                    break;
                }
            }
        }
        if (hasLegalMoves) break;
    }
    if (kingInCheck && !hasLegalMoves) {
        showMessage(`Checkmate! ${opponentPlayerColor.toUpperCase()} wins!`);
        allowMovement = false; // End the game
    } else if (!kingInCheck && !hasLegalMoves) {
        showMessage("Stalemate! It's a draw.");
        allowMovement = false; // End the game
    } else if (kingInCheck) {
        showMessage(`${currentPlayerColor.toUpperCase()} is in check!`);
    } else {
        clearMessage();
    }
}

/**
 * Displays a message box on the screen.
 */
function showMessage(msg) {
    let messageBox = document.getElementById('message-box');
    if (!messageBox) {
        messageBox = document.createElement('div');
        messageBox.id = 'message-box';
        Object.assign(messageBox.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#333',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            zIndex: '1000',
            fontSize: '1.2em',
            textAlign: 'center',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
        });
        document.body.appendChild(messageBox);
    }
    messageBox.textContent = msg;
    messageBox.style.display = 'block';
}

/**
 * Hides the message box.
 */
function clearMessage() {
    const messageBox = document.getElementById('message-box');
    if (messageBox) {
        messageBox.style.display = 'none';
    }
}

/**
 * Shows the pawn promotion UI.
 */
function showPromotionUI(pawnColor) {
    promotionChoices.innerHTML = '';
    const promotionPieces = ['queen', 'rook', 'bishop', 'knight'];
    promotionPieces.forEach(pieceType => {
        const choiceDiv = document.createElement('div');
        choiceDiv.classList.add('promotion-choice');
        choiceDiv.dataset.pieceType = pieceType;
        choiceDiv.addEventListener('click', () => selectPromotionPiece(pieceType, pawnColor));
        const pieceImg = document.createElement('img');
        pieceImg.src = `${pawnColor}-${pieceType.charAt(0).toUpperCase() + pieceType.slice(1)}.png`;
        pieceImg.alt = `${pawnColor} ${pieceType}`;
        choiceDiv.appendChild(pieceImg);
        promotionChoices.appendChild(choiceDiv);
    });
    promotionOverlay.classList.add('active');
}

/**
 * Handles the selection of a promotion piece.
 */
function selectPromotionPiece(selectedType, pawnColor) {
    promotionOverlay.classList.remove('active');
    const [row, col] = squareIdToCoords(pawnPromotionTargetSquareId);
    board[row][col] = {
        type: selectedType,
        color: pawnColor
    };
    renderBoard();
    
    // In multiplayer, send the move with promotion info
    if (isMultiplayer) {
        sendMoveToServer(selectedPiece.parentElement.id, pawnPromotionTargetSquareId, selectedType.charAt(0));
    }
    
    pawnPromotionTargetSquareId = null;
    finalizeMove();
}

/**
 * Finalizes a move: toggles turn, clears legal squares, checks game status, and updates evaluation.
 */
function finalizeMove(startSquare, endSquare, promotedTo = '') {
    // Multiplayer logic
    if (isMultiplayer) {
        // Send the move to the server if it's our turn
        if (myColor === turnColor) {
            sendMoveToServer(startSquare, endSquare, promotedTo);
        }
        
        turnColor = turnColor === 'white' ? 'black' : 'white';
        allowMovement = myColor === turnColor;
        updateTurnIndicator();
        checkGameStatus();
        
    } else {
        // Single player logic
        isWhiteTurn = !isWhiteTurn;
        legalSquares.length = 0;
        checkGameStatus();
        const currentFEN = generateFEN(board);
        getEvaluation(currentFEN, displayEvaluation);

        const isEngineTurn = (isEngineWhite && isWhiteTurn) || (!isEngineWhite && !isWhiteTurn);
        if (isEngineTurn) {
            getBestMove(currentFEN, playBestMove);
        }
        updateTurnIndicatorSinglePlayer();
    }
}

/**
 * Updates the turn indicator on the UI.
 */
function updateTurnIndicator() {
    turnIndicator.textContent = `${turnColor.charAt(0).toUpperCase() + turnColor.slice(1)}'s Turn`;
    document.body.style.backgroundColor = turnColor === 'white' ? '#f0f0f0' : '#333';
}

/**
 * Updates the turn indicator and other info for single player games.
 */
function updateTurnIndicatorSinglePlayer() {
    if (isMultiplayer) return;
    const playerColor = isEngineWhite ? 'black' : 'white';
    const turnColor = isWhiteTurn ? 'white' : 'black';
    const turnText = `${turnColor.charAt(0).toUpperCase() + turnColor.slice(1)}'s Turn`;
    
    turnIndicator.textContent = turnText;
    turnIndicator.style.color = (turnColor === 'white') ? 'black' : 'white';
    document.body.style.backgroundColor = turnColor === 'white' ? '#f0f0f0' : '#333';

    // Show AI status in the player info section
    const userColor = isEngineWhite ? 'white' : 'black';
    playerInfo.textContent = `You are playing as ${userColor.charAt(0).toUpperCase() + userColor.slice(1)} vs AI`;
    playerInfo.style.display = 'block';
}

/**
 * Generates a FEN (Forsyth-Edwards Notation) string from the current board state.
 */
function generateFEN(boardState) {
    let fen = '';
    for (let r = 0; r < 8; r++) {
        let emptyCount = 0;
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece === null) {
                emptyCount++;
            } else {
                if (emptyCount > 0) {
                    fen += emptyCount;
                    emptyCount = 0;
                }
                let pieceChar = '';
                switch (piece.type) {
                    case 'pawn': pieceChar = 'p'; break;
                    case 'knight': pieceChar = 'n'; break;
                    case 'bishop': pieceChar = 'b'; break;
                    case 'rook': pieceChar = 'r'; break;
                    case 'queen': pieceChar = 'q'; break;
                    case 'king': pieceChar = 'k'; break;
                }
                fen += (piece.color === 'white' ? pieceChar.toUpperCase() : pieceChar);
            }
        }
        if (emptyCount > 0) {
            fen += emptyCount;
        }
        if (r < 7) {
            fen += '/';
        }
    }
    fen += ' ' + (isWhiteTurn ? 'w' : 'b');
    let castling = '';
    if (!hasWhiteKingMoved) {
        if (!hasWhiteKingsideRookMoved) castling += 'K';
        if (!hasWhiteQueensideRookMoved) castling += 'Q';
    }
    if (!hasBlackKingMoved) {
        if (!hasBlackKingsideRookMoved) castling += 'k';
        if (!hasBlackQueensideRookMoved) castling += 'q';
    }
    fen += ' ' + (castling === '' ? '-' : castling);
    fen += ' ' + (enPassantTargetSquare || '-');
    fen += ' 0 1';
    return fen;
}

/**
 * Gets the best move from Stockfish engine based on the current board state.
 */
function getBestMove(fen, callback) {
    if (isMultiplayer || !stockfishWorker) {
        if (!stockfishWorker) showMessage("AI engine is unavailable.");
        return;
    }
    stockfishWorker.postMessage("position fen " + fen);
    const depth = Math.max(1, Math.min(20, selectedLevel * 2)); // Dynamic depth based on level
    stockfishWorker.postMessage(`go depth ${depth}`);
    const listener = function(event) {
        const message = event.data;
        if (message.startsWith("bestmove")) {
            const bestMove = message.split(" ")[1];
            stockfishWorker.removeEventListener('message', listener);
            callback(bestMove);
        }
    };
    stockfishWorker.addEventListener('message', listener);
}

/**
 * Gets evaluation from Stockfish worker.
 */
function getEvaluation(fen, callback) {
    if (isMultiplayer || !stockfishWorker) {
        if (!stockfishWorker) {
            updateEvaluationBar(0, "0");
            updateEvaluationLines([], []);
            updateEvaluationText(0, "0");
        }
        return;
    }
    stockfishWorker.postMessage("ucinewgame");
    stockfishWorker.postMessage("position fen " + fen);
    stockfishWorker.postMessage("go depth 10"); // Fixed depth for evaluation
    const listener = function(event) {
        const message = event.data;
        if (message.startsWith("info")) {
            // Process evaluation output from Stockfish
            let multipvIndex = message.indexOf("multipv");
            if (multipvIndex !== -1) {
                let multipv = parseInt(message.slice(multipvIndex).split(" ")[1]) || 1;
                while (evaluations.length < 3) evaluations.push(null);
                while (lines.length < 3) lines.push("");
                while (scoreStrings.length < 3) scoreStrings.push(null);

                let scoreIndex = message.indexOf("score cp");
                let pvIndex = message.indexOf("pv");
                if (scoreIndex !== -1) {
                    scoreStrings[multipv - 1] = message.slice(scoreIndex).split(" ")[2] || "0";
                    let evaluation = parseInt(scoreStrings[multipv - 1]) / 100 || 0;
                    evaluation = isWhiteTurn ? evaluation : -evaluation;
                    evaluations[multipv - 1] = evaluation;
                } else {
                    scoreIndex = message.indexOf("score mate");
                    scoreStrings[multipv - 1] = message.slice(scoreIndex).split(" ")[2] || "0";
                    let evaluation = parseInt(scoreStrings[multipv - 1]) || 0;
                    evaluations[multipv - 1] = "#" + Math.abs(evaluation);
                }
                if (pvIndex !== -1) {
                    let pvString = message.slice(pvIndex + 3).trim();
                    lines[multipv - 1] = pvString;
                }
                if (multipv === 3) {
                    callback(lines, evaluations, scoreStrings);
                    evaluations = [];
                    lines = [];
                    scoreStrings = [];
                    stockfishWorker.removeEventListener('message', listener);
                }
            }
        }
    };
    stockfishWorker.addEventListener('message', listener);
}

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

function displayEvaluation(lines, evaluations, scoreString) {
    if (isMultiplayer) return; // Disable in multiplayer
    if (!evaluationElements) {
        initializeEvaluationElements();
    }
    if (!Array.isArray(evaluations) || evaluations.length === 0) {
        return false;
    }
    try {
        let evaluation = evaluations[0];
        if (evaluation === null || evaluation === undefined) {
            evaluation = 0;
        }
        scoreString = (typeof scoreString === 'string') ? scoreString.trim() : '0';
        if (!scoreString) scoreString = '0';
        updateEvaluationBar(evaluation, scoreString);
        updateEvaluationLines(lines, evaluations);
        updateEvaluationText(evaluation, scoreString);
        return true;
    } catch (error) {
        console.error("Error in displayEvaluation:", error);
        return false;
    }
}
function updateEvaluationBar(evaluation, scoreString) {
    const { blackBar, evalNum } = evaluationElements;
    if (isMultiplayer) {
        document.getElementById('evalBar').style.display = 'none';
        document.getElementById('topLines').style.display = 'none';
        return;
    }
    document.getElementById('evalBar').style.display = 'flex';
    document.getElementById('topLines').style.display = 'flex';

    if (typeof evaluation === 'number') {
        const clampedEval = Math.max(-15, Math.min(15, evaluation));
        const blackBarHeight = 50 - (clampedEval / 15 * 100);
        const finalHeight = Math.max(0, Math.min(100, blackBarHeight));
        blackBar.style.height = finalHeight + "%";
        evalNum.textContent = clampedEval.toFixed(2);
    } else if (typeof evaluation === 'string' && evaluation.startsWith('#')) {
        const scoreValue = parseInt(scoreString) || 0;
        const isWhiteWinning = (scoreValue > 0 && isWhiteTurn) || (scoreValue < 0 && !isWhiteTurn);
        blackBar.style.height = isWhiteWinning ? '0%' : '100%';
        evalNum.textContent = evaluation;
    }
}
function updateEvaluationLines(lines, evaluations) {
    if (isMultiplayer) return;
    const maxLines = Math.min(lines.length, evaluations.length, 3);
    for (let i = 0; i < 3; i++) {
        const evalElement = evaluationElements.evalLines[i];
        const lineElement = evaluationElements.lineElements[i];
        if (evalElement && lineElement) {
            if (i < maxLines && evaluations[i] !== undefined) {
                evalElement.textContent = evaluations[i].toString();
                lineElement.textContent = (lines[i] || '').trim();
            } else {
                evalElement.textContent = '';
                lineElement.textContent = '';
            }
        }
    }
}
function updateEvaluationText(evaluation, scoreString) {
    if (isMultiplayer) return;
    const { evalMain, evalText } = evaluationElements;
    if (!evalMain || !evalText) return;
    evalMain.textContent = evaluation !== undefined ? evaluation.toString() : '';
    if (typeof evaluation === 'string' && evaluation.includes('#')) {
        const mateInMoves = Math.abs(parseInt(evaluation.slice(1)) || 0);
        const scoreValue = parseInt(scoreString) || 0;
        const isWhiteWinning = (scoreValue > 0 && isWhiteTurn) || (scoreValue < 0 && !isWhiteTurn);
        const winningColor = isWhiteWinning ? "White" : "Black";
        evalText.textContent = `${winningColor} can mate in ${mateInMoves} moves`;
    } else if (typeof evaluation === 'number') {
        const absEval = Math.abs(evaluation);
        if (absEval < 0.5) {
            evalText.textContent = "Equal";
        } else if (evaluation >= 0.5 && evaluation < 1) {
            evalText.textContent = "White is slightly better";
        } else if (evaluation <= -0.5 && evaluation > -1) {
            evalText.textContent = "Black is slightly better";
        } else if (evaluation >= 1 && evaluation < 2) {
            evalText.textContent = "White is significantly better";
        } else if (evaluation <= -1 && evaluation > -2) {
            evalText.textContent = "Black is significantly better";
        } else if (evaluation >= 2) {
            evalText.textContent = "White is winning!";
        } else if (evaluation <= -2) {
            evalText.textContent = "Black is winning!";
        }
    } else {
        evalText.textContent = "Unknown";
    }
}
