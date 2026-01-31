# Docker Deployment Guide for Neura-TN

This guide provides detailed instructions for building and running Neura-TN using Docker.

## Quick Start

### Using Pre-built Image (Fastest)

Pull the latest image from GitHub Container Registry:

```bash
docker run -d -p 5000:5000 ghcr.io/ath0ms38/neura-tn:latest
```

Visit http://localhost:5000 (models will train automatically on first run)

### Building from Source

```bash
docker-compose up
```

Wait for the models to train (first run only, takes ~5 minutes), then visit http://localhost:5000

## Pre-built Docker Images

Docker images are automatically built and published to GitHub Container Registry via GitHub Actions on every push to main and on tagged releases.

### Available Tags

- `latest` - Latest build from the main branch
- `main` - Latest build from the main branch
- `v*` - Specific version tags (e.g., `v1.0.0`)
- `sha-*` - Build from specific commit

### Pulling Images

```bash
# Latest version
docker pull ghcr.io/ath0ms38/neura-tn:latest

# Specific version
docker pull ghcr.io/ath0ms38/neura-tn:v1.0.0
```

## Building the Docker Image

### Using Docker Compose (Recommended)

```bash
docker-compose build
```

### Using Docker directly

```bash
docker build -t neura-tn:latest .
```

## Running the Application

### Option 1: Docker Compose with Persistent Models

This is the recommended approach as it:
- Persists trained models between container restarts
- Persists downloaded MNIST data
- Automatically restarts on failure

```bash
docker-compose up -d
```

To view logs:
```bash
docker-compose logs -f
```

To stop:
```bash
docker-compose down
```

### Option 2: Docker Run with Volume Mounts

If you prefer not to use Docker Compose:

```bash
docker run -d \
  -p 5000:5000 \
  -v $(pwd)/models:/app/models \
  -v $(pwd)/data:/app/data \
  --name neura-tn \
  neura-tn:latest
```

### Option 3: Standalone Container (No Persistence)

Run without volume mounts (models will be lost when container stops):

```bash
docker run -d -p 5000:5000 --name neura-tn neura-tn:latest
```

**Note:** The first time you run this, the container will automatically train the models, which takes approximately 5 minutes.

## Pre-training Models

If you want to pre-train the models to avoid the wait time on first container start:

### Option A: Train in a temporary container

```bash
# Run training
docker run --rm -v $(pwd)/models:/app/models -v $(pwd)/data:/app/data neura-tn:latest python train.py

# Now start the application with pre-trained models
docker-compose up -d
```

### Option B: Train locally and mount

If you have Python and dependencies installed locally:

```bash
# Install dependencies
pip install -r requirements.txt

# Train models
python train.py

# Run with mounted models
docker-compose up -d
```

## Accessing the Application

Once the container is running, access the application at:

- Main landing page: http://localhost:5000
- MNIST visualizer: http://localhost:5000/mnist
- Flappy Bird demo: http://localhost:5000/flappy
- Car simulation: http://localhost:5000/car

## Container Management

### View logs
```bash
# Using Docker Compose
docker-compose logs -f

# Using Docker
docker logs -f neura-tn
```

### Stop the container
```bash
# Using Docker Compose
docker-compose stop

# Using Docker
docker stop neura-tn
```

### Restart the container
```bash
# Using Docker Compose
docker-compose restart

# Using Docker
docker restart neura-tn
```

### Remove the container
```bash
# Using Docker Compose
docker-compose down

# Using Docker
docker stop neura-tn && docker rm neura-tn
```

## Troubleshooting

### Container exits immediately

Check the logs:
```bash
docker logs neura-tn
```

Common issues:
- **Missing models**: The container will automatically train them on first run
- **Port already in use**: Change the port mapping in docker-compose.yml or use `-p 8080:5000`
- **Network issues during training**: The MNIST dataset download may fail; retry or pre-download the data

### Models not persisting

Make sure you're using volume mounts:
- Check that docker-compose.yml has the volumes section
- Verify that `./models` and `./data` directories exist and have proper permissions

### Slow first start

The first time the container runs, it needs to:
1. Download the MNIST dataset (~10 MB)
2. Train two neural networks (~5 minutes on CPU)

Subsequent starts will be instant as the models are cached.

## Production Deployment

For production deployments, consider:

1. **Use a reverse proxy** (nginx, Traefik, etc.) in front of the Flask app
2. **Enable HTTPS** with proper SSL certificates
3. **Use a production WSGI server** like gunicorn instead of Flask's development server
4. **Set environment variables** for configuration
5. **Monitor container health** and set up automatic restarts
6. **Limit container resources** using Docker's resource constraints

Example production Dockerfile modifications:

```dockerfile
# Add gunicorn
RUN pip install --no-cache-dir gunicorn

# Change the entrypoint to use gunicorn
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

## Environment Variables

Currently, the application doesn't require environment variables, but you can add them in docker-compose.yml:

```yaml
environment:
  - FLASK_ENV=production
  - PYTHONUNBUFFERED=1
```

## Resource Requirements

Minimum requirements:
- **CPU**: 2 cores
- **RAM**: 2 GB
- **Disk**: 500 MB (for dependencies, models, and data)

During training (first run):
- **CPU**: Utilizes all available cores
- **RAM**: Up to 3 GB
- **Time**: ~5 minutes on a modern CPU

## Security Considerations

1. The container runs as root by default - consider using a non-root user
2. Flask's development server is used - replace with gunicorn for production
3. No authentication is implemented - add authentication for production use
4. No HTTPS - use a reverse proxy with SSL for production

## Advanced: Multi-stage Build

For a smaller production image, you could use a multi-stage build, but the current single-stage build is optimized for development and quick iteration.

## CI/CD - Automated Docker Image Building

The repository uses GitHub Actions to automatically build and publish Docker images to GitHub Container Registry (GHCR).

### Workflow Triggers

The Docker image is built and published automatically when:

1. **Push to main or develop branch** - Creates images tagged with branch name and `latest` (for main)
2. **Version tags** - When you create a tag like `v1.0.0`, it creates versioned images
3. **Pull requests** - Builds the image to verify it works (doesn't publish)
4. **Manual trigger** - Can be triggered manually from GitHub Actions tab

### Image Tags Generated

- `latest` - Always points to the latest main branch build
- `main` - Latest build from main branch
- `develop` - Latest build from develop branch
- `v1.0.0` - Specific version tag
- `v1.0` - Major.minor version
- `v1` - Major version only
- `main-sha-abc1234` - Specific commit SHA

### Workflow Features

- **Build caching** - Uses GitHub Actions cache to speed up builds
- **Multi-platform support** - Currently builds for linux/amd64 (can be extended)
- **Attestation** - Generates build provenance for security
- **Automated tagging** - Smart tagging based on git refs

### Using Published Images

After the workflow runs, you can pull images:

```bash
# Latest version
docker pull ghcr.io/ath0ms38/neura-tn:latest

# Specific version
docker pull ghcr.io/ath0ms38/neura-tn:v1.0.0

# Specific branch
docker pull ghcr.io/ath0ms38/neura-tn:main
```

### Creating a Release

To create a new versioned release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This will trigger the workflow and create images tagged as `v1.0.0`, `v1.0`, `v1`, and `latest`.

### Viewing Build Status

Check the Actions tab in the GitHub repository to see:
- Build status and logs
- Published image tags
- Build artifacts and attestations

## Support

For issues related to:
- Docker: Check Docker and Docker Compose documentation
- Application: See the main README.md
- Models: See train.py for model architecture details
- CI/CD: Check `.github/workflows/docker-build.yml` and GitHub Actions logs
