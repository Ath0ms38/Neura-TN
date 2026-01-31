FROM python:3.12-slim

WORKDIR /app

# Copy dependency files first for layer caching
COPY requirements.txt ./

# Install dependencies using pip with PyTorch CPU version
RUN pip install --no-cache-dir --timeout=300 \
    torch==2.5.1+cpu torchvision==0.20.1+cpu \
    --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir --timeout=300 flask numpy

# Copy application code
COPY train.py app.py ./
COPY static/ static/

# Create models directory
RUN mkdir -p models data

EXPOSE 5000

# Train models on first run if they don't exist, then start the app
CMD ["sh", "-c", "test -f models/nn_model.pth || python train.py && python app.py"]
