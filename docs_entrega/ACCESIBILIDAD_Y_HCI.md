# QuickCoti · Diseño de interacción y accesibilidad

**Base visual:** diseño SwiftUI "PyME NVIDIA" del equipo (fondo claro, paneles blancos, títulos azul marino, acento índigo, micrófono al centro, opciones A/B/C), portado a React Native y extendido.

## Principios
1. **Voz primero, toque siempre:** todo lo que se hace con voz también se puede hacer tocando o escribiendo.
2. **La IA propone, la persona decide:** nada se guarda ni se cobra sin confirmación. Lo que la IA leyó con poca seguridad se marca en ámbar **y con texto** ("Revisa este dato"), nunca solo con color.
3. **Una cosa a la vez:** la entrevista muestra una pregunta por pantalla, con opciones A/B/C y respuesta libre.
4. **Local y privado:** Hermes, el OCR y la visión corren en el iPhone (QVAC). El dictado usa el reconocimiento de Apple en el dispositivo cuando el modelo de español está disponible.

## Funciones de accesibilidad (Menú ☰ → Accesibilidad)
| Función | Para quién | Cómo |
|---|---|---|
| Tamaño de letra (Normal / Grande / Muy grande) | Baja visión, personas mayores | Escala propia ×1.0/1.18/1.36 **más** el tamaño de texto del iPhone (Dynamic Type, con tope para no desbordar) |
| Alto contraste | Baja visión, sol directo en el puesto | Texto negro, acento más oscuro, bordes de 2 px. Se activa solo si el iPhone tiene "Aumentar contraste" |
| Leer en voz alta | Baja visión, baja alfabetización, manos ocupadas | Hermes lee respuestas, preguntas de la entrevista, totales y avisos. Montos en **pesos** ("648 pesos"), no "dólares" |
| Dictado por voz | Baja alfabetización, motricidad fina, manos ocupadas | Micrófono grande en Inicio, Hermes y entrevista (es-MX, en el dispositivo) |
| Órdenes por voz | Todos | "Cobra 50 pesos de un refresco", "toma foto a la nota", "abre rentas". Solo navegan y preparan borradores |
| Vibración | Sordera / ambiente ruidoso | Tap al tocar, éxito al guardar, aviso al revisar, error al fallar |
| Modo sencillo | Motricidad, personas mayores | Botones de 64 pt, una acción por fila en Inicio |
| VoiceOver | Ceguera | Todos los botones tienen nombre y rol; interruptores como "interruptor, activado"; opciones como "opción A"; barras de progreso con porcentaje; avisos anunciados; filas leídas como un solo elemento |

## Detalles de diseño
- Objetivos táctiles ≥ 44 pt (52 pt botones, 64 pt modo sencillo).
- Contraste AA: texto secundario #5E6779 sobre #F6F8FB (≈5.3:1); acento #4F54E5 con blanco (≈5.6:1).
- Máximo 5 pestañas (Inicio, Ventas, Compras, Inventario, Hermes); Cotizar, Rentas y Entregas como accesos rápidos del Inicio, ordenados por el Agente Configurador según el negocio.
- Emojis ocultos a VoiceOver y a la voz.
- Errores con causa y salida ("La foto está muy oscura. Busca más luz e intenta de nuevo").

## Protocolo de prueba de usabilidad (2 personas, bases)
Tareas (cronometrar, contar errores y ayudas):
1. Configurar su negocio con Hermes (voz o A/B/C).
2. Registrar una compra con foto de nota y corregir un dato marcado en ámbar.
3. Cobrar con la voz: "cobra 30 pesos de dos refrescos".
4. Preguntar a Hermes: "¿puedo cobrar en efectivo si se cae el internet?".
5. Activar "Letra grande" y "Leer en voz alta" sin ayuda.

Al final: escala SUS de 10 preguntas + 3 preguntas abiertas (¿qué fue lo más difícil?, ¿qué te dio confianza?, ¿la usarías en tu negocio?).
