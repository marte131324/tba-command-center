# Bitácora Técnica: TBA Command Center (Paquete Avanzado)
**Fecha de inicio:** 02 de Abril, 2026

Este documento rastrea de manera cronológica todas las implementaciones realizadas específicamente aislando los archivos para la versión "Pro / Avanzada" del sistema. Esta estrategia permite mantener un bloque sólido del Paquete Operativo mientras se fabrican capacidades premium para entrega inmediata en caso de Upsell.

---

### Sprint 1: Integración Espacial y Analítica
**Archivos Bifurcados:** `admin-avanzado.html`, `js/admin-app-avanzado.js`, `tech-avanzado.html`, `js/tech-app-avanzado.js`

#### 1. Sistema Anti-Fraude GPS (Fórmula de Haversine)
- Se programó el API nativo `navigator.geolocation` dentro de la app técnica.
- Se inyectó la fórmula matemática trigonométrica de *Haversine* para procesar la distancia exacta (en metros).
- **Lógica de Alerta:** Si un técnico marca "Check-in" a una distancia mayor a 200 metros, el sistema lo califica como `isFraudulent: true` en Firebase y registra la discrepancia kilométrica en el Panel de Administración.

#### 2. Analítica Visual de Estatus (Dashboard Admin)
- Se inyectó la librería `Chart.js` en el servidor CDN.
- Se programó un *Doughnut Chart* (Anillo) que escucha activamente la base de datos de reportes del día.
- Agrupa los estatus de albercas en tres vías de color: Óptimas (Verde), Preventivas (Naranja), Alertas (Rojo).

#### 3. Herramienta Mágica Extraedora de Coordenadas
- Para facilitar la alta de 300+ albercas y su geolocalización, se creó una macro utilizando expresiones regulares (*Regex*).
- El administrador pega enlaces largos de escritorio (`@19.xxx,-96.xxx,15z`) y el programa desagrega y rellena automáticamente los campos Latitud y Longitud listos para subir a Firebase.

#### 4. Checklist Pre-Servicio Estandarizado (App Técnico)
- **Fecha:** 02/Abr/2026 10:40 AM
- Se inyectó una rejilla de 6 puntos de inspección obligatorios en el modal del reporte del técnico:
  - 🧹 Skimmer limpio | ⚙️ Bomba sin ruidos | 🧱 Paredes sin alga
  - 💧 Nivel de agua OK | 🧪 Químicos disponibles | 🌊 Fondo visible
- **Validación Obligatoria:** Si el técnico intenta enviar el reporte sin completar los 6 puntos, el sistema bloquea el envío y muestra advertencia roja.
- **Persistencia:** Cada reporte guarda un arreglo `preChecklist` en Firebase con los ítems inspeccionados.
- **Archivos modificados:** `tech-avanzado.html`, `js/tech-app-avanzado.js`, `css/style.css`

#### 5. Historial Clínico por Alberca (App Técnico)
- **Fecha:** 02/Abr/2026 10:48 AM
- Se añadió un botón **"Ver Historial Clínico"** en cada tarjeta de alberca (pendiente, en servicio y completada).
- Al presionar, se abre un modal que consulta los **últimos 5 reportes** de esa alberca desde Firebase (`reports` ordenados por `timestamp desc`, limitados a 5).
- **Gráfica de Tendencia (Chart.js):** Se renderiza una gráfica de línea con dos datasets: pH (azul) y Cloro (verde), mostrando la evolución del agua a lo largo de los servicios.
- **Listado Detallado:** Debajo de la gráfica, cada servicio se muestra como tarjeta individual con fecha, técnico, duración, pH, Cloro e insumo aplicado, con indicadores de estatus visual (✅/⚠️/🚨).
- **Nota Técnica:** Esta query requiere un índice compuesto en Firebase (poolId + timestamp). Si no existe, Firebase lo solicita automáticamente al primer intento fallido.
- **Archivos modificados:** `tech-avanzado.html`, `js/tech-app-avanzado.js`

#### 6. Captura de Foto Obligatoria (App Técnico)
- **Fecha:** 02/Abr/2026 12:56 PM (corregido)
- **Estrategia de almacenamiento:** La foto **NO se sube a Firebase** (ahorro de costos). Se envía por **WhatsApp** junto con el reporte de texto.
- Se creó un input de cámara nativo con `capture="environment"` que abre directamente la cámara trasera en móviles.
- **Preview en vivo:** Al tomar/seleccionar la foto, se muestra una miniatura con opción de eliminar y retomar.
- **Validación Obligatoria:** Si el técnico intenta enviar sin foto, el sistema bloquea con advertencia roja.
- **ID de Cruce (reportShortId):** Cada reporte genera un ID único corto (ej: `TBA-A1B2C3`) que se incluye tanto en Firestore como en el mensaje de WhatsApp, permitiendo ubicar fácilmente la foto en la conversación de WA y cruzarla con el reporte en la base de datos.
- **Flujo:** Tomar foto → Completar reporte → Submit guarda datos en Firestore → Click en "Enviar Foto + Reporte por WA" → WhatsApp se abre con el texto pre-llenado + instrucción de adjuntar la foto debajo.
- **Sin Firebase Storage / Sin costos adicionales.**
- **Archivos modificados:** `tech-avanzado.html`, `js/tech-app-avanzado.js`

#### 10. Centro de Alertas y Tareas Push (Admin a Tecnico)
- **Fecha:** 02/Abr/2026 02:29 PM
- Se creo un "Inbox" global en el Panel Admin que concentra unicamente las notificaciones y fallas marcadas por los tecnicos en la alberca (`hasAlert === true`).
- **Sistema de Despacho PUSH:** El administrador puede enviar notificaciones directas (Tareas) a la pantalla de un tecnico en especifico.
- **Recepcion PUSH (App Tecnico):** Si el tecnico tiene la app abierta, recibe una alerta flotante color escarlata, que hace vibrar el telefono (usando `navigator.vibrate`) obligando la atencion. El tecnico debe hacer clic en "Marcar como Entendido" cerrando el ciclo.
- **Historial Seguro:** Todas las notificaciones enviadas y su respectivo estado de comprension/lectura quedan registradas bajo la base de datos `tasks`. Se optó por una resolución en vivo con Javascript Local (`sort()`) para evitar errores por falta de Índices Compuestos en Firestore.
- **Archivos modificados:** `admin-avanzado.html`, `js/admin-app-avanzado.js`, `tech-avanzado.html`, `js/tech-app-avanzado.js`

#### 11. Panel de KPIs y Ranking de Eficiencia
- **Fecha:** 02/Abr/2026 03:26 PM
- Se generó una tabla de "Posiciones" y evaluación del personal con iconos de Corona 👑 (Oro/Plata/Bronce) para los Top 3.
- **Puntuación Algorítmica:** La plataforma evalúa al instante todos los servicios de la empresa e imprime un "Score Táctico" por Técnico (0 a 100).
- **Fórmula de Eficiencia ($0 Costo):** `(Tasa_Exito * 0.70) + (Volumen_Servicios_Max100 * 0.3)`. Es decir, la app castiga en el score si las albercas que atiendes presentan alertas frecuentes.
- Permite filtrar el puntaje "Este Mes" o en el "Histórico Completo".
- **Archivos modificados:** `admin-avanzado.html`, `js/admin-app-avanzado.js`

#### 12. Buscador Transversal "Spotlight" (Feature Final Pro)
- **Fecha:** 02/Abr/2026 03:55 PM
- **Arquitectura de Búsqueda:** Se ha desarrollado un motor de búsqueda instantáneo local flotante.
- Combina la indexación rápida de datos pre-cargados (Albercas y Técnicos) en memoria RAM del navegador para obtener resultados a la velocidad de la luz (0ms, 0$ de costo).
- **Extracción Hash de BBDD:** Cuando el usuario introduce una matrícula alfanumérica exacta de 6 dígitos (Ej: *HUWPFO*), el algoritmo detecta el formato Hash, y lanza en directo una consulta única a Firebase para buscar ese reporte en toda la historia de la compañía evitando cruces masivos (Ahorro crítico de cuotas por lectura).
- Atajo de Teclado Rápido: `<kbd>CMD+K</kbd>` o `<kbd>CTRL+K</kbd>` abre directamente el buscador.
- **Archivos modificados:** `admin-avanzado.html`, `js/admin-app-avanzado.js`

#### 9. Mapa GPS en Vivo (Tecnicos en Campo)
- **Fecha:** 02/Abr/2026 02:14 PM
- Se integro la libreria Open Source **Leaflet.js** junto con tiles de **CartoDB Dark/OpenStreetMap**.
- Estrategia $0 Costo: Se evita utilizar la API de Google Maps para evadir costos por impresiones/carga de mapa. El proveedor utilizado mantiene el stack en capa gratuita.
- El panel de Admin ahora lee las coordenadas extraidas al momento del 'Check-In' (app tecnico guarda `gpsLat` y `gpsLng`) y las posiciona en este mapa global interactivo.
- Marcador visual inteligente: Si el tecnico registro su check-in superando la distancia limite permitida de la zona (fraudulento), el pin GPS se renderiza ROJO indicando discrepancia. Si esta correcto es AZUL.
- El mapa ajusta su zoom/bound automaticamente para enmarcar todos los check-ins vivos simultaneamente.
- **Archivos modificados:** `admin-avanzado.html`, `js/admin-app-avanzado.js`, `css/style.css`

#### 8. Graficas de Rendimiento (Dashboard Admin)
- **Fecha:** 02/Abr/2026 02:08 PM
- Se implementaron 3 graficas analiticas en el panel avanzado utilizando Chart.js:
  1. **Servicios por Ruta (Hoy):** Grafica de barras verticales que muestra cuantos reportes se han hecho por ruta.
  2. **pH Promedio por Ruta (Hoy):** Grafica de barras horizontales. Las barras cambian a verde si el promedio de la ruta está entre 6.8 y 7.6, de lo contrario son amarillas.
  3. **Comparativo Semanal:** Grafica de lineas que carga el historico de los ultimos 7 dias, mostrando dos datasets: total de servicios y total de alertas generadas por dia.
- Componentes 100% responsivos para mobile.
- **Archivos modificados:** `admin-avanzado.html`, `js/admin-app-avanzado.js`, `css/style.css`

#### 7. Descarga de Reporte Diario CSV (App Tecnico + Admin)
- **Fecha:** 02/Abr/2026 01:38 PM
- El tecnico puede descargar su reporte del dia como CSV compatible con Excel/Google Sheets.
- El boton aparece automaticamente cuando hay al menos 1 reporte completado.
- El CSV incluye 16 columnas: ID, Alberca, Tecnico, Fecha, Hora, Duracion, pH, Cloro, Insumo, Cantidad, Unidad, Estatus, Alerta, Tipo Alerta, Inspeccion, Notas.
- El admin ve en su tabla de reportes las columnas adicionales: ID del reporte y conteo de checklist (X/6).
- **Archivos modificados:** `tech-avanzado.html`, `js/tech-app-avanzado.js`, `admin-avanzado.html`, `js/admin-app-avanzado.js`

#### CORRECCION: Caracteres rotos en WhatsApp
- **Fecha:** 02/Abr/2026 01:38 PM
- Los emojis literales y escapes Unicode se corrompen al pasar por encodeURIComponent.
- Solucion: Se eliminaron TODOS los emojis. Texto puro profesional con separadores y negritas WA.

#### DOCUMENTO: Soporte de Infraestructura
- Se creo `soporte_infraestructura_tba.md` con tablas de capacidad, costos, escalabilidad y garantias para el kit del cliente.

#### Bodega / Inventario (Removido temporalmente)
- Se construyó previamente la sección completa de Bodega Central con CRUD de insumos, umbrales críticos y alertas visuales.
- **Se removió** por decisión estratégica: se implementará en fases finales del proyecto debido a la complejidad de los productos químicos que manejan.
- El código queda documentado en el historial de Git para restaurarse cuando sea necesario.
