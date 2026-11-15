# Neura-TN

Interactive demos and courses (in French) for understanding neural networks by manipulating them.
A small Flask + PyTorch backend serves the MNIST models and the chess engine; everything else runs in the browser.

## What's inside

**Demos**

| Route | Demo | Runs |
| --- | --- | --- |
| `/mnist` | Draw a digit and watch a fully connected network or a CNN classify it, layer by layer | server (PyTorch) |
| `/playground` | Train a small network on 2D datasets: layers, activation, learning rate, decision boundary | browser |
| `/flappy` | NEAT neuroevolution learning to play Flappy Bird | browser |
| `/car` | Draw a track, cars with ray sensors learn to drive it with NEAT | browser |
| `/gridworld` | Tabular Q-learning in an editable maze | browser |
| `/chess` | Play against Alpha-Beta with your own Python evaluation function, and inspect the search tree | server |

**Courses** (each with interactive challenges)

| Route | Course |
| --- | --- |
| `/cours/nn` | Neural networks: neurons, weights, activations, forward propagation |
| `/cours/apprentissage` | Gradient descent: loss, learning rate, momentum, backpropagation, overfitting |
| `/cours/cnn` | Convolutional networks: filters, convolution, pooling |
| `/cours/neat` | NEAT neuroevolution: mutations, crossover, speciation |
| `/cours/rl` | Reinforcement learning: exploration, discounting, the Q-learning update |

The app starts even if a model file is missing: the affected pages show a message asking you to run `python train.py`.

> **Security note.** The chess demo executes Python written by the visitor. The code is screened
> (no imports, no underscore names, restricted builtins, time limit) but this is not a real sandbox:
> do not expose the server to untrusted users on the open internet without extra isolation.

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
pip install .
python train.py
python app.py
```

Visit http://localhost:5000 to access the application.

## Project Structure

```
.
├── app.py                 # Flask application (pages + API)
├── chess_engine.py        # Alpha-Beta search with tree recording
├── train.py               # Model training script
├── static/
│   ├── index.html         # Landing page (landing.css, landing.js)
│   ├── site.css, site.js  # Shared design system and navigation menu
│   ├── nn.js              # Tiny MLP library (landing page, playground)
│   ├── neat.js            # NEAT library (flappy, car)
│   ├── fonts/             # Self-hosted fonts (OFL)
│   ├── mnist/ playground/ flappy/ car/ gridworld/ chess/
│   └── cours/             # nn/ apprentissage/ cnn/ neat/ rl/ + shared course.css, course.js
├── models/                # Trained model weights (generated)
├── data/                  # MNIST dataset (downloaded)
├── Dockerfile
├── docker-compose.yml
└── pyproject.toml
```

To add a page: create a folder with an `index.html` under `static/`, register its URL in `PAGES`
in `app.py`, and add it to the `PAGES` list in `static/site.js` so it appears in the menu.

## Technologies

- **Backend**: Flask, PyTorch
- **Frontend**: HTML, CSS, JavaScript
- **ML**: PyTorch models for MNIST (FC and CNN); NEAT, Q-learning and a small MLP in plain JavaScript
