# Prototipo de diseño

`prototype.html` es el diseño original generado con Google Stitch: la vista **Marcador Central**.
Es la referencia visual del producto, no código de producción.

> **Estado:** el MVP ya está implementado. Al final de este documento está la tabla que
> mapea cada elemento del prototipo con lo que efectivamente se construyó, y las decisiones
> que se tomaron donde el prototipo no tenía respuesta.

## Qué sirve del prototipo

- La paleta y la escala tipográfica completas (tokens de Material Design 3, expuestos en el
  `tailwind.config` inline del `<head>`).
- Los componentes clave ya resueltos: fila de partido, hero de partido en vivo, feed minuto a minuto,
  mini tabla de posiciones, lista de goleadores.
- Las reglas de color por estado: verde `primary-container` para lo activo, `on-surface-variant`
  y opacidad reducida para lo finalizado.

## Qué hay que rehacer antes de producción

| Problema | Por qué importa | Acción |
| --- | --- | --- |
| `cdn.tailwindcss.com` y config inline | El CDN no es para producción y recompila en runtime | Portar tokens a la config real y `tokens.css` |
| Assets en `lh3.googleusercontent.com` | URLs temporales del generador; van a expirar | Reemplazar logo y avatares por assets propios |
| Datos hardcodeados | Marcadores, cuotas y tablas son texto fijo | Conectar a la API propia |
| Sidebar `fixed w-64` sin breakpoint | En mobile queda fija y aplasta el contenido a ~100 px | Ocultarla bajo `xl` y usar drawer |
| `.dark` en `<html>` | Los colores son oscuros fijos; el tema claro no existe | Definir si habrá tema claro o quitar la clase |
| `data-path` / `data-active-classes` sin JS | Sugieren una capa de navegación que no está implementada | Implementar el router real |
| Botones de fecha estáticos | "Ayer / HOY / Mañana" no cambian nada | Conectar al selector de fecha |
| Material Symbols cargado dos veces | Dos `<link>` a la misma fuente | Dejar uno |
| Sin `aria-live` en el marcador | Un lector de pantalla no anuncia el gol | Agregar `aria-live="polite"` |
| `animate-pulse` / `animate-ping` sin control | Movimiento continuo afecta a usuarios sensibles | Respetar `prefers-reduced-motion` |

## Inconsistencias de contenido a corregir

- El badge "En Vivo" dice **12** pero la vista lista **3** partidos en vivo.
- Los contadores de las pestañas (38 / 12 / 18 / 8 / 4) son fijos.
- "Global: 5 - 4" en el hero convive con un 2-1 en curso: falta aclarar que es el agregado de la llave.

## Sin datos en la v1

El plan gratuito de football-data.org entrega fixtures, resultados (diferidos) y tablas.
Todo lo demás que muestra el prototipo no tiene fuente todavía:

| Elemento del prototipo | Disponible en free | Qué hacer en v1 |
| --- | --- | --- |
| Hero con "EN VIVO 68'" | No | Reutilizar el hero con el último partido finalizado, sin minuto ni pulso |
| Pulse Feed En Vivo | No | Reemplazar por "últimos resultados de la jornada" |
| Fila: goleadores por partido ("Saka 32'") | No | Ocultar; el free tier no expone goleadores |
| Fila: tarjetas (amarilla/roja) | No | Ocultar |
| Posesión, xG, tiros | No | Ocultar: requieren add-on de estadísticas |
| Toggle "Cuotas" | No | Ocultar: add-on de pago (€15/mes) |
| Goleadores destacados | No | Reemplazar por tabla de posiciones |
| Tabla de posiciones | **Sí** | Portar tal cual |
| Fixtures y resultados | **Sí** (diferidos) | Portar, mostrando hora de última sincronización |

Consecuencia de diseño: la v1 del producto es más austera que el prototipo. Conviene decidir el
look de la fila de partido sin goleadores ni tarjetas antes de portarla, porque esos textos ocupan
el espacio central de la fila.

## Vistas que faltan

El prototipo cubre una sola pantalla. Para que la plataforma esté completa:

1. **Detalle de partido** — ✅ implementado (`/partido/[id]`), sin alineaciones ni minuto a minuto
   porque el plan gratuito no los expone. Incluye historial entre los equipos y últimos resultados.
2. **Competición** — ✅ implementado (`/competicion/[slug]`): tabla completa y navegación por jornada.
   Sin cuadro de eliminatorias ni goleadores.
3. **Favoritos** — ⏳ pendiente (Fase 8 del roadmap).
4. **Buscador** — ✅ implementado (`/buscar`) con formulario GET, resultados agrupados y estados vacíos.
5. **Estadísticas** — ⏳ pendiente: requiere el add-on de datos profundos.
6. **Estados vacíos y de error** — ✅ implementado (`EmptyState`): búsqueda sin resultados, fecha sin
   partidos, competición inexistente (`notFound()`).
7. **Mobile** — ✅ resuelto: la barra lateral sólo aparece desde `xl`, con chips de competiciones
   para mobile.

---

## Mapeo prototipo → implementación

| Elemento del prototipo | Qué se construyó |
| --- | --- |
| Tokens de color y escala tipográfica (config inline) | `src/app/globals.css` con `@theme`: los mismos valores, compilados en el build |
| Fila de partido con goleadores y tarjetas | `MatchRow`: marcador o hora de inicio en el centro; sin goleadores ni tarjetas |
| Hero "EN VIVO 68'" | Detalle de partido con el último resultado, sin minuto ni animación de pulso |
| Pulse Feed En Vivo | Grupos por fecha: "últimos resultados de la jornada" |
| Goleadores destacados | Tabla de posiciones calculada en el dominio |
| Tabla de posiciones | `StandingsTable`, portada con el cálculo propio |
| Mini tabla lateral | `StandingsTable` en modo `compact` dentro del `aside` |
| Botones "Ayer / HOY / Mañana" estáticos | `DateNav`: enlaces reales con estado activo y calendario nativo |
| `data-path` sin JS | Router de Next: todas las vistas son URLs compartibles |
| Botón "Sincronizar" | `SyncButton` (único componente cliente) contra `POST /api/sync` |
| `cdn.tailwindcss.com` | Tailwind v4 compilado con `@tailwindcss/turbopack` |
| Assets en `lh3.googleusercontent.com` | Escudos como badges de tres letras (`TeamBadge`), sin URLs temporales |
| Material Symbols cargado dos veces | Un solo `<link>` en el layout |
| `animate-pulse` sin control | Bloque `@media (prefers-reduced-motion: reduce)` |
| `aria-live` ausente | Estado de sincronización con `aria-live` |
| `.dark` fijo en `<html>` | No se replicó: el MVP es de tema oscuro por diseño del prototipo |
