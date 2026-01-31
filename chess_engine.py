"""Chess engine with Alpha-Beta pruning and tree recording for visualization."""

import math
import threading
import time

import chess

# ============================================================
# DEFAULT EVALUATION FUNCTION
# ============================================================

DEFAULT_EVAL_CODE = '''\
def evaluate(board):
    """Evalue la position de l'echiquier.
    Retourne un score positif si les blancs sont mieux,
    negatif si les noirs sont mieux.

    Parametres disponibles:
        board - objet chess.Board (librairie python-chess)
        board.piece_map() - dict {case: piece}
        chess.PAWN, chess.KNIGHT, etc. - types de pieces
        piece.piece_type - type (1=pion, 2=cavalier, 3=fou, 4=tour, 5=dame, 6=roi)
        piece.color - couleur (True=blanc, False=noir)
        chess.square_rank(case) - rang de la case (0-7)
        chess.square_file(case) - colonne de la case (0-7)
        board.is_checkmate() - True si echec et mat
        board.is_check() - True si echec
        len(list(board.legal_moves)) - nombre de coups legaux
    """
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
'''

# ============================================================
# EVAL FUNCTION EXECUTION
# ============================================================

RESTRICTED_BUILTINS = {
    "len": len, "range": range, "sum": sum, "abs": abs,
    "min": min, "max": max, "int": int, "float": float,
    "bool": bool, "list": list, "dict": dict, "set": set,
    "tuple": tuple, "enumerate": enumerate, "zip": zip,
    "map": map, "filter": filter, "sorted": sorted,
    "reversed": reversed, "round": round, "pow": pow,
    "True": True, "False": False, "None": None,
    "isinstance": isinstance, "type": type,
    "print": lambda *a, **kw: None,  # silent print
}


def compile_user_eval(code_string):
    """Compile the user evaluation function.

    Returns (eval_fn, error_string). eval_fn is None on error.
    """
    namespace = {
        "chess": chess,
        "__builtins__": RESTRICTED_BUILTINS,
    }

    try:
        exec(code_string, namespace)
    except Exception as e:
        return None, f"Erreur de syntaxe: {e}"

    if "evaluate" not in namespace:
        return None, "Fonction 'evaluate(board)' non trouvee"

    if not callable(namespace["evaluate"]):
        return None, "'evaluate' n'est pas une fonction"

    return namespace["evaluate"], None


def execute_eval(eval_fn, board, timeout=2):
    """Execute the evaluation function with a timeout.

    Returns (score, error_string). error_string is None on success.
    """
    result_holder = [None, None]  # [score, error]

    def _run():
        try:
            val = eval_fn(board.copy())
            result_holder[0] = float(val)
        except Exception as e:
            result_holder[1] = f"Erreur d'execution: {e}"

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    t.join(timeout)

    if t.is_alive():
        return 0.0, "Temps d'execution depasse (2s)"

    if result_holder[1] is not None:
        return 0.0, result_holder[1]

    return result_holder[0], None


# ============================================================
# ALPHA-BETA WITH TREE RECORDING
# ============================================================

CHECKMATE_SCORE = 99999


def _order_moves(board):
    """Order moves: captures first (MVV-LVA), then checks, then rest."""
    captures = []
    checks = []
    others = []

    for move in board.legal_moves:
        if board.is_capture(move):
            # MVV-LVA ordering
            victim = board.piece_type_at(move.to_square) or 0
            attacker = board.piece_type_at(move.from_square) or 0
            captures.append((move, victim * 10 - attacker))
        else:
            board.push(move)
            if board.is_check():
                checks.append(move)
            else:
                others.append(move)
            board.pop()

    captures.sort(key=lambda x: -x[1])
    return [m for m, _ in captures] + checks + others


def _fmt_val(v):
    """Format a value for JSON output."""
    if v >= CHECKMATE_SCORE - 100:
        return "+inf"
    if v <= -CHECKMATE_SCORE + 100:
        return "-inf"
    return round(v, 1)


def alphabeta_with_tree(board, depth, alpha, beta, maximizing, eval_fn, counter):
    """Alpha-beta search that records the full tree for visualization.

    Args:
        board: chess.Board (mutated via push/pop)
        depth: remaining search depth
        alpha: alpha bound
        beta: beta bound
        maximizing: True for white (max), False for black (min)
        eval_fn: callable(board) -> float
        counter: [node_count, pruned_count] mutable list

    Returns:
        (value, tree_node_dict)
    """
    counter[0] += 1
    node_id = counter[0]

    node = {
        "id": node_id,
        "move": None,
        "depth": depth,
        "is_maximizing": maximizing,
        "alpha": _fmt_val(alpha),
        "beta": _fmt_val(beta),
        "value": None,
        "is_leaf": False,
        "is_pruned": False,
        "is_terminal": False,
        "eval_score": None,
        "children": [],
        "is_best_path": False,
    }

    # Terminal or leaf node
    if board.is_checkmate():
        score = -CHECKMATE_SCORE if maximizing else CHECKMATE_SCORE
        node["is_leaf"] = True
        node["is_terminal"] = True
        node["eval_score"] = _fmt_val(score)
        node["value"] = _fmt_val(score)
        return score, node

    if board.is_stalemate() or board.is_insufficient_material() or board.can_claim_draw():
        node["is_leaf"] = True
        node["is_terminal"] = True
        node["eval_score"] = 0.0
        node["value"] = 0.0
        return 0.0, node

    if depth == 0:
        score, err = execute_eval(eval_fn, board, timeout=2)
        if err:
            score = 0.0
        node["is_leaf"] = True
        node["eval_score"] = _fmt_val(score)
        node["value"] = _fmt_val(score)
        return score, node

    ordered_moves = _order_moves(board)

    if maximizing:
        max_eval = -math.inf
        for move in ordered_moves:
            board.push(move)
            child_val, child_node = alphabeta_with_tree(
                board, depth - 1, alpha, beta, False, eval_fn, counter
            )
            board.pop()

            child_node["move"] = board.san(move)
            node["children"].append(child_node)

            max_eval = max(max_eval, child_val)
            alpha = max(alpha, child_val)

            if beta <= alpha:
                counter[1] += 1
                # Mark remaining moves as pruned stubs
                remaining = ordered_moves[ordered_moves.index(move) + 1:]
                for pruned_move in remaining:
                    counter[0] += 1
                    counter[1] += 1
                    stub = {
                        "id": counter[0],
                        "move": board.san(pruned_move),
                        "depth": depth - 1,
                        "is_maximizing": False,
                        "alpha": _fmt_val(alpha),
                        "beta": _fmt_val(beta),
                        "value": None,
                        "is_leaf": True,
                        "is_pruned": True,
                        "is_terminal": False,
                        "eval_score": None,
                        "children": [],
                        "is_best_path": False,
                    }
                    node["children"].append(stub)
                break

        node["value"] = _fmt_val(max_eval)
        node["alpha"] = _fmt_val(alpha)
        node["beta"] = _fmt_val(beta)
        return max_eval, node

    else:
        min_eval = math.inf
        for move in ordered_moves:
            board.push(move)
            child_val, child_node = alphabeta_with_tree(
                board, depth - 1, alpha, beta, True, eval_fn, counter
            )
            board.pop()

            child_node["move"] = board.san(move)
            node["children"].append(child_node)

            min_eval = min(min_eval, child_val)
            beta = min(beta, child_val)

            if beta <= alpha:
                counter[1] += 1
                remaining = ordered_moves[ordered_moves.index(move) + 1:]
                for pruned_move in remaining:
                    counter[0] += 1
                    counter[1] += 1
                    stub = {
                        "id": counter[0],
                        "move": board.san(pruned_move),
                        "depth": depth - 1,
                        "is_maximizing": True,
                        "alpha": _fmt_val(alpha),
                        "beta": _fmt_val(beta),
                        "value": None,
                        "is_leaf": True,
                        "is_pruned": True,
                        "is_terminal": False,
                        "eval_score": None,
                        "children": [],
                        "is_best_path": False,
                    }
                    node["children"].append(stub)
                break

        node["value"] = _fmt_val(min_eval)
        node["alpha"] = _fmt_val(alpha)
        node["beta"] = _fmt_val(beta)
        return min_eval, node


def mark_best_path(node, target_value=None):
    """Mark the best path in the tree by setting is_best_path flags."""
    if target_value is None:
        target_value = node["value"]

    node["is_best_path"] = True

    if not node["children"]:
        return

    # Find the child whose value matches the target
    for child in node["children"]:
        if child["is_pruned"]:
            continue
        if child["value"] == node["value"]:
            mark_best_path(child, child["value"])
            break


# ============================================================
# BOARD HELPERS
# ============================================================

def board_to_array(board):
    """Convert chess.Board to 8x8 array for JSON.
    board[0] = rank 8 (top), board[7] = rank 1 (bottom).
    Uppercase = white, lowercase = black, None = empty.
    """
    result = []
    for rank in range(7, -1, -1):
        row = []
        for file in range(8):
            square = chess.square(file, rank)
            piece = board.piece_at(square)
            row.append(piece.symbol() if piece else None)
        result.append(row)
    return result


def get_legal_moves_uci(board):
    """Get all legal moves in UCI notation."""
    return [move.uci() for move in board.legal_moves]


def get_game_status(board):
    """Get game status string."""
    if board.is_checkmate():
        return "checkmate_black" if board.turn == chess.BLACK else "checkmate_white"
    if board.is_stalemate():
        return "stalemate"
    if board.is_insufficient_material() or board.can_claim_draw():
        return "draw"
    return "playing"


# ============================================================
# MAIN SEARCH FUNCTION
# ============================================================

def find_best_move(board, eval_code, depth=3):
    """Run alpha-beta search and return the best move with the full tree.

    Args:
        board: chess.Board instance (AI's turn to move)
        eval_code: Python source code with evaluate(board) function
        depth: search depth

    Returns dict with keys:
        ai_move: UCI string of best move (or None)
        ai_move_san: SAN string of best move (or None)
        tree: tree node dict
        eval_error: error string or None
        stats: { nodes_explored, nodes_pruned, search_time_ms }
    """
    # Compile eval function
    eval_fn, error = compile_user_eval(eval_code)

    if eval_fn is None:
        # Fallback: use default eval
        fallback_fn, _ = compile_user_eval(DEFAULT_EVAL_CODE)
        eval_fn = fallback_fn
        eval_error = error
    else:
        eval_error = None

    # AI plays as black (minimizing)
    maximizing = board.turn == chess.WHITE

    counter = [0, 0]  # [nodes_explored, nodes_pruned]
    start_time = time.time()

    value, tree = alphabeta_with_tree(
        board, depth, -math.inf, math.inf, maximizing, eval_fn, counter
    )

    elapsed_ms = round((time.time() - start_time) * 1000)

    # Mark the best path
    mark_best_path(tree)

    # The root node represents the current position; best move is the child on best path
    best_move = None
    best_move_san = None
    for child in tree["children"]:
        if child["is_best_path"] and not child["is_pruned"]:
            best_move_san = child["move"]
            break

    # Convert SAN to UCI
    if best_move_san:
        try:
            move = board.parse_san(best_move_san)
            best_move = move.uci()
        except ValueError:
            best_move = None
            best_move_san = None

    # Fallback if no best move found
    if best_move is None:
        legal = list(board.legal_moves)
        if legal:
            move = legal[0]
            best_move = move.uci()
            best_move_san = board.san(move)

    return {
        "ai_move": best_move,
        "ai_move_san": best_move_san,
        "tree": tree,
        "eval_error": eval_error,
        "stats": {
            "nodes_explored": counter[0],
            "nodes_pruned": counter[1],
            "search_time_ms": elapsed_ms,
            "max_depth": depth,
        },
    }
