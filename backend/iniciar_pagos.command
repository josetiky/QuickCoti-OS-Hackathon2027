#!/bin/bash
# Solo pagos (la IA ya corre en el iPhone con QVAC). Pide el token de PRUEBA de Mercado Pago sin guardarlo en disco.
cd "$(dirname "$0")" || exit 1
[ -d .venv ] || python3 -m venv .venv
source .venv/bin/activate
pip install -q fastapi "uvicorn[standard]" pydantic python-multipart openai pillow httpx
if [ -z "$MP_ACCESS_TOKEN" ]; then read -s -p "Pega tu MP_ACCESS_TOKEN (TEST-...): " MP_ACCESS_TOKEN; echo; export MP_ACCESS_TOKEN; fi
IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I | awk '{print $1}')
echo "En la app → Ajustes → Servidor de pagos:  http://$IP:8000"
MOCK_MODE=1 uvicorn main:app --host 0.0.0.0 --port 8000
