"use strict";

// ============================================================
// CONSTANTS
// ============================================================

const PIECE_UNICODE = {
    K: "\u265A", Q: "\u265B", R: "\u265C", B: "\u265D", N: "\u265E", P: "\u265F",
    k: "\u265A", q: "\u265B", r: "\u265C", b: "\u265D", n: "\u265E", p: "\u265F",
};

const FILES = "abcdefgh";

// ============================================================
// STATE
// ============================================================

let gameState = {
    fen: null,
    board: null,        // 8x8 array
    legalMoves: [],     // UCI strings
    turn: "white",
    status: "playing",
};

let selectedSquare = null;
let lastMoveFrom = null;
let lastMoveTo = null;
let moveHistory = [];       // [{num, white, black}, ...]
let fenHistory = [];        // FEN stack for undo
let searchDepth = 3;
let isThinking = false;
let lastTree = null;
let treeCollapsed = false;

// ============================================================
// HELPERS
// ============================================================

function squareToRC(sq) {
    // "e2" -> {row: 6, col: 4}
    const col = FILES.indexOf(sq[0]);
    const rank = parseInt(sq[1]);
    const row = 8 - rank;
    return { row, col };
}

function rcToSquare(row, col) {
    return FILES[col] + (8 - row);
}

function isPieceWhite(piece) {
    return piece && piece === piece.toUpperCase();
}

function isPieceBlack(piece) {
    return piece && piece === piece.toLowerCase();
}

function getLegalMovesFrom(square) {
    return gameState.legalMoves.filter(m => m.startsWith(square));
}

// ============================================================
// BOARD RENDERING
// ============================================================

function renderBoard() {
    const boardEl = document.getElementById("chess-board");
    boardEl.innerHTML = "";

    const board = gameState.board;
    if (!board) return;

    // Find king in check
    let checkSquare = null;
    if (gameState.status === "playing") {
        // We check if the FEN indicates check by looking for the king
        // A simple approach: if it's white's turn and there's check, find white king
        // The backend doesn't send check info directly, so we skip this for now
    }

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const sq = document.createElement("div");
            const isLight = (row + col) % 2 === 0;
            sq.className = `square ${isLight ? "light" : "dark"}`;

            const algebraic = rcToSquare(row, col);
            const piece = board[row][col];

            // Highlights
            if (algebraic === selectedSquare) {
                sq.classList.add("selected");
            }
            if (algebraic === lastMoveFrom || algebraic === lastMoveTo) {
                sq.classList.add("last-move");
            }

            // Legal move targets
            if (selectedSquare) {
                const moves = getLegalMovesFrom(selectedSquare);
                const isTarget = moves.some(m => m.substring(2, 4) === algebraic);
                if (isTarget) {
                    if (piece) {
                        sq.classList.add("capture-target");
                    } else {
                        sq.classList.add("move-target");
                    }
                }
            }

            // Piece
            if (piece) {
                sq.textContent = PIECE_UNICODE[piece] || "";
                sq.classList.add(isPieceWhite(piece) ? "white-piece" : "black-piece");
            }

            sq.dataset.square = algebraic;
            sq.addEventListener("click", onSquareClick);
            boardEl.appendChild(sq);
        }
    }
}

// ============================================================
// MOVE INTERACTION
// ============================================================

function onSquareClick(e) {
    if (isThinking || gameState.status !== "playing" || gameState.turn !== "white") return;

    const clickedSquare = e.currentTarget.dataset.square;
    const { row, col } = squareToRC(clickedSquare);
    const piece = gameState.board[row][col];

    if (selectedSquare) {
        // Try to make a move
        const from = selectedSquare;
        const to = clickedSquare;

        if (from === to) {
            selectedSquare = null;
            renderBoard();
            return;
        }

        // Check if this is a valid move
        const baseMove = from + to;
        const matchingMoves = gameState.legalMoves.filter(m => m.startsWith(baseMove));

        if (matchingMoves.length > 0) {
            // Check promotion
            let uciMove = baseMove;
            if (matchingMoves.some(m => m.length === 5)) {
                // Promotion - auto queen
                uciMove = baseMove + "q";
            }
            makeMove(uciMove);
        } else if (piece && isPieceWhite(piece)) {
            // Switch selection to another own piece
            selectedSquare = clickedSquare;
            renderBoard();
        } else {
            selectedSquare = null;
            renderBoard();
        }
    } else {
        // Select a piece
        if (piece && isPieceWhite(piece)) {
            selectedSquare = clickedSquare;
            renderBoard();
        }
    }
}

async function makeMove(uciMove) {
    isThinking = true;
    selectedSquare = null;

    // Save FEN for undo
    fenHistory.push(gameState.fen);

    // Show thinking
    document.getElementById("thinking-overlay").style.display = "flex";
    renderBoard();

    try {
        const response = await fetch("/api/chess/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fen: gameState.fen,
                user_move: uciMove,
                eval_code: document.getElementById("eval-editor").value,
                depth: searchDepth,
            }),
        });

        const data = await response.json();

        if (data.error) {
            showStatus(data.error, true);
            fenHistory.pop();
            isThinking = false;
            document.getElementById("thinking-overlay").style.display = "none";
            return;
        }

        // Update game state
        gameState.fen = data.fen_after_ai || data.fen_after_user;
        gameState.board = data.board;
        gameState.legalMoves = data.legal_moves || [];
        gameState.turn = data.turn;
        gameState.status = data.status;

        // Track last move (AI's move if available, else user's)
        if (data.ai_move) {
            lastMoveFrom = data.ai_move.substring(0, 2);
            lastMoveTo = data.ai_move.substring(2, 4);
        } else {
            lastMoveFrom = uciMove.substring(0, 2);
            lastMoveTo = uciMove.substring(2, 4);
        }

        // Update move history
        addToMoveHistory(data.user_move_san, data.ai_move_san);

        // Show eval error
        if (data.eval_error) {
            showEvalStatus(data.eval_error, false);
        }

        // Render board
        renderBoard();

        // Render tree
        if (data.tree) {
            lastTree = data.tree;
            renderSearchTree(data.tree);
            document.getElementById("search-stats").style.display = "";
            updateStats(data.stats);
        }

        // Check game over
        if (data.status !== "playing") {
            showGameOver(data.status);
        }

    } catch (err) {
        showStatus("Erreur de connexion au serveur", true);
        fenHistory.pop();
    }

    isThinking = false;
    document.getElementById("thinking-overlay").style.display = "none";
}

// ============================================================
// MOVE HISTORY
// ============================================================

function addToMoveHistory(whiteSan, blackSan) {
    if (!whiteSan) return;

    const lastEntry = moveHistory[moveHistory.length - 1];
    const num = moveHistory.length + 1;

    moveHistory.push({ num, white: whiteSan, black: blackSan || "" });
    renderMoveHistory();
}

function renderMoveHistory() {
    const el = document.getElementById("move-history");
    el.innerHTML = moveHistory.map(m => {
        let html = `<span class="move-pair">`;
        html += `<span class="move-num">${m.num}.</span>`;
        html += `<span class="move-white">${m.white}</span>`;
        if (m.black) {
            html += `<span class="move-black">${m.black}</span>`;
        }
        html += `</span>`;
        return html;
    }).join("");
    el.scrollTop = el.scrollHeight;
}

// ============================================================
// STATUS DISPLAY
// ============================================================

function showStatus(text, isError) {
    const el = document.getElementById("game-status");
    el.textContent = text;
    el.className = "game-status" + (isError ? " error" : "");
}

function showGameOver(status) {
    const messages = {
        checkmate_white: "Echec et mat ! Les blancs gagnent.",
        checkmate_black: "Echec et mat ! Les noirs gagnent.",
        stalemate: "Pat ! Match nul.",
        draw: "Match nul.",
    };
    showStatus(messages[status] || status, false);
}

function showEvalStatus(text, isValid) {
    const el = document.getElementById("eval-status");
    el.textContent = text;
    el.className = "eval-status " + (isValid ? "valid" : "invalid");
}

// ============================================================
// STATS
// ============================================================

function updateStats(stats) {
    if (!stats) return;
    document.getElementById("stat-nodes").textContent = stats.nodes_explored.toLocaleString();
    document.getElementById("stat-pruned").textContent = stats.nodes_pruned.toLocaleString();
    document.getElementById("stat-time").textContent = stats.search_time_ms + " ms";
    document.getElementById("stat-depth").textContent = stats.max_depth;
}

// ============================================================
// EVAL VALIDATION
// ============================================================

async function validateEval() {
    const code = document.getElementById("eval-editor").value;
    try {
        const response = await fetch("/api/chess/validate-eval", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                eval_code: code,
                fen: gameState.fen,
            }),
        });
        const data = await response.json();
        if (data.valid) {
            showEvalStatus(`Valide (score: ${data.score})`, true);
        } else {
            showEvalStatus(data.error, false);
        }
    } catch {
        showEvalStatus("Erreur de connexion", false);
    }
}

// ============================================================
// TREE VISUALIZATION (SVG)
// ============================================================

const NODE_W = 90;
const NODE_H = 52;
const NODE_GAP = 8;
const LEVEL_HEIGHT = 90;
const MAX_CHILDREN_DISPLAY = 10;

function createSVG(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        el.setAttribute(k, v);
    }
    return el;
}

function prepareTreeForDisplay(node) {
    if (!node || !node.children) return;

    if (node.children.length > MAX_CHILDREN_DISPLAY) {
        const bestIdx = node.children.findIndex(c => c.is_best_path);
        let shown = [];

        if (bestIdx >= 0 && bestIdx < MAX_CHILDREN_DISPLAY) {
            shown = node.children.slice(0, MAX_CHILDREN_DISPLAY);
        } else if (bestIdx >= MAX_CHILDREN_DISPLAY) {
            shown = node.children.slice(0, MAX_CHILDREN_DISPLAY - 1);
            shown.push(node.children[bestIdx]);
        } else {
            shown = node.children.slice(0, MAX_CHILDREN_DISPLAY);
        }

        node._displayChildren = shown;
        node._omitted = node.children.length - shown.length;
    } else {
        node._displayChildren = node.children;
        node._omitted = 0;
    }

    for (const child of node._displayChildren) {
        prepareTreeForDisplay(child);
    }
}

function layoutTree(node, depth) {
    depth = depth || 0;
    node._y = depth * LEVEL_HEIGHT;

    const children = node._displayChildren || [];

    if (children.length === 0) {
        node._width = NODE_W;
        node._x = 0;
        return NODE_W;
    }

    let totalWidth = 0;
    for (const child of children) {
        const cw = layoutTree(child, depth + 1);
        totalWidth += cw;
    }
    // Add extra width for omitted indicator
    if (node._omitted > 0) {
        totalWidth += 50;
    }
    totalWidth += Math.max(0, children.length - 1 + (node._omitted > 0 ? 1 : 0)) * NODE_GAP;

    node._width = Math.max(totalWidth, NODE_W);

    // Position children relative to parent center
    let xOffset = -totalWidth / 2;
    for (const child of children) {
        child._relX = xOffset + child._width / 2;
        xOffset += child._width + NODE_GAP;
    }

    if (node._omitted > 0) {
        node._omittedX = xOffset + 25;
    }

    return node._width;
}

function fmtVal(v) {
    if (v === "+inf" || v === "-inf") return v;
    if (typeof v === "number") {
        if (v >= 99000) return "+inf";
        if (v <= -99000) return "-inf";
        return v.toFixed(1);
    }
    return String(v);
}

function renderTreeNodeSVG(svg, node, cx, cy) {
    const isMax = node.is_maximizing;
    const isPruned = node.is_pruned;
    const isBest = node.is_best_path;

    let borderColor, fillColor;
    if (isPruned) {
        borderColor = "#555";
        fillColor = "#0a1520";
    } else if (isBest) {
        borderColor = isMax ? "#FFAB40" : "#85D5E6";
        fillColor = isMax ? "#2a3520" : "#0a2a3a";
    } else {
        borderColor = isMax ? "rgba(255,171,64,0.5)" : "rgba(133,213,230,0.5)";
        fillColor = "#0E2A47";
    }

    const g = createSVG("g", {});

    // Rectangle
    const rect = createSVG("rect", {
        x: cx - NODE_W / 2,
        y: cy,
        width: NODE_W,
        height: NODE_H,
        rx: 6,
        fill: fillColor,
        stroke: borderColor,
        "stroke-width": isBest ? 2.5 : 1,
        "stroke-dasharray": isPruned ? "4,3" : "none",
    });
    g.appendChild(rect);

    // Move label
    if (node.move) {
        const moveText = createSVG("text", {
            x: cx, y: cy + 15,
            "text-anchor": "middle",
            fill: isPruned ? "#666" : "#fff",
            "font-size": "11px",
            "font-weight": "bold",
            "font-family": "Arial, sans-serif",
        });
        moveText.textContent = node.move;
        g.appendChild(moveText);
    } else {
        const rootText = createSVG("text", {
            x: cx, y: cy + 15,
            "text-anchor": "middle",
            fill: "#FFAB40",
            "font-size": "10px",
            "font-weight": "bold",
            "font-family": "Arial, sans-serif",
        });
        rootText.textContent = isMax ? "MAX" : "MIN";
        g.appendChild(rootText);
    }

    // Alpha/Beta
    const abText = createSVG("text", {
        x: cx, y: cy + 29,
        "text-anchor": "middle",
        fill: "#78909C",
        "font-size": "8px",
        "font-family": "Arial, sans-serif",
    });
    abText.textContent = `\u03B1=${fmtVal(node.alpha)} \u03B2=${fmtVal(node.beta)}`;
    g.appendChild(abText);

    // Value or eval
    if (node.value !== null && node.value !== undefined) {
        const valText = createSVG("text", {
            x: cx, y: cy + 42,
            "text-anchor": "middle",
            fill: isBest ? "#FFAB40" : "#aaa",
            "font-size": "9px",
            "font-weight": "600",
            "font-family": "Arial, sans-serif",
        });
        if (node.is_leaf && node.eval_score !== null) {
            valText.textContent = `eval=${fmtVal(node.eval_score)}`;
        } else {
            valText.textContent = `val=${fmtVal(node.value)}`;
        }
        g.appendChild(valText);
    }

    // Pruned indicator
    if (isPruned) {
        const cutText = createSVG("text", {
            x: cx, y: cy + 42,
            "text-anchor": "middle",
            fill: "#e85d4a",
            "font-size": "8px",
            "font-weight": "bold",
            "font-family": "Arial, sans-serif",
        });
        cutText.textContent = "COUPE";
        g.appendChild(cutText);
    }

    svg.appendChild(g);

    // Render children
    const children = node._displayChildren || [];
    for (const child of children) {
        const childCx = cx + child._relX;
        const childCy = cy + LEVEL_HEIGHT;

        // Edge line
        const line = createSVG("line", {
            x1: cx, y1: cy + NODE_H,
            x2: childCx, y2: childCy,
            stroke: child.is_best_path ? (isMax ? "#FFAB40" : "#85D5E6") :
                    child.is_pruned ? "#444" : "#2a3a5c",
            "stroke-width": child.is_best_path ? 2 : 1,
            "stroke-dasharray": child.is_pruned ? "4,3" : "none",
        });
        svg.insertBefore(line, svg.firstChild); // Lines behind nodes

        renderTreeNodeSVG(svg, child, childCx, childCy);
    }

    // Omitted indicator
    if (node._omitted > 0 && node._omittedX !== undefined) {
        const omCx = cx + node._omittedX;
        const omCy = cy + LEVEL_HEIGHT;

        const omLine = createSVG("line", {
            x1: cx, y1: cy + NODE_H,
            x2: omCx, y2: omCy + 20,
            stroke: "#444",
            "stroke-width": 1,
            "stroke-dasharray": "3,3",
        });
        svg.insertBefore(omLine, svg.firstChild);

        const omText = createSVG("text", {
            x: omCx, y: omCy + 25,
            "text-anchor": "middle",
            fill: "#78909C",
            "font-size": "9px",
            "font-family": "Arial, sans-serif",
        });
        omText.textContent = `+${node._omitted}`;
        svg.appendChild(omText);
    }
}

function renderSearchTree(tree) {
    const container = document.getElementById("tree-container");
    if (!tree) {
        container.innerHTML = '<p class="tree-empty">Jouez un coup pour voir l\'arbre de recherche.</p>';
        return;
    }

    prepareTreeForDisplay(tree);
    const totalWidth = layoutTree(tree, 0);

    // Calculate tree depth for height
    let maxDepth = 0;
    function findMaxDepth(node, d) {
        if (d > maxDepth) maxDepth = d;
        for (const child of (node._displayChildren || [])) {
            findMaxDepth(child, d + 1);
        }
    }
    findMaxDepth(tree, 0);

    const svgWidth = Math.max(totalWidth + 40, 600);
    const svgHeight = (maxDepth + 1) * LEVEL_HEIGHT + NODE_H + 20;

    const svg = createSVG("svg", {
        id: "tree-svg",
        width: svgWidth,
        height: svgHeight,
        viewBox: `0 0 ${svgWidth} ${svgHeight}`,
    });

    const rootCx = svgWidth / 2;
    renderTreeNodeSVG(svg, tree, rootCx, 10);

    container.innerHTML = "";
    container.appendChild(svg);
}

// ============================================================
// GAME INITIALIZATION
// ============================================================

async function newGame(fen) {
    try {
        const response = await fetch("/api/chess/new", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fen ? { fen } : {}),
        });
        const data = await response.json();

        gameState.fen = data.fen;
        gameState.board = data.board;
        gameState.legalMoves = data.legal_moves;
        gameState.turn = data.turn;
        gameState.status = data.status;

        selectedSquare = null;
        lastMoveFrom = null;
        lastMoveTo = null;
        lastTree = null;

        if (!fen) {
            moveHistory = [];
            fenHistory = [];
            // Restore saved eval code, or use default
            const saved = loadSavedEvalCode();
            document.getElementById("eval-editor").value = saved || data.default_eval || "";
        }

        renderBoard();
        renderMoveHistory();
        showStatus("Vous jouez les blancs. A vous de jouer !", false);
        document.getElementById("search-stats").style.display = "none";
        document.getElementById("tree-container").innerHTML =
            '<p class="tree-empty">Jouez un coup pour voir l\'arbre de recherche.</p>';

    } catch (err) {
        showStatus("Erreur de connexion au serveur", true);
    }
}

async function undoMove() {
    if (fenHistory.length === 0 || isThinking) return;

    const previousFen = fenHistory.pop();
    // Also remove the last move from history
    moveHistory.pop();

    await newGame(previousFen);
    renderMoveHistory();
}

// ============================================================
// CODE EDITOR SETUP
// ============================================================

function setupEditor() {
    const editor = document.getElementById("eval-editor");

    // Tab handling
    editor.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
            e.preventDefault();
            const start = editor.selectionStart;
            editor.value = editor.value.substring(0, start) + "    " + editor.value.substring(editor.selectionEnd);
            editor.selectionStart = editor.selectionEnd = start + 4;
        }
    });

    // Debounced auto-validation
    let validateTimer = null;
    editor.addEventListener("input", () => {
        clearTimeout(validateTimer);
        validateTimer = setTimeout(validateEval, 1500);
    });
}

// ============================================================
// PRESET EVALUATION FUNCTIONS
// ============================================================

const EVAL_PRESETS = {
    material: `def evaluate(board):
    """Evaluation simple : comptage du materiel uniquement."""
    piece_values = {
        chess.PAWN: 100,
        chess.KNIGHT: 320,
        chess.BISHOP: 330,
        chess.ROOK: 500,
        chess.QUEEN: 900,
        chess.KING: 0,
    }

    score = 0
    for square, piece in board.piece_map().items():
        value = piece_values.get(piece.piece_type, 0)
        if piece.color == chess.WHITE:
            score += value
        else:
            score -= value

    return score
`,

    opening: `def evaluate(board):
    """Evaluation pour l'ouverture : developpement + centre + roque."""
    piece_values = {
        chess.PAWN: 100, chess.KNIGHT: 320,
        chess.BISHOP: 330, chess.ROOK: 500,
        chess.QUEEN: 900, chess.KING: 0,
    }

    score = 0

    # Materiel
    for sq, piece in board.piece_map().items():
        val = piece_values.get(piece.piece_type, 0)
        if piece.color == chess.WHITE:
            score += val
        else:
            score -= val

    # Controle du centre (e4, d4, e5, d5)
    center = [chess.E4, chess.D4, chess.E5, chess.D5]
    for sq in center:
        piece = board.piece_at(sq)
        if piece:
            if piece.piece_type == chess.PAWN:
                bonus = 30
            else:
                bonus = 15
            if piece.color == chess.WHITE:
                score += bonus
            else:
                score -= bonus

    # Developpement : cavaliers et fous hors rangee initiale
    for sq, piece in board.piece_map().items():
        if piece.piece_type in (chess.KNIGHT, chess.BISHOP):
            rank = chess.square_rank(sq)
            if piece.color == chess.WHITE and rank > 0:
                score += 20
            elif piece.color == chess.BLACK and rank < 7:
                score -= 20

    # Bonus roque
    if board.has_kingside_castling_rights(chess.WHITE):
        score += 10
    if board.has_queenside_castling_rights(chess.WHITE):
        score += 5
    if board.has_kingside_castling_rights(chess.BLACK):
        score -= 10
    if board.has_queenside_castling_rights(chess.BLACK):
        score -= 5

    # Penalite si dame sort trop tot (avant coup 10)
    if board.fullmove_number < 10:
        queen_sq = None
        for sq, piece in board.piece_map().items():
            if piece.piece_type == chess.QUEEN:
                rank = chess.square_rank(sq)
                if piece.color == chess.WHITE and rank > 1:
                    score -= 25
                elif piece.color == chess.BLACK and rank < 6:
                    score += 25

    return score
`,

    middlegame: `def evaluate(board):
    """Evaluation milieu de partie : materiel + mobilite + securite roi."""
    piece_values = {
        chess.PAWN: 100, chess.KNIGHT: 320,
        chess.BISHOP: 330, chess.ROOK: 500,
        chess.QUEEN: 900, chess.KING: 0,
    }

    # Tables de bonus positionnel (simplifiees, rang 0 = cote blanc)
    pawn_table = [
         0,  0,  0,  0,  0,  0,  0,  0,
        50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10,
         5,  5, 10, 25, 25, 10,  5,  5,
         0,  0,  0, 20, 20,  0,  0,  0,
         5, -5,-10,  0,  0,-10, -5,  5,
         5, 10, 10,-20,-20, 10, 10,  5,
         0,  0,  0,  0,  0,  0,  0,  0,
    ]

    knight_table = [
        -50,-40,-30,-30,-30,-30,-40,-50,
        -40,-20,  0,  0,  0,  0,-20,-40,
        -30,  0, 10, 15, 15, 10,  0,-30,
        -30,  5, 15, 20, 20, 15,  5,-30,
        -30,  0, 15, 20, 20, 15,  0,-30,
        -30,  5, 10, 15, 15, 10,  5,-30,
        -40,-20,  0,  5,  5,  0,-20,-40,
        -50,-40,-30,-30,-30,-30,-40,-50,
    ]

    score = 0

    for sq, piece in board.piece_map().items():
        val = piece_values.get(piece.piece_type, 0)
        rank = chess.square_rank(sq)
        file = chess.square_file(sq)

        # Index dans la table : pour les blancs on lit directement,
        # pour les noirs on inverse le rang
        if piece.color == chess.WHITE:
            idx = (7 - rank) * 8 + file
            score += val
        else:
            idx = rank * 8 + file
            score -= val

        # Bonus positionnel
        if piece.piece_type == chess.PAWN:
            bonus = pawn_table[idx]
        elif piece.piece_type == chess.KNIGHT:
            bonus = knight_table[idx]
        else:
            bonus = 0

        if piece.color == chess.WHITE:
            score += bonus
        else:
            score -= bonus

    # Mobilite (nombre de coups legaux)
    mobility = len(list(board.legal_moves))
    if board.turn == chess.WHITE:
        score += mobility * 2
    else:
        score -= mobility * 2

    # Paire de fous
    white_bishops = len(board.pieces(chess.BISHOP, chess.WHITE))
    black_bishops = len(board.pieces(chess.BISHOP, chess.BLACK))
    if white_bishops >= 2:
        score += 30
    if black_bishops >= 2:
        score -= 30

    return score
`,

    endgame: `def evaluate(board):
    """Evaluation fin de partie : materiel + roi actif + pions passes."""
    piece_values = {
        chess.PAWN: 120, chess.KNIGHT: 300,
        chess.BISHOP: 310, chess.ROOK: 500,
        chess.QUEEN: 900, chess.KING: 0,
    }

    score = 0
    total_material = 0

    for sq, piece in board.piece_map().items():
        val = piece_values.get(piece.piece_type, 0)
        total_material += val
        if piece.color == chess.WHITE:
            score += val
        else:
            score -= val

    # Centralisation du roi (important en finale)
    center_dist_bonus = [
        -30,-20,-10,  0,  0,-10,-20,-30,
        -20,-10,  0, 10, 10,  0,-10,-20,
        -10,  0, 10, 20, 20, 10,  0,-10,
          0, 10, 20, 30, 30, 20, 10,  0,
          0, 10, 20, 30, 30, 20, 10,  0,
        -10,  0, 10, 20, 20, 10,  0,-10,
        -20,-10,  0, 10, 10,  0,-10,-20,
        -30,-20,-10,  0,  0,-10,-20,-30,
    ]

    for sq, piece in board.piece_map().items():
        if piece.piece_type == chess.KING:
            rank = chess.square_rank(sq)
            file = chess.square_file(sq)
            if piece.color == chess.WHITE:
                idx = (7 - rank) * 8 + file
                score += center_dist_bonus[idx]
            else:
                idx = rank * 8 + file
                score -= center_dist_bonus[idx]

    # Pions passes (pas de pion adverse devant)
    for sq in board.pieces(chess.PAWN, chess.WHITE):
        file = chess.square_file(sq)
        rank = chess.square_rank(sq)
        is_passed = True
        for r in range(rank + 1, 8):
            for f in [file - 1, file, file + 1]:
                if 0 <= f <= 7:
                    s = chess.square(f, r)
                    p = board.piece_at(s)
                    if p and p.piece_type == chess.PAWN and p.color == chess.BLACK:
                        is_passed = False
                        break
            if not is_passed:
                break
        if is_passed:
            score += 20 + rank * 10

    for sq in board.pieces(chess.PAWN, chess.BLACK):
        file = chess.square_file(sq)
        rank = chess.square_rank(sq)
        is_passed = True
        for r in range(rank - 1, -1, -1):
            for f in [file - 1, file, file + 1]:
                if 0 <= f <= 7:
                    s = chess.square(f, r)
                    p = board.piece_at(s)
                    if p and p.piece_type == chess.PAWN and p.color == chess.WHITE:
                        is_passed = False
                        break
            if not is_passed:
                break
        if is_passed:
            score -= 20 + (7 - rank) * 10

    return score
`,
};

// ============================================================
// SAVE / LOAD EVAL FUNCTION
// ============================================================

const STORAGE_KEY = "chess_eval_code";

function saveEvalCode() {
    const code = document.getElementById("eval-editor").value;
    try {
        localStorage.setItem(STORAGE_KEY, code);
    } catch {
        // localStorage unavailable, ignore
    }
    // Visual feedback on the button itself
    const btn = document.getElementById("btn-save");
    const original = btn.textContent;
    btn.textContent = "Sauvegarde !";
    btn.style.background = "var(--success)";
    btn.style.borderColor = "var(--success)";
    btn.style.color = "#fff";
    setTimeout(() => {
        btn.textContent = original;
        btn.style.background = "";
        btn.style.borderColor = "";
        btn.style.color = "";
    }, 1500);
}

function loadSavedEvalCode() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return saved;
    } catch {
        // localStorage unavailable
    }
    return null;
}

function restoreEvalCode() {
    const saved = loadSavedEvalCode();
    if (saved) {
        document.getElementById("eval-editor").value = saved;
        // Switch back to editor if viewing doc
        if (docVisible) {
            toggleDocPanel();
        }
        validateEval();
    } else {
        const btn = document.getElementById("btn-load");
        const original = btn.textContent;
        btn.textContent = "Rien a charger";
        setTimeout(() => { btn.textContent = original; }, 1500);
    }
}

// ============================================================
// DOCUMENTATION PANEL
// ============================================================

let docVisible = false;

function toggleDocPanel() {
    docVisible = !docVisible;
    const editor = document.getElementById("eval-editor");
    const panel = document.getElementById("doc-panel");
    const btn = document.getElementById("btn-doc");
    if (docVisible) {
        editor.style.display = "none";
        panel.style.display = "";
        btn.textContent = "Editeur";
    } else {
        editor.style.display = "";
        panel.style.display = "none";
        btn.textContent = "Documentation";
    }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

document.getElementById("btn-new").addEventListener("click", () => newGame());
document.getElementById("btn-undo").addEventListener("click", undoMove);
document.getElementById("btn-validate").addEventListener("click", validateEval);
document.getElementById("btn-save").addEventListener("click", saveEvalCode);
document.getElementById("btn-load").addEventListener("click", restoreEvalCode);
document.getElementById("btn-doc").addEventListener("click", toggleDocPanel);

// Preset buttons
document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const preset = btn.dataset.preset;
        if (EVAL_PRESETS[preset]) {
            document.getElementById("eval-editor").value = EVAL_PRESETS[preset];
            validateEval();
        }
    });
});

// Depth selector
document.querySelectorAll(".depth-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".depth-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        searchDepth = parseInt(btn.dataset.depth);
    });
});

// Tree toggle
document.getElementById("btn-toggle-tree").addEventListener("click", () => {
    treeCollapsed = !treeCollapsed;
    const container = document.getElementById("tree-container");
    const btn = document.getElementById("btn-toggle-tree");
    if (treeCollapsed) {
        container.classList.add("collapsed");
        btn.textContent = "Deplier";
    } else {
        container.classList.remove("collapsed");
        btn.textContent = "Replier";
    }
});

// ============================================================
// INIT
// ============================================================

setupEditor();
newGame();
