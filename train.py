"""Train NN and CNN models on MNIST and save weights."""

import os
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms
from torch.utils.data import DataLoader


# --------------- Model Definitions ---------------

class SimpleNN(nn.Module):
    """Fully connected neural network: 784 -> 128 -> 64 -> 10"""
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(784, 128)
        self.fc2 = nn.Linear(128, 64)
        self.fc3 = nn.Linear(64, 10)
        self.relu = nn.ReLU()

    def forward(self, x):
        x = x.view(-1, 784)
        x = self.relu(self.fc1(x))
        x = self.relu(self.fc2(x))
        x = self.fc3(x)
        return x


class SimpleCNN(nn.Module):
    """CNN: Conv(32) -> Pool -> Conv(64) -> Pool -> FC(128) -> FC(10)"""
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 32, kernel_size=3, padding=1)
        self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.pool = nn.MaxPool2d(2, 2)
        self.relu = nn.ReLU()
        self.fc1 = nn.Linear(64 * 7 * 7, 128)
        self.fc2 = nn.Linear(128, 10)

    def forward(self, x):
        x = self.pool(self.relu(self.conv1(x)))   # (B,32,14,14)
        x = self.pool(self.relu(self.conv2(x)))    # (B,64,7,7)
        x = x.view(-1, 64 * 7 * 7)
        x = self.relu(self.fc1(x))
        x = self.fc2(x)
        return x


# --------------- Training ---------------

def train_model(model, train_loader, epochs=5, lr=0.001):
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)
    model.train()

    for epoch in range(epochs):
        running_loss = 0.0
        correct = 0
        total = 0
        for images, labels in train_loader:
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item()
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()

        acc = 100.0 * correct / total
        avg_loss = running_loss / len(train_loader)
        print(f"  Epoch {epoch+1}/{epochs} - Loss: {avg_loss:.4f} - Acc: {acc:.2f}%")


def evaluate(model, test_loader):
    model.eval()
    correct = 0
    total = 0
    with torch.no_grad():
        for images, labels in test_loader:
            outputs = model(images)
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
    return 100.0 * correct / total


def main():
    os.makedirs("models", exist_ok=True)

    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,)),
    ])

    print("Downloading MNIST dataset...")
    train_dataset = datasets.MNIST("data", train=True, download=True, transform=transform)
    test_dataset = datasets.MNIST("data", train=False, download=True, transform=transform)

    train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=1000, shuffle=False)

    # Train NN
    print("\n=== Training Neural Network (FC) ===")
    nn_model = SimpleNN()
    train_model(nn_model, train_loader, epochs=5)
    nn_acc = evaluate(nn_model, test_loader)
    print(f"  Test Accuracy: {nn_acc:.2f}%")
    torch.save(nn_model.state_dict(), "models/nn_model.pth")
    print("  Saved to models/nn_model.pth")

    # Train CNN
    print("\n=== Training CNN ===")
    cnn_model = SimpleCNN()
    train_model(cnn_model, train_loader, epochs=5)
    cnn_acc = evaluate(cnn_model, test_loader)
    print(f"  Test Accuracy: {cnn_acc:.2f}%")
    torch.save(cnn_model.state_dict(), "models/cnn_model.pth")
    print("  Saved to models/cnn_model.pth")

    print("\nDone!")


if __name__ == "__main__":
    main()
