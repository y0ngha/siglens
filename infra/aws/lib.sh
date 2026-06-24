#!/usr/bin/env bash
set -euo pipefail
log() { echo "[infra] $*"; }
require() { command -v "$1" >/dev/null || { echo "need $1"; exit 1; }; }
