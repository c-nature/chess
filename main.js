// Global board state
let board = [];
let legalSquares = [];
let isWhiteTurn = true;
let enPassantTargetSquare = null;
let selectedSquare = null;
let selectedPiece = null;
let pawnPromotionTargetSquareId = null;
let isEngineWhite = false;
let selectedLevel = 10;
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
const newGameBtn = document.getElementById("newGame");
const switchSidesBtn = document.getElementById("switchSides");
const levelSelect = document.getElementById("level");
const promotionOverlay = document.getElementById('promotion-overlay');
const promotionChoices = document.querySelector('.promotion-choices');
let evaluationElements = null;
// Ensure DOM is fully loaded before setting up event listeners
document.addEventListener('DOMContentLoaded', (event) => {
    // The initial call to newGame sets up the board and all listeners
    newGame(); 
    initializeEvaluationElements();

    // Add event listeners for buttons
    newGameBtn.addEventListener('click', newGame);
    switchSidesBtn.addEventListener('click', flipBoard);
    levelSelect.addEventListener("change", function(){
        selectedLevel = this.value;
    });
});
/**
 * Initializes all the necessary global and state variables for a new game.
 */
function newGame() {
    // Initialize the board with the standard starting chess position
    board = [
        [{ type: 'rook', color: 'black' }, { type: 'knight', color: 'black' }, { type: 'bishop', color: 'black' }, { type: 'queen', color: 'black' }, { type: 'king', color: 'black' }, { type: 'bishop', color: 'black' }, { type: 'knight', color: 'black' }, { type: 'rook', color: 'black' }],
        [{ type: 'pawn', color: 'black' }, { type: 'pawn', color: 'black' }, { type: 'pawn', color: 'black' }, { type: 'pawn', color: 'black' }, { type: 'pawn', color: 'black' }, { type: 'pawn', color: 'black' }, { type: 'pawn', color: 'black' }, { type: 'pawn', color: 'black' }],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [{ type: 'pawn', color: 'white' }, { type: 'pawn', color: 'white' }, { type: 'pawn', color: 'white' }, { type: 'pawn', color: 'white' }, { type: 'pawn', color: 'white' }, { type: 'pawn', color: 'white' }, { type: 'pawn', color: 'white' }, { type: 'pawn', color: 'white' }],
        [{ type: 'rook', color: 'white' }, { type: 'knight', color: 'white' }, { type: 'bishop', color: 'white' }, { type: 'queen', color: 'white' }, { type: 'king', color: 'white' }, { type: 'bishop', color: 'white' }, { type: 'knight', color: 'white' }, { type: 'rook', color: 'white' }]
    ];
    // Reset all other global state variables
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
    
    // Clear and rebuild the board
    renderBoard();
    // Set up event listeners for the new pieces and squares
    setupSquaresAndPieces();
}
/**
 * Flips the board and switches sides for the AI opponent.
 */
function flipBoard() {
    chessBoard.classList.toggle('flipped');
    isEngineWhite = !isEngineWhite;
    renderBoard();
    // After flipping, check if it's now the AI's turn
    if ((isEngineWhite && isWhiteTurn) || (!isEngineWhite && !isWhiteTurn)) {
        const currentFEN = generateFEN(board);
        getBestMove(currentFEN, playBestMove);
    }
}
/**
 * Sets up event listeners and IDs for each square and piece on the chessboard.
 */
function setupSquaresAndPieces() {
    const allBoardSquares = document.querySelectorAll('.chessBoard > .square');
    for (let i = 0; i < allBoardSquares.length; i++) {
        const square = allBoardSquares[i];
        // Remove existing listeners to prevent duplicates
        square.removeEventListener('dragover', allowDrop);
        square.removeEventListener('drop', drop);
        square.removeEventListener('click', selectSquare);
        // Add new listeners
        square.addEventListener('dragover', allowDrop);
        square.addEventListener('drop', drop);
        square.addEventListener('click', selectSquare);
        // Set up piece drag listeners
        const piece = square.querySelector('.piece');
        if (piece) {
            piece.removeEventListener('dragstart', drag);
            piece.addEventListener('dragstart', drag);
            piece.setAttribute('draggable', true);
        }
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
 * Updates the DOM to reflect the internal board state.
 */
function renderBoard() {
    // Clear the existing board content
    chessBoard.innerHTML = '';
    
    // Build the board from the internal 'board' array
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const squareElement = document.createElement('div');
            squareElement.classList.add('square');
            squareElement.classList.add((r + c) % 2 === 0 ? 'white' : 'black');
            const squareId = coordsToSquareId(r, c);
            squareElement.id = squareId;
            
            // Add coordinates for ranks and files
            if (c === 0) {
                const rankCoord = document.createElement('div');
                rankCoord.classList.add('coordinate', 'rank');
                rankCoord.textContent = 8 - r;
                rankCoord.classList.add((r + c) % 2 === 0 ? 'blackText' : 'whiteText');
                squareElement.appendChild(rankCoord);
            }
            if (r === 7) {
                const fileCoord = document.createElement('div');
                fileCoord.classList.add('coordinate', 'file');
                fileCoord.textContent = String.fromCharCode(97 + c);
                fileCoord.classList.add((r + c) % 2 === 0 ? 'blackText' : 'whiteText');
                squareElement.appendChild(fileCoord);
            }
            
            const piece = board[r][c];
            if (piece) {
                const pieceDiv = document.createElement('div');
                pieceDiv.classList.add('piece', piece.type);
                pieceDiv.setAttribute('color', piece.color);
                pieceDiv.id = piece.type + "-" + squareId;
                pieceDiv.setAttribute('draggable', true);
                const pieceImg = document.createElement('img');
                // Corrected image path: Assumes images are in the same folder as index.html
                pieceImg.src = `${piece.color}-${piece.type.charAt(0).toUpperCase() + piece.type.slice(1)}.png`;
                pieceImg.alt = `${piece.color} ${piece.type}`;
                pieceImg.setAttribute('draggable', false);
                pieceDiv.appendChild(pieceImg);
                squareElement.appendChild(pieceDiv);
            }
            chessBoard.appendChild(squareElement);
        }
    }
    setupSquaresAndPieces();
}
/**
 * Handles the click-to-move logic.
 */
function selectSquare(event) {
    const clickedSquare = event.currentTarget;
    const pieceOnSquare = clickedSquare.querySelector('.piece');
    const clickedSquareId = clickedSquare.id;
    if (selectedPiece) {
        // A piece is already selected, try to move it
        const originalSquareId = selectedPiece.parentElement.id;
        if (legalSquares.includes(clickedSquareId)) {
            performMove(originalSquareId, clickedSquareId);
            selectedPiece = null;
            legalSquares.length = 0;
        } else {
            // Deselect piece if a non-legal square is clicked
            selectedPiece = null;
            legalSquares.length = 0;
        }
    } else if (pieceOnSquare) {
        // No piece selected, try to select one
        const pieceColor = pieceOnSquare.getAttribute("color");
        const isPlayerTurn = (isWhiteTurn && !isEngineWhite) || (!isWhiteTurn && isEngineWhite);
        if (isPlayerTurn && ((isWhiteTurn && pieceColor === "white") || (!isWhiteTurn && pieceColor === "black"))) {
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
    const isPlayerTurn = (isWhiteTurn && !isEngineWhite) || (!isWhiteTurn && isEngineWhite);
    if (isPlayerTurn && ((isWhiteTurn && pieceColor === "white") || (!isWhiteTurn && pieceColor === "black"))) {
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
 * This is the primary human player move function.
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
 * This is used for the AI's move.
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
        let pieceMap = {
            "q": "queen", "r": "rook", "b": "bishop", "n": "knight"
        };
        promotedTo = pieceMap[promotedTo];
    }
    performMove(startingSquareId, destinationSquareId, promotedTo);
}
/**
 * Performs the actual move on the internal board state and updates the DOM.
 * Centralized function used by both human and AI moves.
 */
function performMove(startingSquareId, destinationSquareId, promotedTo = "") {
    const [fromRow, fromCol] = squareIdToCoords(startingSquareId);
    const [toRow, toCol] = squareIdToCoords(destinationSquareId);
    const piece = board[fromRow][fromCol];
    if (!piece) return;
    const pieceType = piece.type;
    const pieceColor = piece.color;
    const prevEnPassantTargetSquare = enPassantTargetSquare;
    // Handle Castling
    if (pieceType === 'king' && Math.abs(fromCol - toCol) === 2) {
        let rookFromCol, rookToCol;
        if (toCol === 6) {
            rookFromCol = 7;
            rookToCol = 5;
        } else if (toCol === 2) {
            rookFromCol = 0;
            rookToCol = 3;
        }
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
    // Handle En Passant
    else if (pieceType === 'pawn' && destinationSquareId === prevEnPassantTargetSquare) {
        const capturedPawnRow = fromRow;
        const capturedPawnCol = toCol;
        board[capturedPawnRow][capturedPawnCol] = null;
        board[toRow][toCol] = board[fromRow][fromCol];
        board[fromRow][fromCol] = null;
    } 
    // Handle Promotion
    else if (pieceType === 'pawn' && (toRow === 0 || toRow === 7) && promotedTo !== "") {
        board[toRow][toCol] = { type: promotedTo, color: pieceColor };
        board[fromRow][fromCol] = null;
    }
    // Normal Move
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
    // Update en passant target if pawn moved two squares
    if (pieceType === 'pawn' && Math.abs(fromRow - toRow) === 2) {
        enPassantTargetSquare = coordsToSquareId(fromRow + (toRow - fromRow) / 2, toCol);
    } else {
        enPassantTargetSquare = null;
    }
    renderBoard();
    finalizeMove();
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
            if (!forCheckValidation) {
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
    const currentPlayerColor = isWhiteTurn ? 'white' : 'black';
    const opponentPlayerColor = isWhiteTurn ? 'black' : 'white';
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
    } else if (!kingInCheck && !hasLegalMoves) {
        showMessage("Stalemate! It's a draw.");
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
        // Corrected image path
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
    pawnPromotionTargetSquareId = null;
    finalizeMove();
}
/**
 * Finalizes a move: toggles turn, clears legal squares, checks game status, and updates evaluation.
 */
function finalizeMove() {
    isWhiteTurn = !isWhiteTurn;
    legalSquares.length = 0;
    checkGameStatus();
    const currentFEN = generateFEN(board);
    getEvaluation(currentFEN, displayEvaluation);
    // AI move check
    const isEngineTurn = (isEngineWhite && isWhiteTurn) || (!isEngineWhite && !isWhiteTurn);
    if (isEngineTurn) {
        getBestMove(currentFEN, playBestMove);
    }
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
 * Gets the best move from Stockfish engine based on the current board state and difficulty level.
 */
function getBestMove(fen, callback) {
    if (!stockfishWorker) {
        console.error("Stockfish worker is not initialized.");
        return;
    }
    const aiDepth = Math.max(1, Math.min(selectedLevel, 10)); // Ensure depth is between 1 and 10
    const moves = [];
    stockfishWorker.postMessage("position fen " + fen);
    stockfishWorker.postMessage(`go depth ${aiDepth}`);
    const listener = function(event) {
        const message = event.data;
        if (message.startsWith("info depth " + aiDepth)) {
            let multipvIndex = message.indexOf("multipv");
            if (multipvIndex !== -1) {
                let multipv = parseInt(message.slice(multipvIndex).split(" ")[1]) || 1;
                let pvIndex = message.indexOf("pv");
                if (pvIndex !== -1) {
                    let pvMove = message.slice(pvIndex + 3).split(" ")[0];
                    moves[multipv - 1] = pvMove;
                }
            }
        } else if (message.startsWith("bestmove")) {
            stockfishWorker.removeEventListener('message', listener);
            let selectedMove = selectMoveBasedOnLevel(moves, selectedLevel, fen);
            callback(selectedMove);
        }
    };
    stockfishWorker.addEventListener('message', listener);
}
/**
 * Selects a move based on the difficulty level.
 */
function selectMoveBasedOnLevel(moves, level, fen) {
    // If no moves are available, return the best move from Stockfish
    if (!moves || moves.length === 0 || moves[0] === "(none)") {
        return moves[0] || "(none)";
    }
    // High levels (8–10): Always pick the best move
    if (level >= 8) {
        return moves[0];
    }
    // Medium levels (4–7): Occasionally pick the second or third move
    if (level >= 4) {
        const random = Math.random();
        if (random < 0.2 && moves[1]) return moves[1]; // 20% chance for second-best move
        if (random < 0.3 && moves[2]) return moves[2]; // 10% chance for third-best move
        return moves[0]; // 70% chance for best move
    }
    // Low levels (1–3): Frequently pick worse moves or blunder
    const blunderChance = 0.4 - (level - 1) * 0.1; // 40% at Level 1, 30% at Level 2, 20% at Level 3
    if (Math.random() < blunderChance) {
        const legalMoves = getAllLegalMoves(fen);
        if (legalMoves.length > 0) {
            // Filter out the top moves to ensure a blunder
            const nonTopMoves = legalMoves.filter(move => !moves.includes(move));
            if (nonTopMoves.length > 0) {
                return nonTopMoves[Math.floor(Math.random() * nonTopMoves.length)];
            }
        }
    }
    // Fallback if no blunder move is found, or for non-blunder moves at low levels
    const random = Math.random();
    if (random < 0.5 && moves[1]) return moves[1]; // 50% chance for second-best move
    if (random < 0.8 && moves[2]) return moves[2]; // 30% chance for third-best move
    return moves[0]; // 20% chance for best move
}
/**
 * Gets all legal moves for the current player from the board state.
 */
function getAllLegalMoves(fen) {
    const legalMoves = [];
    const boardState = board; // Use current board state
    const currentPlayerColor = isWhiteTurn ? 'white' : 'black';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece && piece.color === currentPlayerColor) {
                const pieceSquareId = coordsToSquareId(r, c);
                const dummyPieceElement = {
                    classList: [null, piece.type],
                    getAttribute: (attr) => attr === 'color' ? piece.color : null
                };
                const movesForPiece = getLegalMovesForPiece(pieceSquareId, dummyPieceElement);
                movesForPiece.forEach(move => {
                    legalMoves.push(pieceSquareId + move);
                });
            }
        }
    }
    return legalMoves;
}
function getEvaluation(fen, callback) {
    if (!stockfishWorker) {
        stockfishWorker = new Worker("./lib/stockfish-nnue-16.js");
        stockfishWorker.onmessage = function (event) {
            let message = event.data;
            if (message.startsWith("info depth 10")) {
                let multipvIndex = message.indexOf("multipv");
                if (multipvIndex !== -1) {
                    let multipvString = message.slice(multipvIndex).split(" ")[1];
                    let multipv = parseInt(multipvString) || 1;
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
                    }
                }
            }
        };
        stockfishWorker.onerror = function(error) {
            console.error("Stockfish Worker Error:", error);
        };
        stockfishWorker.postMessage("uci");
        stockfishWorker.postMessage("isready");
        stockfishWorker.postMessage("setoption name multipv value 3");
    }
    stockfishWorker.postMessage("ucinewgame");
    stockfishWorker.postMessage("position fen " + fen);
    stockfishWorker.postMessage("go depth 10");
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
        console.error('Chessboard initialization error:', error);
    }
}
function updateEvaluationBar(evaluation, scoreString) {
    const { blackBar, evalNum } = evaluationElements;
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
    }
}
