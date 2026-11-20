#!/bin/bash
# Sirve el modelo ajustado con QVAC (API compatible con OpenAI) en http://127.0.0.1:11435/v1  (modelo: "quickcoti")
cd "$(dirname "$0")" || exit 1
command -v qvac >/dev/null || npm install -g @qvac/cli
if ! qvac serve --openai -p 11435; then
  echo "⚠️  QVAC no levantó con qvac.config.json (revisa el campo 'type' en docs.qvac.tether.io/cli/http-server)."
  echo "   Plan B equivalente (mismo motor llama.cpp):  brew install llama.cpp && \\"
  echo "   llama-server -m ../models/quickcoti-merged-q8_0.gguf --port 11435 --alias quickcoti -c 4096"
fi
