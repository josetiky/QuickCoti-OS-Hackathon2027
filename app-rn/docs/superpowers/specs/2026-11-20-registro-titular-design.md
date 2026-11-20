# Registro del titular (datos personales) — diseño corto

## Por qué
QuickCoti cobra y emite tickets a nombre del dueño. Nombre y CURP identifican al titular (seguridad);
la CLABE es donde se depositaría lo cobrado. Por eso son obligatorios. Por ser datos personales
se requiere aviso de privacidad, consentimiento y almacenamiento seguro.

## Metas
- Formulario obligatorio (nombre completo, CURP, CLABE; teléfono opcional) antes de crear el espacio.
- Aviso de privacidad con casilla "Acepto" que bloquea el avance.
- Validación local: CURP (formato + dígito verificador), CLABE (18 dígitos + dígito de control), teléfono 10 dígitos.
- Guardado en Keychain (expo-secure-store), solo en el dispositivo.
- Ajustes: ver datos enmascarados, editar, "Borrar mis datos" (ARCO).

## No-metas
- No se valida contra RENAPO ni bancos (sin conexión).
- No es KYC real ni cobro real.

## Anti-metas (sería un fracaso aunque funcione)
- Que los datos pasen por Hermes/LLM, el registro SHA-256, logs o AsyncStorage.
- Que el QR o el ticket muestren CURP o CLABE completa.

## Enfoques considerados
- A. Formulario antes de la entrevista: registro claro, pero más abandono.
- B. Formulario al final, tras "Esto entendí" y antes de "Crear mi espacio". **Elegido por el usuario.**
- (Descartado) Cifrar dentro de AsyncStorage con llave en Keychain: más complejo, sin ventaja sobre secure-store.

## Diseño
- `src/titular.ts`: tipo Titular, validarCURP, validarCLABE, validarTel, mascaras, cargar/guardar/borrar (secure-store), DEMO_TITULAR.
- `src/screens/TitularScreen.tsx`: paso 1 aviso de privacidad (texto + casilla), paso 2 formulario con Field/warn,
  accesible (labels, anuncios, sin depender del color). Modos: 'registro' (onboarding) y 'editar' (Ajustes).
- InterviewScreen/ProfileReview: "Crear mi espacio" abre Titular; el perfil se guarda solo al completar.
  Botones Demo usan DEMO_TITULAR (ficticio, marcado DEMO).
- store: se elimina `clabe` del persist; se expone `titularResumen` en memoria (nombre, CLABE para CoDi) cargado de Keychain al iniciar.
- codi.ts / ticket: siguen mostrando solo •••• últimos 4.
- Ajustes: tarjeta "Mis datos" enmascarada + Editar + Borrar mis datos (confirmación). Al borrar, la app pide registrarse de nuevo.
- Doc: aviso de privacidad en `docs_entrega/AVISO_PRIVACIDAD.md`.

## Decisiones del builder (mías)
Teléfono opcional; texto del aviso; migración de la CLABE existente de AsyncStorage al Keychain.
