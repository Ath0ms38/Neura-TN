#!/bin/sh
# Docker entrypoint script for Neura-TN

set -e

# Check if models exist
if [ ! -f "models/nn_model.pth" ] || [ ! -f "models/cnn_model.pth" ]; then
    echo "Models not found. Training models..."
    python train.py
    echo "Training complete!"
else
    echo "Models found. Skipping training."
fi

# Start the Flask application
echo "Starting Neura-TN on http://0.0.0.0:5000"
exec python app.py
