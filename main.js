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
    // Call finalizeMove to get the initial board evaluation and set up the first turn.
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
        boardSquares[i].addEventListener('click', selectSquare); // `selectSquare` function is now defined

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
    // This function would typically handle selecting a piece or moving a selected piece
    // For now, it's a placeholder to prevent errors.
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
    const piece = ev.target.closest('.piece'); // Ensure we get the .piece element
    if (!piece) return; // If not a piece, do nothing

    const pieceColor = piece.getAttribute("color");
    if ((isWhiteTurn && pieceColor === "white") || (!isWhiteTurn && pieceColor === "black")) {
        selectedPiece = piece; // Store the selected piece
        ev.dataTransfer.setData("text", piece.id);
        const startingSquareId = piece.parentNode.id; // Get ID from parent square
        legalSquares = getLegalMovesForPiece(startingSquareId, piece); // Get filtered legal moves
        console.log("Legal moves for " + piece.classList[1] + " on " + startingSquareId + ":", legalSquares);
    } else {
        ev.preventDefault(); // Prevent dragging if it's not the player's turn
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

    // Get original position of the dragged piece
    const originalSquareId = pieceElement.parentNode.id;
    const [fromRow, fromCol] = squareIdToCoords(originalSquareId);
    const [toRow, toCol] = squareIdToCoords(destinationSquareId);

    // Store current enPassantTargetSquare before potential reset
    const prevEnPassantTargetSquare = enPassantTargetSquare;
    // Reset en passant target for the new turn, it's only valid for one turn
    enPassantTargetSquare = null;

    // Check if the destination is a legal move
    if (legalSquares.includes(destinationSquareId)) {
        const pieceType = board[fromRow][fromCol].type;
        const pieceColor = board[fromRow][fromCol].color;

        // Handle Castling Move
        if (pieceType === 'king' && Math.abs(fromCol - toCol) === 2) {
            // This is a castling move
            let rookFromCol, rookToCol;
            if (toCol === 6) { // Kingside castle (King moves from e to g)
                rookFromCol = 7; // h-file rook
                rookToCol = 5;   // f-file
            } else if (toCol === 2) { // Queenside castle (King moves from e to c)
                rookFromCol = 0; // a-file rook
                rookToCol = 3;   // d-file
            }

            // Move king
            board[toRow][toCol] = board[fromRow][fromCol];
            board[fromRow][fromCol] = null;

            // Move rook
            board[toRow][rookToCol] = board[toRow][rookFromCol];
            board[toRow][rookFromCol] = null;

            // Update castling flags
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
            // This is an en passant capture
            const capturedPawnRow = fromRow; // Captured pawn is on the same row as the attacking pawn's start
            const capturedPawnCol = toCol; // Captured pawn is on the same column as the attacking pawn's destination
            board[capturedPawnRow][capturedPawnCol] = null; // Remove the captured pawn

            board[toRow][toCol] = board[fromRow][fromCol]; // Move attacking pawn
            board[fromRow][fromCol] = null; // Clear original square

        } else {
            // Normal move
            board[toRow][toCol] = board[fromRow][fromCol]; // Move piece to new square
            board[fromRow][fromCol] = null; // Clear old square

            // Update castling flags for normal king/rook moves
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

        // Set enPassantTargetSquare if a pawn moved two squares
        if (pieceType === 'pawn' && Math.abs(fromRow - toRow) === 2) {
            // The en passant target square is the square *behind* the pawn that just moved two squares
            enPassantTargetSquare = coordsToSquareId(fromRow + (toRow - fromRow) / 2, toCol);
        }

        // Check for pawn promotion
        if (pieceType === 'pawn' && (toRow === 0 || toRow === 7)) {
            pawnPromotionTargetSquareId = destinationSquareId; // Store for promotion
            renderBoard(); // Render the board with the pawn moved before showing promotion UI
            showPromotionUI(pieceColor);
            // IMPORTANT: DO NOT call finalizeMove() or toggle turn here.
            // It will be called by selectPromotionPiece after the user chooses a piece.
            return;
        }

        renderBoard(); // Update the DOM to reflect the new board state for non-promotion moves
        // Call the new finalizeMove function to handle turn toggle, legal moves clear, game status, and evaluation
        finalizeMove();

    } else {
        console.log("Illegal move!");
        legalSquares.length = 0; // Always clear legal squares after a drop attempt
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
    // Create a deep copy of the current board state
    const simulatedBoard = currentBoard.map(row => row.slice());

    const piece = simulatedBoard[fromRow][fromCol];
    simulatedBoard[toRow][toCol] = piece;
    simulatedBoard[fromRow][fromCol] = null;

    if (isEnPassantCapture) {
        // For en passant, the captured pawn is on the same row as the attacking pawn's start,
        // but on the column of the attacking pawn's destination.
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
    return null; // Should not happen in a valid game
}

/**
 * Checks if a king of a given color is in check on a specific board state.
 * @param {string} kingColor The color of the king to check ("white" or "black").
 * @param {Array<Array<Object|null>>} boardState The board state to evaluate.
 * @returns {boolean} True if the king is in check, false otherwise.
 */
function isKingInCheck(kingColor, boardState) {
    const kingCoords = findKing(kingColor, boardState);
    if (!kingCoords) return false; // King not found (game over or invalid state)

    const [kingRow, kingCol] = kingCoords;
    const opponentColor = kingColor === 'white' ? 'black' : 'white';

    // Iterate through all squares to find opponent's pieces
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece && piece.color === opponentColor) {
                // Get pseudo-legal moves for this opponent's piece
                // We pass true for `forCheckValidation` to get all possible attacks
                const pseudoLegalMoves = getPseudoLegalMoves(r, c, piece.type, piece.color, boardState, true);
                // Check if any of these moves target the king's square
                if (pseudoLegalMoves.some(move => move[0] === kingRow && move[1] === kingCol)) {
                    return true; // King is in check
                }
            }
        }
    }
    return false; // King is not in check
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
        // Ensure move is within bounds
        if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
            moves.push([r, c]);
        }
    };

    // Helper for sliding pieces (Rook, Bishop, Queen)
    const checkAndAddSlidingMove = (r, c) => {
        if (r < 0 || r > 7 || c < 0 || c > 7) return 'stop'; // Out of bounds

        const targetContent = isSquareOccupied(r, c, boardState);
        if (targetContent === 'blank') {
            addMove(r, c);
            return 'continue'; // Keep checking in this direction
        } else if (targetContent !== pieceColor) {
            addMove(r, c); // Capture opponent's piece
            return 'stop'; // Stop after capture
        } else {
            return 'stop'; // Blocked by own piece
        }
    };

    switch (pieceType) {
        case 'pawn':
            const direction = (pieceColor === "white") ? -1 : 1; // Row index changes: -1 for white (up), 1 for black (down)
            const startRankRow = (pieceColor === "white") ? 6 : 1; // Row index for starting rank
            const enPassantRank = (pieceColor === "white") ? 3 : 4; // Rank where en passant can occur for attacking pawn

            // Forward one square
            let nextRow = startRow + direction;
            if (isSquareOccupied(nextRow, startCol, boardState) === "blank") {
                addMove(nextRow, startCol);
                // Forward two squares (only from starting rank)
                if (startRow === startRankRow) {
                    let twoStepsRow = startRow + (2 * direction);
                    if (isSquareOccupied(twoStepsRow, startCol, boardState) === "blank") {
                        addMove(twoStepsRow, startCol);
                    }
                }
            }

            // Diagonal captures
            const captureCols = [startCol - 1, startCol + 1];
            for (const c of captureCols) {
                const targetContent = isSquareOccupied(nextRow, c, boardState);
                if (targetContent !== "blank" && targetContent !== pieceColor) {
                    addMove(nextRow, c); // Capture opponent's piece
                }
            }

            // En Passant
            if (startRow === enPassantRank && enPassantTargetSquare !== null) {
                for (const c of captureCols) {
                    const targetSquareId = coordsToSquareId(nextRow, c);
                    if (targetSquareId === enPassantTargetSquare) {
                        // Check if the square to the side contains an opponent's pawn that just moved two squares
                        const pawnBesideRow = startRow; // The row of the captured pawn
                        const pawnBesideCol = c; // The column of the captured pawn
                        const pieceBeside = boardState[pawnBesideRow][pawnBesideCol];

                        if (pieceBeside && pieceBeside.type === 'pawn' && pieceBeside.color !== pieceColor) {
                            addMove(nextRow, c); // Add the en passant target square as a legal move
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
            const rookDirections = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // Up, Down, Left, Right
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
            const bishopDirections = [[-1, -1], [-1, 1], [1, -1], [1, 1]]; // Diagonals
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
                [-1, 0], [1, 0], [0, -1], [0, 1], // Rook moves
                [-1, -1], [-1, 1], [1, -1], [1, 1]  // Bishop moves
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

            // Castling logic for King
            // King's current position must be its starting square (e1 for white, e8 for black)
            // White King: (7, 4)
            // Black King: (0, 4)
            const kingRow = (pieceColor === 'white') ? 7 : 0;
            const kingMovedFlag = (pieceColor === 'white') ? hasWhiteKingMoved : hasBlackKingMoved;

            if (!kingMovedFlag && startRow === kingRow && startCol === 4) { // King is on its starting square and hasn't moved
                // Kingside Castling (Short Castle) - Rook at h1 (7,7) or h8 (0,7)
                const kingsideRookMovedFlag = (pieceColor === 'white') ? hasWhiteKingsideRookMoved : hasBlackKingsideRookMoved;
                const kingsideRookCol = 7;
                if (!kingsideRookMovedFlag && boardState[kingRow][5] === null && boardState[kingRow][6] === null &&
                    boardState[kingRow][kingsideRookCol] && boardState[kingRow][kingsideRookCol].type === 'rook' && boardState[kingRow][kingsideRookCol].color === pieceColor) {
                    // Check if squares king passes through or lands on are attacked
                    const pathClearAndSafe =
                        !isKingInCheck(pieceColor, boardState) && // King not in check
                        !isKingInCheck(pieceColor, simulateMove(kingRow, 4, kingRow, 5, boardState)) && // f1/f8 not attacked
                        !isKingInCheck(pieceColor, simulateMove(kingRow, 4, kingRow, 6, boardState)); // g1/g8 not attacked

                    if (pathClearAndSafe) {
                        addMove(kingRow, 6); // Add g1/g8 as a legal castling move target
                    }
                }

                // Queenside Castling (Long Castle) - Rook at a1 (7,0) or a8 (0,0)
                const queensideRookMovedFlag = (pieceColor === 'white') ? hasWhiteQueensideRookMoved : hasBlackQueensideRookMoved;
                const queensideRookCol = 0;
                if (!queensideRookMovedFlag && boardState[kingRow][1] === null && boardState[kingRow][2] === null && boardState[kingRow][3] === null &&
                    boardState[kingRow][queensideRookCol] && boardState[kingRow][queensideRookCol].type === 'rook' && boardState[kingRow][queensideRookCol].color === pieceColor) {
                    // Check if squares king passes through or lands on are attacked
                    const pathClearAndSafe =
                        !isKingInCheck(pieceColor, boardState) && // King not in check
                        !isKingInCheck(pieceColor, simulateMove(kingRow, 4, kingRow, 3, boardState)) && // d1/d8 not attacked
                        !isKingInCheck(pieceColor, simulateMove(kingRow, 4, kingRow, 2, boardState)); // c1/c8 not attacked

                    if (pathClearAndSafe) {
                        addMove(kingRow, 2); // Add c1/c8 as a legal castling move target
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

    // Get all pseudo-legal moves for the piece
    const pseudoLegalMoves = getPseudoLegalMoves(startRow, startCol, pieceType, pieceColor, board);

    let filteredLegalMoves = [];
    for (const [toRow, toCol] of pseudoLegalMoves) {
        // Simulate the move on a temporary board
        let simulatedBoard;
        let isEnPassantCapture = false;

        // Determine if this pseudo-legal move is an en passant capture
        if (pieceType === 'pawn' && coordsToSquareId(toRow, toCol) === enPassantTargetSquare) {
            // Check if the target square is indeed the en passant target
            const pawnBesideRow = startRow;
            const pawnBesideCol = toCol;
            const pieceBeside = board[pawnBesideRow][pawnBesideCol];
            if (pieceBeside && pieceBeside.type === 'pawn' && pieceBeside.color !== pieceColor) {
                isEnPassantCapture = true;
            }
        }

        simulatedBoard = simulateMove(startRow, startCol, toRow, toCol, board, isEnPassantCapture);

        // Check if the king is in check after this simulated move
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

    // Check if current player has any legal moves
    // Iterate through all pieces of the current player
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === currentPlayerColor) {
                const pieceSquareId = coordsToSquareId(r, c);
                // We need a dummy piece element to pass to getLegalMovesForPiece
                // as it expects a DOM element to extract classList and attributes.
                // In a more complex app, this might be refactored to just pass pieceType and pieceColor directly.
                const dummyPieceElement = {
                    classList: [null, piece.type], // Mimic classList[1] for piece type
                    getAttribute: (attr) => attr === 'color' ? piece.color : null
                };

                const legalMovesForThisPiece = getLegalMovesForPiece(pieceSquareId, dummyPieceElement);
                if (legalMovesForThisPiece.length > 0) {
                    hasLegalMoves = true;
                    break; // Found at least one legal move
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
        // Game continues, maybe clear previous messages
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
    promotionChoices.innerHTML = ''; // Clear previous choices
    const promotionPieces = ['queen', 'rook', 'bishop', 'knight'];

    promotionPieces.forEach(pieceType => {
        const choiceDiv = document.createElement('div');
        choiceDiv.classList.add('promotion-choice');
        choiceDiv.dataset.pieceType = pieceType; // Store the piece type
        choiceDiv.addEventListener('click', () => selectPromotionPiece(pieceType, pawnColor));

        const pieceImg = document.createElement('img');
        pieceImg.src = `${pawnColor}-${pieceType.charAt(0).toUpperCase() + pieceType.slice(1)}.png`;
        pieceImg.alt = `${pawnColor} ${pieceType}`;

        choiceDiv.appendChild(pieceImg);
        promotionChoices.appendChild(choiceDiv);
    });

    promotionOverlay.classList.add('active'); // Show the overlay
}

/**
 * Handles the selection of a promotion piece.
 * @param {string} selectedType The type of piece chosen for promotion (e.g., 'queen').
 * @param {string} pawnColor The color of the pawn being promoted.
 */
function selectPromotionPiece(selectedType, pawnColor) {
    promotionOverlay.classList.remove('active'); // Hide the overlay

    const [row, col] = squareIdToCoords(pawnPromotionTargetSquareId);

    // Update the board state with the new piece type
    board[row][col] = {
        type: selectedType,
        color: pawnColor
    };

    renderBoard(); // Update the DOM to reflect the promoted piece

    pawnPromotionTargetSquareId = null; // Reset
    // Call finalizeMove after promotion to update turn, game status, and evaluation
    finalizeMove();
}

/**
 * Finalizes a move: toggles turn, clears legal squares, checks game status, and updates evaluation.
 * This function is called after any successful move (normal or promotion).
 */
function finalizeMove() {
    isWhiteTurn = !isWhiteTurn; // Toggle turn for the next player
    legalSquares.length = 0; // Clear legal moves for the previous turn

    checkGameStatus(); // Check for check, checkmate, stalemate after the move

    // Get the current FEN string and update the evaluation
    const currentFEN = generateFEN(board); // Make sure generateFEN(board) is correctly implemented
    console.log("Generated FEN:", currentFEN); // ADDED: Log the FEN
    getEvaluation(currentFEN, function(evaluations){
        displayEvaluation(evaluations);
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

    // Active color
    fen += ' ' + (isWhiteTurn ? 'w' : 'b');

    // Castling availability
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

    // En passant target square
    fen += ' ' + (enPassantTargetSquare || '-');

    // Halfmove clock (number of halfmoves since the last capture or pawn advance) - simplified for now
    // Fullmove number (starts at 1 and is incremented after Black's move) - simplified for now
    fen += ' 0 1'; // Default values, you might want to implement actual tracking for these

    return fen;
}


function getEvaluation(fen, callback) {
    // Initialize worker only once
    if (!stockfishWorker) {
        console.log("Creating new worker with path:", "./lib/stockfish-nnue-16.js"); // ADDED: Log the worker path
        stockfishWorker = new Worker("./lib/stockfish-nnue-16.js"); 
        stockfishWorker.onmessage = function (event) {
            let message = event.data;
            console.log("Stockfish Raw Message:", message); // ADDED: Log all messages from worker

            if (message.startsWith("info depth 10")) {
                let evaluations = []; // Reset evaluations for each message
                let multipvIndex = message.indexOf("multiv");
                if(multipvIndex !== -1) {
                    let multipvString = message.slice(multipvIndex).split(" ")[1];
                    let multipv = parseInt(multipvString);
                    let scoreIndex = message.indexOf("score cp");
                    if (scoreIndex != -1) {
                        let scoreString = message.slice(scoreIndex).split(" ")[2];
                        let evaluation = parseInt(scoreString)/100;
                        // Adjust evaluation based on whose turn it is for display purposes
                        evaluation = isWhiteTurn ? evaluation : evaluation * -1;
                        evaluations [multipv - 1] = evaluation;
                    } else {
                        scoreIndex = message.indexOf("score mate");
                        scoreString = message.slice(scoreIndex).split(" ")[2];
                        let evaluation = parseInt(scoreString);
                        evaluation = Math.abs(evaluation); // Mate score
                        evaluations[multipv - 1] = "#" + evaluation;
                    }
                    let pvIndex = message.indexOf(" pv ");
                    if(pvIndex !== -1) {
                        // The original code only called callback if evaluations.length === 1.
                        // This might need refinement if you want to display all multipv evaluations.
                        // For now, it will display only the first (best) evaluation.
                        if(evaluations.length === 1) {
                             callback(evaluations);
                        }
                    }
                }
            } else if (message.startsWith("info string")) {
                console.log("Stockfish Info String:", message); // Log other info messages
            } else if (message.startsWith("bestmove")) {
                console.log("Stockfish Best Move:", message); // Log bestmove messages
            }
        };
        stockfishWorker.onerror = function(error) { // ADDED: Error handling for worker
            console.error("Stockfish Worker Error:", error);
        };
    }

    // Send commands to the worker
    stockfishWorker.postMessage("uci");
    stockfishWorker.postMessage("isready");
    stockfishWorker.postMessage("ucinewgame"); // Reset engine for new game/position
    stockfishWorker.postMessage("setoption name multipv value 3"); // Set multipv if desired
    stockfishWorker.postMessage("position fen " + fen); // IMPORTANT: Note the space after "fen"
    stockfishWorker.postMessage("go depth 10");
}

function displayEvaluation (evaluations) {
    let blackBar = document.querySelector(".blackBar");
    let blackBarHeight = 50 - (evaluations[0]/15 *100);
    blackBarHeight = blackBarHeight>100 ? (blackBarHeight = 100) : blackBarHeight;
    blackBarHeight = blackBarHeight<0 ? (blackBarHeight = 0) : blackBarHeight;
    blackBar.style.height = blackBarHeight + "%";
    let evalNum = document.querySelector(".evalNum");
    evalNum.innerHTML = evaluations[0];
}
