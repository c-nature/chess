<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chess Game</title>
    <link rel="icon" href="/favicon.ico" type="image/x-icon">
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div class="container">
        <div id="fen-display"></div>
        <div id="status-message"></div>
        <button id="resetButton">Reset Game</button>
        <div class="chessBoard" id="myBoard">
            <!-- Rank 8 (Black's back rank) -->
            <div class="square white" id="a8">
                <div class="coordinate rank blackText">8</div>
                <div class="piece rook" color="black">
                    <img src="/images/Black-Rook.png" alt="Black Rook">
                </div>
            </div>
            <div class="square black" id="b8">
                <div class="piece knight" color="black">
                    <img src="/images/Black-Knight.png" alt="Black Knight">
                </div>
            </div>
            <div class="square white" id="c8">
                <div class="piece bishop" color="black">
                    <img src="/images/Black-Bishop.png" alt="Black Bishop">
                </div>
            </div>
            <div class="square black" id="d8">
                <div class="piece queen" color="black">
                    <img src="/images/Black-Queen.png" alt="Black Queen">
                </div>
            </div>
            <div class="square white" id="e8">
                <div class="piece king" color="black">
                    <img src="/images/Black-King.png" alt="Black King">
                </div>
            </div>
            <div class="square black" id="f8">
                <div class="piece bishop" color="black">
                    <img src="/images/Black-Bishop.png" alt="Black Bishop">
                </div>
            </div>
            <div class="square white" id="g8">
                <div class="piece knight" color="black">
                    <img src="/images/Black-Knight.png" alt="Black Knight">
                </div>
            </div>
            <div class="square black" id="h8">
                <div class="piece rook" color="black">
                    <img src="/images/Black-Rook.png" alt="Black Rook">
                </div>
            </div>
            <!-- Rank 7 (Black's pawns) -->
            <div class="square black" id="a7">
                <div class="coordinate rank whiteText">7</div>
                <div class="piece pawn" color="black">
                    <img src="/images/Black-Pawn.png" alt="Black Pawn">
                </div>
            </div>
            <div class="square white" id="b7">
                <div class="piece pawn" color="black">
                    <img src="/images/Black-Pawn.png" alt="Black Pawn">
                </div>
            </div>
            <div class="square black" id="c7">
                <div class="piece pawn" color="black">
                    <img src="/images/Black-Pawn.png" alt="Black Pawn">
                </div>
            </div>
            <div class="square white" id="d7">
                <div class="piece pawn" color="black">
                    <img src="/images/Black-Pawn.png" alt="Black Pawn">
                </div>
            </div>
            <div class="square black" id="e7">
                <div class="piece pawn" color="black">
                    <img src="/images/Black-Pawn.png" alt="Black Pawn">
                </div>
            </div>
            <div class="square white" id="f7">
                <div class="piece pawn" color="black">
                    <img src="/images/Black-Pawn.png" alt="Black Pawn">
                </div>
            </div>
            <div class="square black" id="g7">
                <div class="piece pawn" color="black">
                    <img src="/images/Black-Pawn.png" alt="Black Pawn">
                </div>
            </div>
            <div class="square white" id="h7">
                <div class="piece pawn" color="black">
                    <img src="/images/Black-Pawn.png" alt="Black Pawn">
                </div>
            </div>
            <!-- Ranks 6, 5, 4, 3 (Empty squares) -->
            <div class="square white" id="a6"></div>
            <div class="square black" id="b6"></div>
            <div class="square white" id="c6"></div>
            <div class="square black" id="d6"></div>
            <div class="square white" id="e6"></div>
            <div class="square black" id="f6"></div>
            <div class="square white" id="g6"></div>
            <div class="square black" id="h6"></div>
            <div class="square black" id="a5"></div>
            <div class="square white" id="b5"></div>
            <div class="square black" id="c5"></div>
            <div class="square white" id="d5"></div>
            <div class="square black" id="e5"></div>
            <div class="square white" id="f5"></div>
            <div class="square black" id="g5"></div>
            <div class="square white" id="h5"></div>
            <div class="square white" id="a4"></div>
            <div class="square black" id="b4"></div>
            <div class="square white" id="c4"></div>
            <div class="square black" id="d4"></div>
            <div class="square white" id="e4"></div>
            <div class="square black" id="f4"></div>
            <div class="square white" id="g4"></div>
            <div class="square black" id="h4"></div>
            <div class="square black" id="a3"></div>
            <div class="square white" id="b3"></div>
            <div class="square black" id="c3"></div>
            <div class="square white" id="d3"></div>
            <div class="square black" id="e3"></div>
            <div class="square white" id="f3"></div>
            <div class="square black" id="g3"></div>
            <div class="square white" id="h3"></div>
            <!-- Rank 2 (White's pawns) -->
            <div class="square white" id="a2">
                <div class="piece pawn" color="white">
                    <img src="/images/White-Pawn.png" alt="White Pawn">
                </div>
            </div>
            <div class="square black" id="b2">
                <div class="piece pawn" color="white">
                    <img src="/images/White-Pawn.png" alt="White Pawn">
                </div>
            </div>
            <div class="square white" id="c2">
                <div class="piece pawn" color="white">
                    <img src="/images/White-Pawn.png" alt="White Pawn">
                </div>
            </div>
            <div class="square black" id="d2">
                <div class="piece pawn" color="white">
                    <img src="/images/White-Pawn.png" alt="White Pawn">
                </div>
            </div>
            <div class="square white" id="e2">
                <div class="piece pawn" color="white">
                    <img src="/images/White-Pawn.png" alt="White Pawn">
                </div>
            </div>
            <div class="square black" id="f2">
                <div class="piece pawn" color="white">
                    <img src="/images/White-Pawn.png" alt="White Pawn">
                </div>
            </div>
            <div class="square white" id="g2">
                <div class="piece pawn" color="white">
                    <img src="/images/White-Pawn.png" alt="White Pawn">
                </div>
            </div>
            <div class="square black" id="h2">
                <div class="coordinate rank whiteText">2</div>
                <div class="piece pawn" color="white">
                    <img src="/images/White-Pawn.png" alt="White Pawn">
                </div>
            </div>
            <!-- Rank 1 (White's back rank) -->
            <div class="square black" id="a1">
                <div class="coordinate file whiteText">a</div>
                <div class="piece rook" color="white">
                    <img src="/images/White-Rook.png" alt="White Rook">
                </div>
            </div>
            <div class="square white" id="b1">
                <div class="coordinate file blackText">b</div>
                <div class="piece knight" color="white">
                    <img src="/images/White-Knight.png" alt="White Knight">
                </div>
            </div>
            <div class="square black" id="c1">
                <div class="coordinate file whiteText">c</div>
                <div class="piece bishop" color="white">
                    <img src="/images/White-Bishop.png" alt="White Bishop">
                </div>
            </div>
            <div class="square white" id="d1">
                <div class="coordinate file blackText">d</div>
                <div class="piece queen" color="white">
                    <img src="/images/White-Queen.png" alt="White Queen">
                </div>
            </div>
            <div class="square black" id="e1">
                <div class="coordinate file whiteText">e</div>
                <div class="piece king" color="white">
                    <img src="/images/White-King.png" alt="White King">
                </div>
            </div>
            <div class="square white" id="f1">
                <div class="coordinate file blackText">f</div>
                <div class="piece bishop" color="white">
                    <img src="/images/White-Bishop.png" alt="White Bishop">
                </div>
            </div>
            <div class="square black" id="g1">
                <div class="coordinate file whiteText">g</div>
                <div class="piece knight" color="white">
                    <img src="/images/White-Knight.png" alt="White Knight">
                </div>
            </div>
            <div class="square white" id="h1">
                <div class="coordinate file blackText">h</div>
                <div class="coordinate rank blackText">1</div>
                <div class="piece rook" color="white">
                    <img src="/images/White-Rook.png" alt="White Rook">
                </div>
            </div>
        </div>
        <div id="evalBar">
            <div class="blackBar" style="height:50%"></div>
            <div class="zero"></div>
            <div id="evalNum">0.5</div>
        </div>
        <div id="game-over-modal" class="modal">
            <div id="modal-message"></div>
        </div>
        <div id="promotion-overlay" class="promotion-overlay">
            <div class="promotion-choices"></div>
        </div>
    </div>
    <script src="/lib/chessboard-0.3.0.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.2/chess.min.js"></script>
    <script src="/main.js"></script>
</body>
</html>