"""Flask backend for MNIST Neural Network Visualizer."""

import json
import random
import numpy as np
import torch
import torch.nn.functional as F
from flask import Flask, jsonify, request, send_from_directory
from torchvision import datasets, transforms

from train import SimpleNN, SimpleCNN

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


if __name__ == "__main__":
    print("Starting Neura'TN on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
