# Aviso de privacidad — QuickCoti

Versión 2026-11-20 · Fundamento: Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP, DOF 20-03-2025, vigente desde el 21-03-2025): art. 15 (contenido del aviso), art. 7 (consentimiento; expreso para datos financieros o patrimoniales), art. 2 fr. VI (datos sensibles) y arts. 22–24 y 26 (derechos ARCO).

> **Borrador para el prototipo del Hackathon Oaxaca 2027.** Completa los datos marcados con [ ] y revísalo con un abogado antes de usar QuickCoti con usuarios reales.

## 1. Identidad y domicilio del responsable (art. 15, fr. I)
Equipo QuickCoti — [nombre del responsable o del equipo], [domicilio completo], Oaxaca de Juárez, Oaxaca, México. Contacto: [correo del equipo].

## 2. Datos personales que se tratan (art. 15, fr. II)
- Nombre completo.
- CURP.
- Cuenta CLABE interbancaria (dato **financiero o patrimonial**).
- Teléfono celular (opcional).

QuickCoti **no** recaba datos personales sensibles (art. 2, fr. VI).

## 3. Finalidades (art. 15, fr. III)
1. Identificar a la persona titular del negocio dentro de la app.
2. Indicar la cuenta CLABE de destino de los cobros. En el prototipo los cobros CoDi son **simulados**; el QR y el ticket muestran solo los últimos 4 dígitos.

No hay finalidades secundarias: los datos no se usan para publicidad ni para perfilar, y no se transfieren a terceros. Ambas finalidades requieren consentimiento; el de la CLABE es **expreso** (art. 7), y se otorga al activar "He leído y acepto el aviso de privacidad" antes de capturar los datos.

## 4. Cómo se protegen los datos
- Se guardan cifrados en el llavero (Keychain) del iPhone con la opción "solo cuando el dispositivo está desbloqueado y solo en este dispositivo" (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`): no se sincronizan con iCloud ni pasan a otro teléfono.
- No se escriben en el almacenamiento normal de la app, ni en la bitácora SHA-256, ni en registros de depuración.
- No se envían a ningún servidor ni pasan por el modelo de IA (Hermes). El formulario es independiente de la entrevista.
- Si la app se desinstala y se vuelve a instalar, se borran los datos que hubieran quedado en el llavero.

## 5. Opciones para limitar el uso o la divulgación (art. 15, fr. IV)
Los datos no se comparten. La persona titular puede borrarlos en cualquier momento en **Ajustes → Mis datos → Borrar mis datos**.

## 6. Derechos ARCO y revocación del consentimiento (art. 15, fr. V; arts. 7, 22–24 y 26)
| Derecho | Cómo se ejerce en la app |
|---|---|
| Acceso | Ajustes → Mis datos (vista enmascarada) y Editar (vista completa) |
| Rectificación | Ajustes → Mis datos → Editar |
| Cancelación | Ajustes → Mis datos → Borrar mis datos |
| Oposición | Borrar mis datos y dejar de usar la función |
| Revocación del consentimiento | Borrar mis datos |

Como los datos no salen del iPhone, el equipo QuickCoti no los recibe ni los conserva. Dudas o solicitudes: [correo del equipo].

## 7. Cambios al aviso (art. 15, fr. VI)
Los cambios se publicarán en la ficha del proyecto y en una actualización de la app. La fecha en que se aceptó el aviso y su versión quedan guardadas en el propio iPhone junto con los datos.

## 8. Autoridad
La autoridad en materia de protección de datos personales en posesión de particulares es la Secretaría Anticorrupción y Buen Gobierno, que asumió las funciones del INAI en 2025.
