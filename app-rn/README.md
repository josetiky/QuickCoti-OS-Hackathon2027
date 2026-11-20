# QuickCoti OS — React Native + QVAC (IA local en el iPhone)

## 1. Instalar y correr en tu iPhone (≈20 min la primera vez)
```bash
cd evento/app-rn
npm install
npx expo install --fix          # alinea versiones con Expo SDK 58
npx expo prebuild --clean       # genera ios/ con QVAC (plugin @qvac/sdk/expo-plugin)
npx expo run:ios --device       # iPhone conectado por cable. QVAC NO corre en simulador
```
Si Xcode pide firma: abre `ios/QuickCoti.xcworkspace` → Signing & Capabilities → tu Apple ID (Personal Team).
Después de cada `npm install` vuelve a correr `npx expo prebuild` (QVAC lo pide).

## 2. Modelos al iPhone
En la Mac, con los archivos entrenados en `evento/models/` (`quickcoti-lora.gguf`, `quickcoti_vision.onnx`):
```bash
cd evento/models && python3 -m http.server 8080
```
App → Ajustes → Servidor de modelos `http://IP_DE_TU_MAC:8080` → **Descargar modelos** → **Cargar IA local (QVAC)**.
La primera carga baja el modelo base Qwen3-1.7B de QVAC (~1 GB, usa buen Wi-Fi).

## 3. Pagos reales celular a celular (Mercado Pago)
```bash
evento/backend/iniciar_pagos.command      # pega tu Access Token TEST-... (no se guarda)
```
App → Ajustes → Servidor de pagos `http://IP_DE_TU_MAC:8000` → Probar conexión.
Tarjetas de prueba de Mercado Pago: titular `APRO` = aprobada, `OTHE` = rechazada (caso de fallo para el jurado).

## 4. Pruebas
```bash
npm run test:rules        # 9 casos del motor de reglas (evidencia)
```

## Qué corre dónde
| Componente | Dónde | Entrenado por el equipo |
|---|---|---|
| Detector de zonas YOLO (`quickcoti_vision.onnx`) | iPhone (onnxruntime) | ✅ servidor NVIDIA + TensorRT |
| OCR EasyOCR latino (QVAC) | iPhone | ❌ preentrenado, complemento declarado |
| Hermes: Qwen3-1.7B + LoRA (QVAC) | iPhone | ✅ LoRA (QVAC finetune o PEFT→GGUF) |
| Reglas + bitácora SHA-256 | iPhone | — (reglas verificables) |
| Mercado Pago | Mac (guarda el token) → API MP | — (sandbox real) |
| CoDi | Mac | SIMULADO |
