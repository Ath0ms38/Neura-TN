"""Flask backend for MNIST Neural Network Visualizer."""

import json
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

nn_model = SimpleNN()
nn_model.load_state_dict(torch.load("models/nn_model.pth", weights_only=True))
nn_model.eval()

cnn_model = SimpleCNN()
cnn_model.load_state_dict(torch.load("models/cnn_model.pth", weights_only=True))
cnn_model.eval()

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

@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/mnist")
def mnist():
    return send_from_directory("static/mnist", "index.html")


@app.route("/flappy")
def flappy():
    return send_from_directory("static/flappy", "index.html")


@app.route("/car")
def car():
    return send_from_directory("static/car", "index.html")


@app.route("/chess")
def chess_page():
    return send_from_directory("static/chess", "index.html")


@app.route("/cours/nn")
def cours_nn():
    return send_from_directory("static/cours/nn", "index.html")


@app.route("/cours/cnn")
def cours_cnn():
    return send_from_directory("static/cours/cnn", "index.html")


@app.route("/cours/neat")
def cours_neat():
    return send_from_directory("static/cours/neat", "index.html")


@app.route("/static/<path:path>")
def serve_static(path):
    return send_from_directory("static", path)


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
    data = request.get_json()
    model_type = data.get("model", "nn")
    pixels = data.get("image")  # 28x28 array, normalized

    image_tensor = torch.tensor(pixels, dtype=torch.float32).unsqueeze(0)  # (1,28,28)

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
    data = request.get_json() or {}
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
    data = request.get_json()
    if not data:
        return jsonify({"error": "Donnees manquantes"}), 400

    fen = data.get("fen")
    user_move_uci = data.get("user_move")
    eval_code = data.get("eval_code", DEFAULT_EVAL_CODE)
    depth = min(int(data.get("depth", 3)), 4)

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
    data = request.get_json()
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
