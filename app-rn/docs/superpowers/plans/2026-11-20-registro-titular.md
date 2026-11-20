# Registro del titular — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Formulario obligatorio de datos del titular (nombre, CURP, CLABE; teléfono opcional) con aviso de privacidad, guardado en Keychain, al final de la entrevista.

**Architecture:** Validadores puros en `src/titular/valida.ts` (probados con tsx). Persistencia en `src/titular/secure.ts` (expo-secure-store). Pantalla `TitularScreen` (aviso → formulario) usada por la entrevista, por App.tsx como compuerta y por Ajustes en modo editar. El store solo guarda en memoria un resumen `titular`.

**Tech Stack:** Expo SDK 58, React Native, zustand, expo-secure-store, tsx (selftests).

**Spec:** `docs/superpowers/specs/2026-11-20-registro-titular-design.md`

## Global Constraints
- Obligatorios: nombre completo (≥2 palabras), CURP, CLABE. Teléfono opcional (si se llena, 10 dígitos).
- CURP, CLABE, teléfono y nombre NUNCA van a: Hermes/LLM, ledger SHA-256, AsyncStorage, console.log, QR o ticket completos.
- Máscaras: CLABE `•••• ` + últimos 4; CURP primeros 4 + `••••••••••` + últimos 2; tel `•••••• ` + últimos 4.
- Datos DEMO ficticios marcados `demo: true` y con etiqueta "DEMO" visible.
- UI con componentes de `src/ui.tsx` (Field warn, ToggleRow, Btn, Banner); accesible (labels, `announce`).
- Sin commits de git: en la carpeta conectada git deja `.lock` (no hay permiso de borrar). Tiki hace commit en su Mac.

## Review Focus
- CURP escrita en minúsculas o con espacios → se normaliza (trim, mayúsculas) antes de validar.
- CLABE pegada con espacios o guiones → se limpian a dígitos.
- Instalación previa con perfil ya creado y sin titular → al abrir, la app pide el registro (no entra a Main).
- Re-entrevista desde el menú con titular ya guardado → no vuelve a pedir el formulario.
- Keychain no disponible / error al guardar → Banner de error, no se crea el espacio, no se pierde lo tecleado.

---

### Task 1: Validadores y máscaras

**Files:**
- Create: `src/titular/valida.ts`
- Test: `src/titular/valida.selftest.ts`; Modify: `package.json` (script `"test:titular": "npx tsx src/titular/valida.selftest.ts"`)

**Interfaces:**
- Produces:
  - `type Titular = { nombre: string; curp: string; clabe: string; telefono?: string; demo?: boolean; aceptoAviso: string /* ISO fecha */ }`
  - `normCURP(s: string): string`, `soloDigitos(s: string): string`
  - `validarCURP(s: string): string | null` (null = ok, string = motivo en español)
  - `validarCLABE(s: string): string | null`, `validarTel(s: string): string | null` ('' → null), `validarNombre(s: string): string | null`
  - `validarTitular(t: Omit<Titular,'aceptoAviso'>): { nombre?: string; curp?: string; clabe?: string; telefono?: string }` (vacío = ok)
  - `mascaraCLABE(s)`, `mascaraCURP(s)`, `mascaraTel(s)`: string
  - `DEMO_TITULAR: Omit<Titular,'aceptoAviso'>` = nombre "Usuario Demo QuickCoti", CURP ficticia que pase `validarCURP` (base `XEXX010101HOCXXX0` + dígito calculado), CLABE ficticia `00218000000000000` + dígito calculado, `demo: true`.

Algoritmos:
- CURP regex `^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HMX](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$`; dígito: diccionario `0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ`, suma de valor(c_i)·(18−i) para i=0..16, verificador = (10 − suma mod 10) mod 10.
- CLABE: 18 dígitos; pesos 3,7,1 repetidos en los 17 primeros; suma de (d·w mod 10); verificador = (10 − suma mod 10) mod 10.

- [ ] **Step 1: Write the failing test** (asserts con `node:assert`):
  - `validarCURP(DEMO_TITULAR.curp) === null`; `validarCURP(' ' + DEMO_TITULAR.curp.toLowerCase() + ' ') === null`
  - CURP demo con último dígito cambiado → mensaje contiene "dígito"
  - `validarCURP('ABC')` → mensaje contiene "18"
  - `validarCLABE(DEMO_TITULAR.clabe) === null`; con espacios/guiones intercalados → null; último dígito cambiado → contiene "control"; 17 dígitos → contiene "18"
  - `validarTel('')===null`, `validarTel('951 000 0000')===null`, `validarTel('12345')` no null
  - `validarNombre('Ana')` no null; `validarNombre('Ana López')===null`
  - `validarTitular({...DEMO_TITULAR, curp:''})` tiene clave `curp`
  - `mascaraCLABE('002180000000000003')==='•••• 0003'`; `mascaraCURP(curp)` empieza con 4 letras y termina con 2 chars, longitud 16
- [ ] **Step 2:** `npm run test:titular` → FAIL (módulo no existe)
- [ ] **Step 3:** Implementar `src/titular/valida.ts` (sin imports nativos)
- [ ] **Step 4:** `npm run test:titular` → imprime `OK titular` y sale 0

### Task 2: Almacenamiento seguro + store

**Files:**
- Create: `src/titular/secure.ts`
- Modify: `src/store.ts` (quitar `clabe` de estado inicial y de `partialize`; añadir `titular`, `titularCargado`, `setTitular`), `src/screens/SaleScreen.tsx:85` (`st.clabe` → `st.titular?.clabe ?? ''`), `package.json` (`npx expo install expo-secure-store`)

**Interfaces:**
- Consumes: `Titular` (Task 1)
- Produces:
  - `cargarTitular(): Promise<Titular | null>`, `guardarTitular(t: Titular): Promise<void>`, `borrarTitular(): Promise<void>` — clave `quickcoti.titular`, opción `keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY`; errores se propagan (no se tragan).
  - store: `titular: Titular | null` (NO persistido), `titularCargado: boolean`, `setTitular(t: Titular | null): void`, y `clabeLegada: string` derivado: al hidratar, si el JSON viejo traía `clabe`, se conserva en memoria solo para prellenar el formulario y nunca se vuelve a escribir.
  - `iniciarTitular(): Promise<void>` en store.ts: `cargarTitular()` → `setTitular`, `titularCargado=true` (también en error).

- [ ] **Step 1:** `npx expo install expo-secure-store` → aparece en package.json
- [ ] **Step 2:** Implementar secure.ts y cambios del store
- [ ] **Step 3:** `npx tsc --noEmit` → 0 errores; `grep -rn "st.clabe\|clabe: s.clabe" src` → sin resultados

### Task 3: TitularScreen (aviso + formulario)

**Files:**
- Create: `src/screens/TitularScreen.tsx`, `src/titular/aviso.ts` (export `AVISO_CORTO: string[]` párrafos y `AVISO_VERSION = '2026-11-20'`)
- Create: `../docs_entrega/AVISO_PRIVACIDAD.md` (mismo texto, completo)

**Interfaces:**
- Consumes: Task 1 validadores/máscaras/DEMO_TITULAR; Task 2 `guardarTitular`, `setTitular`, `clabeLegada`
- Produces: `export function TitularForm({ modo, onListo, onCancelar, demo }: { modo: 'registro' | 'editar'; onListo: (t: Titular) => void; onCancelar?: () => void; demo?: boolean })` y `export function TitularScreen({ navigation }: any)` (modo editar para la ruta de Ajustes).

Comportamiento:
- Paso 1 "Aviso de privacidad": Banner info + párrafos de AVISO_CORTO (responsable: el propio usuario/negocio; finalidad: identificar al titular y saber a qué cuenta se depositan cobros; datos solo en este iPhone, cifrados en el llavero; no se envían a servidores ni a la IA; derechos ARCO: editar o borrar desde Ajustes → Mis datos). ToggleRow "He leído y acepto el aviso de privacidad"; Btn "Continuar" deshabilitado sin aceptar. En modo editar se omite el paso 1.
- Paso 2: Field nombre, CURP (`autoCapitalize="characters"`, maxLength 18), CLABE (number-pad, maxLength 22 para permitir espacios), teléfono (phone-pad, "Opcional"). Errores con `warn` + `hint` = motivo de `validarTitular`, mostrados al tocar "Guardar" (no mientras teclea). Prellenar CLABE con `clabeLegada`. Si `demo`, Btn ghost "Usar datos DEMO (ficticios)" llena DEMO_TITULAR y muestra Banner "DEMO · datos ficticios".
- Guardar: normaliza, `guardarTitular({...,aceptoAviso: new Date().toISOString()})` (en editar conserva la fecha previa), `setTitular`, `buzz('ok')`, `announce('Datos guardados')`, `onListo(t)`. Si lanza: Banner bad "No se pudieron guardar tus datos de forma segura. Intenta de nuevo." y no llama onListo.

- [ ] **Step 1:** Implementar archivos
- [ ] **Step 2:** `npx tsc --noEmit` → 0 errores; `grep -n "console\." src/screens/TitularScreen.tsx src/titular/*.ts` → nada

### Task 4: Integración en flujo, App y Ajustes

**Files:**
- Modify: `src/screens/InterviewScreen.tsx:104-105` (ProfileReview onConfirm), demos `:185-186`
- Modify: `App.tsx` (compuerta y ruta `Titular`)
- Modify: `src/screens/More.tsx:187-188` (SettingsScreen)

**Interfaces:**
- Consumes: Task 2 store (`titular`, `titularCargado`, `iniciarTitular`, `borrarTitular`), Task 3 `TitularForm`, `TitularScreen`, Task 1 máscaras.

Cambios:
- InterviewScreen: estado `perfilPendiente`. onConfirm: si `useStore.getState().titular` existe → `setProfile` como hoy; si no → guarda `p` en `perfilPendiente` y renderiza `<TitularForm modo="registro" demo={model === 'manual (demo)'} onListo={async () => { await setProfile(p, model); buzz('ok'); onDone?.(); }} onCancelar={() => setPerfilPendiente(null)} />` (cancelar regresa a "Esto entendí").
- App.tsx: `useEffect(() => { iniciarTitular(); }, [])`; mientras `!titularCargado` → `ActivityIndicator` centrado; `profile && !titular` → única pantalla `<Stack.Screen name="RegistroTitular">` con `TitularForm modo="registro"`; ruta `Titular` (title "Mis datos") en el stack normal.
- Ajustes: quitar Field CLABE; Card "Mis datos" con nombre, `mascaraCURP`, `mascaraCLABE`, `mascaraTel` (si hay), etiqueta DEMO si `demo`; Btn "Editar" → `navigate('Titular')`; Btn bad "Borrar mis datos" → `Alert.alert` confirmación ("Se borrarán nombre, CURP, teléfono y CLABE de este iPhone. Tendrás que registrarlos de nuevo.") → `borrarTitular()` + `setTitular(null)` (la compuerta de App muestra el registro).

- [ ] **Step 1:** Implementar
- [ ] **Step 2:** `npx tsc --noEmit` → 0; `npm run test:titular` y `npm run test:rules` → OK
- [ ] **Step 3:** `grep -rn "curp\|titular" src/ai src/compliance* src/ledger* 2>/dev/null` → sin resultados (los datos no tocan IA ni ledger)
- [ ] **Step 4 (Tiki, en la Mac):** `npx expo run:ios --device --configuration Release` en cada iPhone; probar: entrevista demo → aviso → formulario → espacio creado; Ajustes → Mis datos enmascarados → Borrar → pide registro.
