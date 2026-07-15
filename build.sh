#!/bin/bash
set -e

echo "==> Installing Go..."
wget -q https://go.dev/dl/go1.22.4.linux-amd64.tar.gz
tar -xf go1.22.4.linux-amd64.tar.gz
export PATH=$PATH:$(pwd)/go/bin
export GOPATH=$(pwd)/.gopath
go version

echo "==> Building Go server..."
go build -ldflags="-s -w" -o anavai-server .
echo "==> Build complete! Binary: $(ls -lh anavai-server)"
rm -rf go1.22.4.linux-amd64.tar.gz go/
