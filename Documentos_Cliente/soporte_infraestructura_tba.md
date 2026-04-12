# TBA Command Center — Soporte de Infraestructura Técnica
**Versión:** 1.0 | **Fecha:** 02 de Abril, 2026  
**Elaborado por:** Equipo de Desarrollo  

---

## 1. Arquitectura del Sistema

El TBA Command Center está construido sobre una arquitectura **serverless** (sin servidores propios), lo que elimina costos de mantenimiento de infraestructura y garantiza disponibilidad del 99.95%.

| Componente | Tecnología | Costo |
|---|---|---|
| Frontend (PWA) | HTML5 + CSS3 + JavaScript | $0 (código propio) |
| Base de Datos | Google Firebase Firestore | Plan Spark (Gratuito) |
| Autenticación | Firebase Authentication | $0 (sin límite de usuarios) |
| Hosting/Deploy | Vercel | $0 (plan Hobby) |
| Gráficas/Analítica | Chart.js (CDN público) | $0 |
| Íconos del Sistema | Lucide Icons (CDN público) | $0 |
| Almacenamiento de Fotos | WhatsApp (fotos van por WA) | $0 |

**Costo mensual de operación: $0 USD**

---

## 2. Capacidad del Plan Gratuito vs. Consumo Real

### Firebase Firestore (Base de Datos)

| Recurso | Límite Gratuito (por día) | Consumo estimado TBA (300 albercas / 5 técnicos) | Margen disponible |
|---|---|---|---|
| **Lecturas** | 50,000 / día | ~5,000 - 8,000 | **6x de sobra** |
| **Escrituras** | 20,000 / día | ~800 - 1,200 | **16x de sobra** |
| **Eliminaciones** | 20,000 / día | ~50 - 100 | **200x de sobra** |
| **Almacenamiento** | 1 GB total | ~200 MB / año (solo texto) | **Para +5 años** |

### Desglose de Lectura Diaria Estimada

| Operación | Lecturas estimadas |
|---|---|
| Login + carga de ruta (5 técnicos) | ~500 |
| Carga de datos del Dashboard Admin | ~2,000 |
| Check-ins y reportes del día | ~600 |
| Historial clínico de albercas (consultas) | ~500 |
| Gráficas y analítica en tiempo real | ~1,500 |
| Buscador global y filtros | ~500 |
| **TOTAL DIARIO** | **~5,600** |

### Desglose de Escritura Diaria Estimada

| Operación | Escrituras estimadas |
|---|---|
| Check-ins GPS (300 albercas) | ~300 |
| Reportes de servicio con checklist | ~300 |
| Actualizaciones de pool (lastService, etc.) | ~300 |
| Alertas y estados | ~50 |
| **TOTAL DIARIO** | **~950** |

---

## 3. Escalabilidad — ¿Qué pasa si el negocio crece?

| Escenario de Crecimiento | ¿Sigue gratuito? | Acción necesaria |
|---|---|---|
| **Hasta 500 albercas / 10 técnicos** | SI | Ninguna |
| **Hasta 1,000 albercas / 20 técnicos** | SI (al límite) | Monitorear consumo |
| **Más de 1,000 albercas** | Plan Blaze (pago por uso) | Costo estimado: **$3-8 USD/mes** |
| **Más de 3,000 albercas** | Plan Blaze | Costo estimado: **$15-25 USD/mes** |

### Costos del Plan Blaze (solo si se excede el plan gratuito)

| Operación | Costo |
|---|---|
| 100,000 lecturas | $0.06 USD |
| 100,000 escrituras | $0.18 USD |
| 1 GB almacenamiento / mes | $0.108 USD |

> **Conclusión:** Incluso en el peor escenario de crecimiento agresivo, los costos mensuales de Firebase no superarían los $25 USD/mes. Para la operación actual (300 albercas), el sistema opera completamente gratis.

---

## 4. Estrategia de Almacenamiento de Evidencia Fotográfica

| Tipo de dato | ¿Dónde se guarda? | ¿Por qué? |
|---|---|---|
| Texto del reporte (pH, Cloro, checklist, notas) | Firebase Firestore | Datos livianos (~1-2 KB por reporte) |
| Foto de evidencia | WhatsApp del supervisor | Fotos pesan 2-5 MB c/u. Con 300 fotos/día = 600 MB-1.5 GB/día. Almacenar en la nube tendría un costo de $10-30 USD/mes |
| ID de cruce foto/reporte | Ambos (Firestore + WhatsApp) | Permite buscar en WA el reporte exacto con el ID |

**Resultado:** $0 USD en almacenamiento de fotos. WhatsApp las guarda indefinidamente en su propio servidor.

---

## 5. Herramientas del Paquete Avanzado y su Impacto en Recursos

| Herramienta | Consumo Firebase | Tecnología Extra | Costo Adicional |
|---|---|---|---|
| Verificación GPS (Haversine) | 1 escritura/check-in | API Geolocation (nativa) | $0 |
| Checklist Pre-Servicio | 0 (se guarda con el reporte) | Ninguna | $0 |
| Historial Clínico (últimos 5) | 5 lecturas/consulta | Ninguna | $0 |
| Foto Obligatoria (vía WA) | 0 (no sube a Firebase) | Cámara nativa del cel | $0 |
| Gráficas de Rendimiento | ~500 lecturas/carga | Chart.js CDN | $0 |
| Mapa GPS en Vivo | ~5-10 lecturas/actualización | Leaflet.js CDN (gratuito) | $0 |
| Centro de Alertas | ~200 lecturas/carga | Ninguna | $0 |
| KPIs de Eficiencia | ~500 lecturas/carga | Ninguna | $0 |
| Buscador Global | ~100 lecturas/búsqueda | Ninguna | $0 |
| Portal del Cliente | ~10 lecturas/consulta | Ninguna | $0 |
| **TOTAL** | **Dentro del plan gratuito** | **Todo CDN gratuito** | **$0** |

---

## 6. Garantías de Continuidad

1. **Firebase es de Google:** La infraestructura está respaldada por los servidores de Google Cloud, con SLA de 99.95% de disponibilidad.
2. **PWA Offline:** La app del técnico funciona sin internet gracias a la persistencia local de Firestore. Los datos se sincronizan automáticamente al recuperar señal.
3. **Sin dependencia de servidores propios:** No hay servidores que mantener, actualizar o renovar. Todo corre en la nube de Google y Vercel.
4. **Código fuente entregable:** El cliente recibe acceso completo al código fuente y la documentación técnica.

---

## 7. Resumen Ejecutivo

> **El TBA Command Center opera con $0 USD de costo mensual en infraestructura.** Todas las herramientas del Paquete Avanzado están diseñadas para mantenerse dentro del plan gratuito de Firebase incluso con 300+ albercas y 5+ técnicos. La única variable que podría generar un costo mínimo (~$5-8 USD/mes) sería un crecimiento extraordinario a más de 1,000 albercas, escenario que implicaría un negocio significativamente más grande que justificaría esa inversión.

---

*Documento generado como parte del kit de entrega del TBA Command Center.*
*Referencia técnica para respaldo y transparencia con el cliente.*
