#!/bin/bash
cd "$(dirname "$0")" || exit 1
[ -d .venv ] || python3 -m venv .venv
source .venv/bin/activate
pip install -q fastapi "uvicorn[standard]" pydantic python-multipart openai pillow httpx
IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I | awk '{print $1}')
echo "En la app usa:  http://$IP:8000"
MOCK_MODE=1 uvicorn main:app --host 0.0.0.0 --port 8000
