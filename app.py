"""Flask backend for MNIST Neural Network Visualizer."""

import os
import random
import numpy as np
import torch
import torch.nn.functional as F
import chess
from flask import Flask, jsonify, request, send_from_directory
from torchvision import datasets, transforms

from train import SimpleNN, SimpleCNN
from chess_engine import (
    DEFAULT_EVAL_CODE, board_to_array, get_legal_moves_uci,
    get_game_status, find_best_move, compile_user_eval, execute_eval,
)

app = Flask(__name__, static_folder="static")

# --------------- Load models ---------------

def load_model(cls, path):
    """Load a trained model, or return None when its weights are missing."""
    if not os.path.exists(path):
        print(f"[warn] {path} introuvable : lancez `python train.py`.")
        return None
    model = cls()
    model.load_state_dict(torch.load(path, weights_only=True))
    model.eval()
    return model


nn_model = load_model(SimpleNN, "models/nn_model.pth")
cnn_model = load_model(SimpleCNN, "models/cnn_model.pth")

# --------------- Load test dataset ---------------

transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.1307,), (0.3081,)),
])

test_dataset = datasets.MNIST("data", train=False, download=True, transform=transform)

# Store raw (unnormalized) images for display
raw_transform = transforms.ToTensor()
raw_test_dataset = datasets.MNIST("data", train=False, download=True, transform=raw_transform)


# --------------- Activation extraction ---------------

def get_nn_activations(image_tensor):
    """Get intermediate activations for the fully connected NN."""
    activations = {}
    x = image_tensor.view(-1, 784)
    activations["input"] = image_tensor.squeeze().tolist()

    x = nn_model.fc1(x)
    x = nn_model.relu(x)
    activations["fc1_relu"] = x.squeeze().tolist()

    x = nn_model.fc2(x)
    x = nn_model.relu(x)
    activations["fc2_relu"] = x.squeeze().tolist()

    x = nn_model.fc3(x)
    probs = F.softmax(x, dim=1)
    activations["output"] = probs.squeeze().tolist()

    prediction = int(probs.argmax(dim=1).item())
    return prediction, activations


def get_cnn_activations(image_tensor):
    """Get intermediate activations for the CNN."""
    activations = {}
    x = image_tensor.unsqueeze(0)  # (1,1,28,28)
    activations["input"] = image_tensor.squeeze().tolist()

    # Conv1 + ReLU
    x = cnn_model.conv1(x)
    x = cnn_model.relu(x)
    conv1_maps = x.squeeze(0).detach()
    activations["conv1"] = {
        "shape": list(conv1_maps.shape),
        "maps": [conv1_maps[i].tolist() for i in range(conv1_maps.shape[0])],
    }

    # Pool1
    x = cnn_model.pool(x)
    pool1_maps = x.squeeze(0).detach()
    activations["pool1"] = {
        "shape": list(pool1_maps.shape),
        "maps": [pool1_maps[i].tolist() for i in range(pool1_maps.shape[0])],
    }

    # Conv2 + ReLU
    x = cnn_model.conv2(x)
    x = cnn_model.relu(x)
    conv2_maps = x.squeeze(0).detach()
    activations["conv2"] = {
        "shape": list(conv2_maps.shape),
        "maps": [conv2_maps[i].tolist() for i in range(conv2_maps.shape[0])],
    }

    # Pool2
    x = cnn_model.pool(x)
    pool2_maps = x.squeeze(0).detach()
    activations["pool2"] = {
        "shape": list(pool2_maps.shape),
        "maps": [pool2_maps[i].tolist() for i in range(pool2_maps.shape[0])],
    }

    # Flatten + FC
    x = x.view(-1, 64 * 7 * 7)
    x = cnn_model.fc1(x)
    x = cnn_model.relu(x)
    activations["fc1_relu"] = x.squeeze().tolist()

    x = cnn_model.fc2(x)
    probs = F.softmax(x, dim=1)
    activations["output"] = probs.squeeze().tolist()

    prediction = int(probs.argmax(dim=1).item())
    return prediction, activations


# --------------- Routes ---------------

# Every page is a static folder containing an index.html.
PAGES = {
    "/": "static",
    "/mnist": "static/mnist",
    "/playground": "static/playground",
    "/flappy": "static/flappy",
    "/car": "static/car",
    "/gridworld": "static/gridworld",
    "/chess": "static/chess",
    "/cours/nn": "static/cours/nn",
    "/cours/apprentissage": "static/cours/apprentissage",
    "/cours/cnn": "static/cours/cnn",
    "/cours/neat": "static/cours/neat",
    "/cours/rl": "static/cours/rl",
}


def _make_page_view(folder):
    def view():
        return send_from_directory(folder, "index.html")
    return view


for _url, _folder in PAGES.items():
    app.add_url_rule(
        _url,
        endpoint="page_" + (_url.strip("/").replace("/", "_") or "index"),
        view_func=_make_page_view(_folder),
        strict_slashes=False,
    )


@app.route("/static/<path:path>")
def serve_static(path):
    return send_from_directory("static", path)


@app.errorhandler(404)
def not_found(_error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Ressource introuvable"}), 404
    return send_from_directory("static", "404.html"), 404


@app.errorhandler(500)
def server_error(_error):
    # Les pages attendent toujours du JSON de la part de l'API.
    if request.path.startswith("/api/"):
        return jsonify({"error": "Erreur interne du serveur"}), 500
    return "Erreur interne du serveur", 500


MODEL_MISSING = "Modèle {} non entraîné : lancez `python train.py` puis redémarrez le serveur."


def parse_image(pixels):
    """Validate a client-supplied 28x28 image and return a (1, 28, 28) tensor."""
    try:
        tensor = torch.tensor(pixels, dtype=torch.float32)
    except (TypeError, ValueError, RuntimeError):
        return None
    if tensor.shape != (28, 28) or not torch.isfinite(tensor).all():
        return None
    return tensor.unsqueeze(0)


@app.route("/api/sample")
def get_sample():
    idx = random.randint(0, len(test_dataset) - 1)
    image, label = test_dataset[idx]
    raw_image, _ = raw_test_dataset[idx]
    return jsonify({
        "image": image.squeeze().tolist(),
        "raw_image": raw_image.squeeze().tolist(),
        "label": int(label),
    })


@app.route("/api/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True) or {}
    model_type = data.get("model", "nn")
    if model_type not in ("nn", "cnn"):
        return jsonify({"error": "Modele inconnu"}), 400

    image_tensor = parse_image(data.get("image"))  # 28x28 array, normalized
    if image_tensor is None:
        return jsonify({"error": "Image invalide : un tableau 28x28 est attendu"}), 400

    if (cnn_model if model_type == "cnn" else nn_model) is None:
        return jsonify({"error": MODEL_MISSING.format(model_type.upper())}), 503

    with torch.no_grad():
        if model_type == "cnn":
            prediction, activations = get_cnn_activations(image_tensor)
        else:
            prediction, activations = get_nn_activations(image_tensor)

    return jsonify({
        "prediction": prediction,
        "activations": activations,
    })


@app.route("/api/model-info/<model_type>")
def model_info(model_type):
    if model_type == "cnn":
        info = {
            "type": "cnn",
            "layers": [
                {"name": "Input", "type": "input", "shape": [1, 28, 28]},
                {"name": "Conv1 + ReLU", "type": "conv", "shape": [32, 28, 28], "kernel": 3},
                {"name": "MaxPool 2x2", "type": "pool", "shape": [32, 14, 14]},
                {"name": "Conv2 + ReLU", "type": "conv", "shape": [64, 14, 14], "kernel": 3},
                {"name": "MaxPool 2x2", "type": "pool", "shape": [64, 7, 7]},
                {"name": "Flatten + FC(128)", "type": "fc", "shape": [128]},
                {"name": "Output (10)", "type": "output", "shape": [10]},
            ],
        }
    else:
        info = {
            "type": "nn",
            "layers": [
                {"name": "Input (784)", "type": "input", "shape": [784]},
                {"name": "FC(128) + ReLU", "type": "fc", "shape": [128]},
                {"name": "FC(64) + ReLU", "type": "fc", "shape": [64]},
                {"name": "Output (10)", "type": "output", "shape": [10]},
            ],
        }
    return jsonify(info)


@app.route("/api/cnn-filters")
def cnn_filters():
    """Get Conv1 filters (weights) from the trained CNN model."""
    if cnn_model is None:
        return jsonify({"error": MODEL_MISSING.format("CNN")}), 503
    # Conv1 has shape [32, 1, 3, 3] (32 filters, 1 input channel, 3x3 kernel)
    conv1_weights = cnn_model.conv1.weight.data.cpu().numpy()

    # Extract first 8 filters for visualization
    filters = []
    for i in range(min(8, conv1_weights.shape[0])):
        # Get the 3x3 kernel for this filter (squeeze out the channel dimension)
        kernel = conv1_weights[i, 0, :, :].tolist()
        filters.append({
            "index": i,
            "kernel": kernel
        })

    return jsonify({"filters": filters})


# --------------- Chess API ---------------

@app.route("/api/chess/new", methods=["POST"])
def chess_new():
    data = request.get_json(silent=True) or {}
    fen = data.get("fen")
    try:
        board = chess.Board(fen) if fen else chess.Board()
    except ValueError:
        return jsonify({"error": "FEN invalide"}), 400

    return jsonify({
        "fen": board.fen(),
        "board": board_to_array(board),
        "legal_moves": get_legal_moves_uci(board),
        "turn": "white" if board.turn == chess.WHITE else "black",
        "status": get_game_status(board),
        "default_eval": DEFAULT_EVAL_CODE,
    })


@app.route("/api/chess/move", methods=["POST"])
def chess_move():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Donnees manquantes"}), 400

    fen = data.get("fen")
    user_move_uci = data.get("user_move")
    eval_code = data.get("eval_code", DEFAULT_EVAL_CODE)
    try:
        depth = max(1, min(int(data.get("depth", 3)), 4))
    except (TypeError, ValueError):
        depth = 3
    if not isinstance(eval_code, str):
        eval_code = DEFAULT_EVAL_CODE

    try:
        board = chess.Board(fen)
    except (ValueError, TypeError):
        return jsonify({"error": "FEN invalide"}), 400

    # Apply user move
    try:
        move = chess.Move.from_uci(user_move_uci)
        if move not in board.legal_moves:
            return jsonify({"error": "Coup illegal"}), 400
        user_move_san = board.san(move)
        board.push(move)
    except (ValueError, TypeError):
        return jsonify({"error": "Coup invalide"}), 400

    fen_after_user = board.fen()

    # Check game over after user move
    status = get_game_status(board)
    if status != "playing":
        return jsonify({
            "user_move_san": user_move_san,
            "ai_move": None,
            "ai_move_san": None,
            "fen_after_user": fen_after_user,
            "fen_after_ai": None,
            "board": board_to_array(board),
            "legal_moves": [],
            "turn": "black" if board.turn == chess.BLACK else "white",
            "status": status,
            "tree": None,
            "eval_error": None,
            "stats": None,
        })

    # AI plays
    result = find_best_move(board, eval_code, depth)

    if result["ai_move"]:
        ai_move = chess.Move.from_uci(result["ai_move"])
        board.push(ai_move)

    return jsonify({
        "user_move_san": user_move_san,
        "ai_move": result["ai_move"],
        "ai_move_san": result["ai_move_san"],
        "fen_after_user": fen_after_user,
        "fen_after_ai": board.fen(),
        "board": board_to_array(board),
        "legal_moves": get_legal_moves_uci(board),
        "turn": "white" if board.turn == chess.WHITE else "black",
        "status": get_game_status(board),
        "tree": result["tree"],
        "eval_error": result["eval_error"],
        "stats": result["stats"],
    })


@app.route("/api/chess/validate-eval", methods=["POST"])
def chess_validate_eval():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Donnees manquantes"}), 400

    eval_code = data.get("eval_code", "")
    fen = data.get("fen")

    try:
        board = chess.Board(fen) if fen else chess.Board()
    except (ValueError, TypeError):
        board = chess.Board()

    eval_fn, error = compile_user_eval(eval_code)
    if error:
        return jsonify({"valid": False, "score": None, "error": error})

    score, exec_error = execute_eval(eval_fn, board)
    if exec_error:
        return jsonify({"valid": False, "score": None, "error": exec_error})

    return jsonify({"valid": True, "score": round(score, 1), "error": None})


if __name__ == "__main__":
    print("Starting Neura'TN on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
