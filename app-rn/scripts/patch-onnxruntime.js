// Parche para onnxruntime-react-native (<= 1.24.3) con React Native 0.88+.
// RN 0.88 eliminó RCTCxxBridge (arquitectura legacy). En modo bridgeless,
// el módulo recibe un RCTBridgeProxy que expone -runtime y -jsCallInvoker,
// así que obtenemos el runtime JSI desde ahí. Idempotente: se puede correr
// varias veces (va en "postinstall").
const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname, '..', 'node_modules', 'onnxruntime-react-native', 'ios', 'OnnxruntimeModule.mm'
);
const TAG = 'QUICKCOTI_PATCH';

if (!fs.existsSync(file)) {
  console.log('[patch-onnxruntime] onnxruntime-react-native no está instalado; nada que hacer');
  process.exit(0);
}

let src = fs.readFileSync(file, 'utf8');
if (src.includes(TAG)) {
  console.log('[patch-onnxruntime] ya aplicado');
  process.exit(0);
}

const importAnchor = '#import <jsi/jsi.h>\n';
const oldBody = [
  '    RCTCxxBridge* cxxBridge = (RCTCxxBridge*)_bridge;',
  '    if (cxxBridge == nil) {',
  '      return @false;',
  '    }',
  '',
  '    auto jsiRuntime = (facebook::jsi::Runtime*)cxxBridge.runtime;',
].join('\n');
const newBody = [
  `    // ${TAG}: RN 0.88 ya no tiene RCTCxxBridge. En bridgeless, _bridge es un`,
  '    // RCTBridgeProxy que implementa -runtime.',
  '    id bridge = _bridge;',
  '    if (bridge == nil || !class_respondsToSelector(object_getClass(bridge), @selector(runtime))) {',
  '      return @false;',
  '    }',
  '',
  '    auto jsiRuntime = (facebook::jsi::Runtime*)[(id<ORTRuntimeProvider>)bridge runtime];',
].join('\n');
const protocolDecl = [
  '#import <objc/runtime.h>',
  '',
  `// ${TAG}: selector que expone RCTBridgeProxy (y RCTCxxBridge en modo legacy).`,
  '@protocol ORTRuntimeProvider <NSObject>',
  '- (void*)runtime;',
  '@end',
  '',
].join('\n');

if (!src.includes(oldBody) || !src.includes(importAnchor)) {
  console.error('[patch-onnxruntime] El archivo cambió y el parche ya no coincide. Revisa ' + file);
  process.exit(1);
}

src = src.replace(importAnchor, importAnchor + protocolDecl).replace(oldBody, newBody);
fs.writeFileSync(file, src);
console.log('[patch-onnxruntime] parche aplicado a OnnxruntimeModule.mm');
