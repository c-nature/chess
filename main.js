// Global board state
let board = []; // Will be an 8x8 array representing the board
let legalSquares = [];
let isWhiteTurn = true; // Track whose turn it is
let enPassantTargetSquare = null; // Track the square behind a pawn that just moved two squares
let selectedSquare = null; // Track the currently selected square
let selectedPiece = null; // Track the currently selected piece
let pawnPromotionTargetSquareId = null; // Stores the square where pawn promotion happens

// Castling flags
let hasWhiteKingMoved = false;
let hasBlackKingMoved = false;
let hasWhiteKingsideRookMoved = false; // h1 rook
let hasWhiteQueensideRookMoved = false; // a1 rook
let hasBlackKingsideRookMoved = false; // h8 rook
let hasBlackQueensideRookMoved = false; // a8 rook

// Global Stockfish worker instance - CRITICAL: Initialize only once
let stockfishWorker = null;
let evaluations = []; // Moved to global scope to persist between messages
let lines = []; // Array to store PV lines for each multipv

const boardSquares = document.getElementsByClassName('square');
const pieces = document.getElementsByClassName('piece');
const piecesImages = document.getElementsByTagName("img");

// Promotion UI elements
const promotionOverlay = document.getElementById('promotion-overlay');
const promotionChoices = document.querySelector('.promotion-choices');

// Ensure DOM is fully loaded before setting up event listeners
document.addEventListener('DOMContentLoaded', (event) => {
    setupBoardSquares();
    initializeBoardState(); // Initialize the internal board state
    setupPieces(); // Setup drag listeners for initial pieces
    renderBoard(); // Render the board based on initial state
    finalizeMove();
});

/**
 * Sets up event listeners and IDs for each square on the chessboard.
 * This is primarily for initial DOM setup and event listeners.
 */
function setupBoardSquares() {
    for (let i = 0; i < boardSquares.length; i++) {
        boardSquares[i].addEventListener('dragover', allowDrop);
        boardSquares[i].addEventListener('drop', drop);
        boardSquares[i].addEventListener('click', selectSquare);

        // Calculate row and column for ID
        let row = 8 - Math.floor(i / 8); // Ranks 8 to 1
        let column = String.fromCharCode(97 + (i % 8)); // Files a to h
        let square = boardSquares[i];
        square.id = column + row;
    }
}

/**
 * Sets up draggable attribute and IDs for each piece.
 * This function is called initially and after every renderBoard() call.
 */
function setupPieces() {
    // Remove existing drag listeners to prevent duplicates
    for (let i = 0; i < pieces.length; i++) {
        pieces[i].removeEventListener('dragstart', drag);
    }
    // Get fresh list of pieces after renderBoard
    const currentPieces = document.getElementsByClassName('piece');
    for (let i = 0; i < currentPieces.length; i++) {
        currentPieces[i].addEventListener('dragstart', drag);
        currentPieces[i].setAttribute('draggable', true);
        // Piece ID format: pieceType + squareId (e.g., "rook-a8")
        currentPieces[i].id = currentPieces[i].classList[1] + "-" + currentPieces[i].parentElement.id;
    }
    const currentPieceImages = document.getElementsByTagName("img");
    for (let i = 0; i < currentPieceImages.length; i++) {
        currentPieceImages[i].setAttribute('draggable', false); // Prevent image itself from being draggable
    }
}

/**
 * Helper to convert square ID (e.g., "a1") to board indices [row, col].
 * Board array: board[0][0] is a8, board[7][7] is h1.
 * @param {string} squareId The ID of the square (e.g., "a1").
 * @returns {Array<number>} An array [rowIndex, colIndex].
 */
function squareIdToCoords(squareId) {
    const file = squareId.charCodeAt(0) - 97; // 'a' -> 0, 'b' -> 1, ...
    const rank = parseInt(squareId.charAt(1)); // '1' -> 1, '2' -> 2, ...
    const rowIndex = 8 - rank; // Rank 8 is row 0, Rank 1 is row 7
    const colIndex = file;
    return [rowIndex, colIndex];
}

/**
 * Helper to convert board indices [row, col] to square ID (e.g., "a1").
 * @param {number} rowIndex The row index (0-7).
 * @param {number} colIndex The column index (0-7).
 * @returns {string} The square ID (e.g., "a1").
 */
function coordsToSquareId(rowIndex, colIndex) {
    const fileChar = String.fromCharCode(97 + colIndex);
    const rankNum = 8 - rowIndex; // Convert row index back to rank number
    return fileChar + rankNum;
}

/**
 * Initializes the internal board state based on the current HTML.
 */
function initializeBoardState() {
    board = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let i = 0; i < boardSquares.length; i++) {
        const squareElement = boardSquares[i];
        const [row, col] = squareIdToCoords(squareElement.id);
        const pieceElement = squareElement.querySelector('.piece');
        if (pieceElement) {
            board[row][col] = {
                type: pieceElement.classList[1], // e.g., 'rook', 'pawn'
                color: pieceElement.getAttribute('color') // 'white' or 'black'
            };
        }
    }
    // Initialize castling flags
    hasWhiteKingMoved = false;
    hasBlackKingMoved = false;
    hasWhiteKingsideRookMoved = false;
    hasWhiteQueensideRookMoved = false;
    hasBlackKingsideRookMoved = false;
    hasBlackQueensideRookMoved = false;
    // Initialize en passant target
    enPassantTargetSquare = null; // Ensure this is null at game start
}

/**
 * Updates the DOM to reflect the internal board state.
 * Clears and re-appends pieces to squares.
 */
function renderBoard() {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const squareId = coordsToSquareId(r, c);
            const squareElement = document.getElementById(squareId);

            // Clear existing piece (and its image) from the DOM square
            const existingPiece = squareElement.querySelector('.piece');
            if (existingPiece) {
                squareElement.removeChild(existingPiece);
            }

            const piece = board[r][c];
            if (piece) {
                // Create new piece div and image
                const pieceDiv = document.createElement('div');
                pieceDiv.classList.add('piece', piece.type);
                pieceDiv.setAttribute('color', piece.color);
                pieceDiv.id = piece.type + "-" + squareId; // Re-assign ID for drag/drop
                pieceDiv.setAttribute('draggable', true);

                const pieceImg = document.createElement('img');
                // Construct image source based on piece color and type (e.g., 'black-Rook.png')
                pieceImg.src = `${piece.color}-${piece.type.charAt(0).toUpperCase() + piece.type.slice(1)}.png`;
                pieceImg.alt = `${piece.color} ${piece.type}`;
                pieceImg.setAttribute('draggable', false); // Prevent image itself from being draggable

                pieceDiv.appendChild(pieceImg);
                squareElement.appendChild(pieceDiv);
            }
        }
    }
    // Re-setup drag listeners for newly rendered pieces, as old elements are removed
    setupPieces();
}

/**
 * Placeholder for selecting a square by click.
 * @param {Event} event The click event.
 */
function selectSquare(event) {
    console.log("Square clicked:", event.currentTarget.id);
}

/**
 * Allows a drop operation to occur on a valid drop target.
 * @param {Event} event The dragover event.
 */
function allowDrop(event) {
    event.preventDefault();
}

/**
 * Handles the start of a drag operation for a chess piece.
 * @param {Event} ev The dragstart event.
 */
function drag(ev) {
    const piece = ev.target.closest('.piece');
    if (!piece) return;

    const pieceColor = piece.getAttribute("color");
    if ((isWhiteTurn && pieceColor === "white") || (!isWhiteTurn && pieceColor === "black")) {
        selectedPiece = piece;
        ev.dataTransfer.setData("text", piece.id);
        const startingSquareId = piece.parentNode.id;
        legalSquares = getLegalMovesForPiece(startingSquareId, piece);
        console.log("Legal moves for " + piece.classList[1] + " on " + startingSquareId + ":", legalSquares);
    } else {
        ev.preventDefault();
    }
}

/**
 * Handles the drop of a piece onto a square.
 * @param {Event} ev The drop event.
 */
function drop(ev) {
    ev.preventDefault();
    let data = ev.dataTransfer.getData("text");
    const pieceElement = document.getElementById(data);
    const destinationSquare = ev.currentTarget;
    let destinationSquareId = destinationSquare.id;

    const originalSquareId = pieceElement.parentNode.id;
    const [fromRow, fromCol] = squareIdToCoords(originalSquareId);
    const [toRow, toCol] = squareIdToCoords(destinationSquareId);

    const prevEnPassantTargetSquare = enPassantTargetSquare;
    enPassantTargetSquare = null;

    if (legalSquares.includes(destinationSquareId)) {
        const pieceType = board[fromRow][fromCol].type;
        const pieceColor = board[fromRow][fromCol].color;

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
        } else if (pieceType === 'pawn' && destinationSquareId === prevEnPassantTargetSquare) {
            const capturedPawnRow = fromRow;
            const capturedPawnCol = toCol;
            board[capturedPawnRow][capturedPawnCol] = null;

            board[toRow][toCol] = board[fromRow][fromCol];
            board[fromRow][fromCol] = null;
        } else {
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
        }

        if (pieceType === 'pawn' && (toRow === 0 || toRow === 7)) {
            pawnPromotionTargetSquareId = destinationSquareId;
            renderBoard();
            showPromotionUI(pieceColor);
            return;
        }

        renderBoard();
        finalizeMove();
    } else {
        console.log("Illegal move!");
        legalSquares.length = 0;
    }
}

/**
 * Checks if a square is occupied and by what color on the internal board.
 * @param {number} rowIndex The row index (0-7).
 * @param {number} colIndex The column index (0-7).
 * @param {Array<Array<Object|null>>} boardState The board state to check (defaults to global `board`).
 * @returns {string} "white", "black", "blank", or "out-of-bounds".
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
 * @param {number} fromRow Starting row index.
 * @param {number} fromCol Starting column index.
 * @param {number} toRow Destination row index.
 * @param {number} toCol Destination column index.
 * @param {Array<Array<Object|null>>} currentBoard The current board state to simulate from.
 * @param {boolean} isEnPassantCapture Optional: true if this is an en passant capture simulation.
 * @returns {Array<Array<Object|null>>} A new board state after the simulated move.
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
 * @param {string} kingColor The color of the king to find ("white" or "black").
 * @param {Array<Array<Object|null>>} boardState The board state to search.
 * @returns {Array<number>|null} [rowIndex, colIndex] of the king, or null if not found.
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
 * @param {string} kingColor The color of the king to check ("white" or "black").
 * @param {Array<Array<Object|null>>} boardState The board state to evaluate.
 * @returns {boolean} True if the king is in check, false otherwise.
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
 * Calculates all pseudo-legal moves for a piece (moves according to piece rules,
 * without considering if it puts own king in check).
 * @param {number} startRow Starting row index.
 * @param {number} startCol Starting column index.
 * @param {string} pieceType Type of the piece (e.g., "pawn", "rook").
 * @param {string} pieceColor Color of the piece ("white" or "black").
 * @param {Array<Array<Object|null>>} boardState The board state to calculate moves on.
 * @param {boolean} [forCheckValidation=false] If true, allows king to move into check for opponent's attack calculation.
 * @returns {Array<Array<number>>} A list of pseudo-legal moves as [rowIndex, colIndex] coordinates.
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
 * @param {string} startSquareId The ID of the square the piece is on.
 * @param {HTMLElement} pieceElement The piece DOM element.
 * @returns {Array<string>} A list of legal move square IDs.
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
 * Displays messages to the user.
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
 * @param {string} msg The message to display.
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
 * @param {string} pawnColor The color of the pawn being promoted.
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
 * @param {string} selectedType The type of piece chosen for promotion (e.g., 'queen').
 * @param {string} pawnColor The color of the pawn being promoted.
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
 * This function is called after any successful move (normal or promotion).
 */
function finalizeMove() {
    isWhiteTurn = !isWhiteTurn;
    legalSquares.length = 0;

    checkGameStatus();

    const currentFEN = generateFEN(board);
    console.log("Generated FEN:", currentFEN);
    getEvaluation(currentFEN, function(lines, evaluations, scoreString) {
        displayEvaluation(lines, evaluations, scoreString);
    });
}

/**
 * Generates a FEN (Forsyth-Edwards Notation) string from the current board state.
 * @param {Array<Array<Object|null>>} boardState The current 8x8 board array.
 * @returns {string} The FEN string representing the board state.
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
 * Gets evaluation from Stockfish worker.
 * @param {string} fen The FEN string of the current position.
 * @param {function} callback Function to call with the evaluation results.
 */
function getEvaluation(fen, callback) {
    if (!stockfishWorker) {
        console.log("Creating new worker with path:", "./lib/stockfish-nnue-16.js");
        stockfishWorker = new Worker("./lib/stockfish-nnue-16.js");
        stockfishWorker.onmessage = function (event) {
            let message = event.data;
            console.log("Stockfish Raw Message:", message);

            if (message.startsWith("info depth 10")) {
                evaluations.length = 0; // Clear evaluations for each new depth 10 message
                lines.length = 0; // Clear lines for each new depth 10 message
                let multipvIndex = message.indexOf("multipv");
                if (multipvIndex !== -1) {
                    let multipvString = message.slice(multipvIndex).split(" ")[1];
                    let multipv = parseInt(multipvString) || 1; // Default to 1 if parsing fails
                    let scoreIndex = message.indexOf("score cp");
                    let pvIndex = message.indexOf("pv");

                    if (scoreIndex !== -1) {
                        let scoreString = message.slice(scoreIndex).split(" ")[2] || "0";
                        let evaluation = parseInt(scoreString) / 100 || 0;
                        evaluation = isWhiteTurn ? evaluation : -evaluation;
                        evaluations[multipv - 1] = evaluation;
                    } else {
                        scoreIndex = message.indexOf("score mate");
                        let scoreString = message.slice(scoreIndex).split(" ")[2] || "0";
                        let evaluation = parseInt(scoreString) || 0;
                        evaluations[multipv - 1] = "#" + Math.abs(evaluation);
                    }

                    if (pvIndex !== -1) {
                        let pvString = message.slice(pvIndex + 3).trim().split(" ")[0] || "";
                        if (!lines[multipv - 1]) lines[multipv - 1] = "";
                        lines[multipv - 1] += pvString + " ";
                    }

                    // Call callback when we have all 3 evaluations
                    if (evaluations.length === 3) {
                        callback(lines, evaluations, scoreString);
                    }
                }
            } else if (message.startsWith("info string")) {
                console.log("Stockfish Info String:", message);
            } else if (message.startsWith("bestmove")) {
                console.log("Stockfish Best Move:", message);
            }
        };
        stockfishWorker.onerror = function(error) {
            console.error("Stockfish Worker Error:", error);
        };
        stockfishWorker.postMessage("uci");
        stockfishWorker.postMessage("isready");
    }

    stockfishWorker.postMessage("ucinewgame");
    stockfishWorker.postMessage("setoption name multipv value 3");
    stockfishWorker.postMessage("position fen " + fen);
    stockfishWorker.postMessage("go depth 10");
}

/**
 * Displays the evaluation bar and number based on Stockfish's evaluation.
 * @param {Array<string>} lines Array of PV lines from Stockfish.
 * @param {Array<number|string>} evaluations Array of evaluations from Stockfish.
 * @param {string} scoreString The raw score string from Stockfish.
 */
function displayEvaluation(lines, evaluations, scoreString) {
    let blackBar = document.querySelector(".blackBar");
    let evalNum = document.querySelector(".evalNum");

    if (!blackBar || !evalNum) {
        console.error("Evaluation bar elements not found in DOM");
        return;
    }

    if (evaluations && evaluations.length > 0) {
        let evaluation = evaluations[0] || 0; // Default to 0 if undefined
        if (typeof evaluation === 'number') {
            let blackBarHeight = 50 - (evaluation / 15 * 100);
            blackBarHeight = Math.max(0, Math.min(100, blackBarHeight));
            blackBar.style.height = blackBarHeight + "%";
            evalNum.innerHTML = evaluation.toFixed(2); // Display with 2 decimal places
        } else if (typeof evaluation === 'string' && evaluation.startsWith('#')) {
            blackBar.style.height = (parseInt(scoreString) < 0 && !isWhiteTurn) || (parseInt(scoreString) > 0 && isWhiteTurn) ? '100%' : '0%';
            evalNum.innerHTML = evaluation;
        }

        // Update top lines table
        for (let i = 0; i < Math.min(lines?.length || 0, 3); i++) {
            let evalElement = document.getElementById("eval" + (i + 1));
            let lineElement = document.getElementById("line" + (i + 1));
            if (evalElement && lineElement) {
                evalElement.innerHTML = evaluations[i] !== undefined ? evaluations[i].toString() : '';
                lineElement.innerHTML = lines[i] !== undefined ? lines[i].trim() : '';
            }
        }

        // Update main evaluation display
        let evalMain = document.getElementById("eval");
        let evalText = document.getElementById("evalText");
        if (evalMain && evalText) {
            evalMain.innerHTML = evaluations[0] !== undefined ? evaluations[0].toString() : '';
            if (Math.abs(evaluations[0] || 0) < 0.5) {
                evalText.innerHTML = "Equal";
            } else if (evaluations[0] >= 0.5 && evaluations[0] < 1) {
                evalText.innerHTML = "White is slightly better";
            } else if (evaluations[0] <= -0.5 && evaluations[0] > -1) {
                evalText.innerHTML = "Black is slightly better";
            } else if (evaluations[0] >= 1 && evaluations[0] < 2) {
                evalText.innerHTML = "White is significantly better";
            } else if (evaluations[0] <= -1 && evaluations[0] > -2) {
                evalText.innerHTML = "Black is significantly better";
            } else if (evaluations[0] >= 2) {
                evalText.innerHTML = "White is winning!";
            } else if (evaluations[0] <= -2) {
                evalText.innerHTML = "Black is winning!";
            } else if (evaluation?.toString().includes("#")) {
                const mateInMoves = Math.abs(parseInt(evaluation.slice(1)) || 0);
                const isWhiteWinning = (parseInt(scoreString) > 0 && isWhiteTurn) || (parseInt(scoreString) < 0 && !isWhiteTurn);
                const winningColor = isWhiteWinning ? "White" : "Black";
                evalText.innerHTML = `${winningColor} can mate in ${mateInMoves} moves`;
            }
        }
    }
}