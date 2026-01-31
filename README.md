# Neura-TN: MNIST Neural Network Visualizer

A web application for visualizing and interacting with neural networks trained on the MNIST dataset. Features both a fully connected neural network and a convolutional neural network (CNN) architecture.

## Features

- **Interactive MNIST Visualization**: Test different neural network architectures on handwritten digits
- **Two Model Types**: Compare fully connected neural networks with CNNs
- **Real-time Inference**: See predictions and activations in real-time
- **Additional Demos**: Includes Flappy Bird and Car simulation demos

## Running with Docker

### Prerequisites

- Docker installed on your system
- Docker Compose (optional but recommended)

### Quick Start with Pre-built Image

Pull and run the latest pre-built image from GitHub Container Registry:

```bash
docker run -d -p 5000:5000 ghcr.io/ath0ms38/neura-tn:latest
```

Or use Docker Compose with the pre-built image:

```yaml
services:
  neura-tn:
    image: ghcr.io/ath0ms38/neura-tn:latest
    ports:
      - "5000:5000"
    volumes:
      - ./models:/app/models
      - ./data:/app/data
```

### Option 1: Using Docker Compose (Recommended)

1. Build and start the application:
```bash
docker-compose up -d
```

2. Access the application at http://localhost:5000

3. Stop the application:
```bash
docker-compose down
```

### Option 2: Using Docker directly

1. Build the Docker image:
```bash
docker build -t neura-tn:latest .
```

2. Run the container:
```bash
docker run -d -p 5000:5000 --name neura-tn neura-tn:latest
```

3. Access the application at http://localhost:5000

4. Stop and remove the container:
```bash
docker stop neura-tn
docker rm neura-tn
```

### Training Models

The models need to be trained before running the application. You have two options:

#### Option A: Train locally then mount
1. Train the models locally:
```bash
python train.py
```

2. Run the container with the models mounted:
```bash
docker run -d -p 5000:5000 -v $(pwd)/models:/app/models -v $(pwd)/data:/app/data neura-tn:latest
```

Or use docker-compose which automatically mounts these directories.

#### Option B: Train inside the container
1. Run the container and execute training:
```bash
docker run -it --name neura-tn neura-tn:latest python train.py
```

2. Commit the changes to create a new image:
```bash
docker commit neura-tn neura-tn:trained
```

3. Run from the trained image:
```bash
docker run -d -p 5000:5000 neura-tn:trained python app.py
```

## Environment Variables

- `PYTHONUNBUFFERED=1`: Ensures Python output is sent directly to terminal (set by default in docker-compose)

## Volumes

The docker-compose setup mounts the following directories:
- `./models:/app/models` - Pre-trained model weights
- `./data:/app/data` - MNIST dataset cache

## Ports

- **5000**: Flask web server

## Local Development (without Docker)

### Requirements
- Python 3.12 or higher
- uv package manager (recommended) or pip

### Installation

Using uv:
```bash
uv sync
uv run python train.py
uv run python app.py
```

Using pip:
```bash
pip install -r requirements.txt
python train.py
python app.py
```

Visit http://localhost:5000 to access the application.

## Project Structure

```
.
├── app.py                 # Flask application
├── train.py              # Model training script
├── static/               # Static web assets
│   ├── mnist/           # MNIST visualizer
│   ├── flappy/          # Flappy Bird demo
│   ├── car/             # Car simulation demo
│   └── index.html       # Landing page
├── models/               # Trained model weights (generated)
├── data/                 # MNIST dataset (downloaded)
├── Dockerfile            # Docker image definition
├── docker-compose.yml    # Docker Compose configuration
├── pyproject.toml        # Python project configuration
└── requirements.txt      # Python dependencies
```

## Technologies

- **Backend**: Flask, PyTorch
- **Frontend**: HTML, CSS, JavaScript
- **ML**: Neural Networks (FC and CNN) for MNIST classification
