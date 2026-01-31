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
COPY train.py app.py entrypoint.sh ./
COPY static/ static/

# Create models and data directories
RUN mkdir -p models data && \
    chmod +x entrypoint.sh

EXPOSE 5000

# Use entrypoint script to train models if needed and start the app
ENTRYPOINT ["./entrypoint.sh"]
