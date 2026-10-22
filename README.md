# PitchPulse

Plataforma web de resultados de fútbol. Este repositorio contiene el **MVP funcional**:
historial de partidos navegable y buscable, tablas de posiciones y detalle de partido.

**Sin resultados en vivo.** Es una decisión de alcance, no una limitación técnica pendiente:
el plan gratuito de football-data.org publica los marcadores de forma diferida, así que el
producto nunca promete algo que no puede cumplir. Ver `docs/datos.md`.

El diseño original (generado con Google Stitch) está en `design/prototype.html` y se usó como
referencia visual: de ahí salen la paleta Material Design 3, la escala tipográfica y la
estructura de la fila de partido. Ver `design/README.md` para el detalle de qué se portó y
qué se descartó.

---

## Arranque rápido

Requiere **Node.js 24 o superior** (se usa el módulo `node:sqlite`, incluido en Node desde la
versión 22) y npm. No requiere Docker, ni servicios externos, ni cuenta en ningún proveedor.

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000`. En el primer arranque la base se siembra sola con un **dataset de
demostración** (cuatro ligas, ~1.400 partidos) y podés buscar, filtrar y navegar de inmediato.

### Para usar datos reales

1. Creá una cuenta gratuita en [football-data.org](https://www.football-data.org/client/register)
   y copiá tu API key.
2. Creá el archivo `.env` a partir de `env.example` y completá:

   ```env
   FOOTBALL_PROVIDER=football-data
   FOOTBALL_API_KEY=tu_clave_aca
   ```

3. Reiniciá el servidor y presioná **Sincronizar** en el header (o hacé
   `POST /api/sync`).

La sincronización **reemplaza** el dataset anterior: si venías usando los datos de
demostración, esos partidos se borran y quedan solo los del proveedor real. Es intencional,
para no mostrar dos fixtures de la misma liga a la vez.

### Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Build de producción (incluye chequeo de tipos) |
| `npm start` | Sirve el build de producción |
| `npm test` | Tests del dominio (runner nativo de Node, sin red ni base de datos) |
| `npm run typecheck` | Sólo el chequeo de tipos |

---

## Alcance del MVP

**Incluido**

- Historial de partidos con filtros por competición, estado y fecha.
- Búsqueda por equipo, competición o estadio.
- Detalle de partido: marcador, fecha, estadio, historial entre los equipos y últimos resultados.
- Tabla de posiciones por competición, y navegación por jornada.
- Página por equipo con su historial completo.
- Sincronización de datos reales desde el proveedor.
- API JSON de lectura (`GET /api/matches`) y de sincronización (`POST /api/sync`).

**Fuera de alcance (a propósito)**

- Marcadores en vivo, minuto a minuto, goles, tarjetas, alineaciones, xG y cuotas. El plan
  gratuito no expone esos datos; forzarlos habría significado inventar información.
- Favoritos, notificaciones, autenticación y estadísticas avanzadas.

---

## Stack y por qué

| Tema | Decisión | Motivo |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) + React 19 | Componentes de servidor: la consulta a la base ocurre en el servidor y el cliente recibe HTML, sin exponer credenciales ni lógica |
| Lenguaje | TypeScript en modo `strict` | El modelo de partido y los estados se validan en tiempo de compilación |
| Estilos | Tailwind CSS v4 (configuración en CSS con `@theme`) | Los tokens del prototipo se declaran una vez y generan las utilidades |
| Persistencia | SQLite vía `node:sqlite` | Módulo nativo de Node 24: **cero dependencias** y cero configuración |
| Validación | Zod | La respuesta del proveedor externo se valida en el borde del sistema |
| Tests | Runner nativo de `node:test` | Cubre el dominio puro; no requiere framework ni configuración |

No hay ORM. La razón es de costo/beneficio: el esquema son tres tablas y las consultas son
explícitas, con sentencias preparadas y parámetros vinculados. Un ORM agregaría una capa que
oculta justamente lo que conviene poder explicar.

---

## Arquitectura

Arquitectura hexagonal ligera en un único paquete. La regla es la dirección de las dependencias:
**el dominio no conoce nada hacia afuera**.

```
src/
├── domain/                     # Puro. Sin red, sin base de datos, sin framework.
│   ├── match.ts                # Entidad Match, estados y reglas (resultado, agregado, finalizado)
│   ├── standings.ts            # Cálculo de la tabla de posiciones
│   ├── schedule.ts             # Generación de fixtures (método del círculo)
│   └── *.test.ts               # 20 tests: tabla, fixture y reglas de partido
├── application/                # Casos de uso. Orquesta el dominio y la infraestructura.
│   ├── queries.ts              # Modelos de lectura que consume la UI
│   └── sync.ts                 # Sincronización e inicialización de datos
├── infrastructure/             # Detalles reemplazables.
│   ├── db/                     # Esquema, conexión y repositorio SQL
│   └── providers/              # Adaptadores: dataset de demostración y football-data.org
├── components/                 # Componentes de interfaz reutilizables
├── lib/                        # Formateo de fechas y de zona horaria, armado de URLs
└── app/                        # Rutas: páginas y endpoints (App Router)
```

El punto de extensión es `infrastructure/providers/types.ts`: la interfaz `FootballProvider`.
Cambiar de proveedor de datos significa **agregar un archivo que la implemente**, sin tocar
`domain/` ni `app/`. El proyecto ya trae dos implementaciones conviviendo —el dataset de
demostración y football-data.org— justamente para probar que la abstracción se sostiene.

### Identidad de los datos

Cada entidad tiene un identificador interno con prefijo del origen: `fd:64` (Liverpool según
football-data.org) o `seed:PL:liverpool-fc`. Ese prefijo es lo que permite
distinguir y reemplazar datasets sin perder la integridad referencial, y es la base de la
tabla de mapeo `proveedor → id interno` documentada en `docs/datos.md`.

---

## Decisiones técnicas que vale la pena poder defender

1. **Los partidos no finalizados se guardan sin marcador.** Aunque la API ya publique un
   resultado parcial, el adaptador lo descarta (`football-data.ts`). Es la regla que hace
   verdadera la promesa "sin datos en vivo" del MVP.
2. **La tabla de posiciones se calcula, no se consulta.** `computeStandings` la deriva de los
   partidos jugados que ya están en la base. Evita una petición extra (el plan gratuito tiene
   un tope de 10 por minuto) y garantiza que la tabla sea coherente con los partidos visibles.
3. **La sincronización es secuencial, no en paralelo.** Paralelizar las competiciones agotaría
   el límite de peticiones del plan gratuito de inmediato.
4. **La zona horaria se fija en el servidor.** Agrupar y filtrar por día con la zona del
   navegador produciría HTML distinto en servidor y cliente, y React fallaría por hidratación.
   Ver `lib/timezone.ts`: el rango de fechas se convierte a instantes UTC reales.
5. **El dataset de demostración es determinista.** Usa un generador pseudoaleatorio con semilla
   derivada del identificador del partido, así que la misma liga produce siempre el mismo
   historial. Sin esto, dos demostraciones de la misma pantalla mostrarían resultados distintos.
6. **La tabla se llama `matches`, no `match`.** `MATCH` es palabra reservada en SQLite.
7. **`force-dynamic` en las páginas.** El contenido depende de una base que cambia: no se puede
   prerenderizar en el build. Se descartó `cacheComponents` (el modelo nuevo de caché) porque
   obliga a envolver cada lectura en `<Suspense>` sin aportar nada a este alcance.
8. **Nada de `cdn.tailwindcss.com`.** El prototipo compilaba estilos en el navegador; acá los
   tokens se compilan en el build, con `@theme` en `globals.css`.

---

## Estado del roadmap

- [x] **Fase 0 — Cimientos:** proyecto, configuración de TypeScript, Tailwind y estructura de capas.
- [x] **Fase 1 — Dominio:** entidades, máquina de estados, cálculo de tabla y fixtures, con tests.
- [x] **Fase 2 — Adaptadores:** dataset de demostración + football-data.org, con validación de la respuesta.
- [x] **Fase 3 — Ingesta:** sincronización idempotente con registro de cada corrida y de la última ejecución.
- [x] **Fase 4 — API propia:** `GET /api/matches` y `POST /api/sync` sobre la capa de aplicación.
- [x] **Fase 5 — UI:** navegación, búsqueda, detalle de partido, tabla y vista por competición.
- [x] **Fase 6a — Configuración de despliegue:** `Dockerfile` multi-stage, `docker-compose.yml`, Nginx del host y `deploy.sh`. Ver `docs/despliegue.md`.
- [ ] **Fase 6b — Despliegue en vivo:** ejecutar `deploy.sh` y agregar TLS (requiere dominio propio y abrir el 443).
- [ ] **Fase 7 — Live:** contratar el add-on de marcadores en vivo, polling por ventana y SSE.
- [ ] **Fase 8 — Producto:** favoritos, notificaciones y estadísticas avanzadas.

## Checklist de aceptación

- [x] La home lista partidos y permite filtrar por competición, estado y fecha.
- [x] Un partido finalizado muestra su marcador definitivo; uno programado, el horario.
- [x] Una búsqueda sin resultados muestra un estado vacío, no una pantalla en blanco.
- [x] Los partidos en vivo del proveedor no se muestran con marcador.
- [x] Cambiar de proveedor no modifica nada dentro de `src/domain`.
- [x] Ninguna credencial aparece en el bundle del cliente (la API key sólo se lee en el servidor).
- [x] La interfaz funciona en mobile (el prototipo no era responsive en su barra lateral).
- [x] `npm test` pasa: 20 tests sobre el dominio puro.

## Próximos pasos

1. **Fase 6b:** ejecutar `bash deploy.sh` y, cuando haya dominio, agregar TLS. Ver `docs/despliegue.md`.
2. Migrar de SQLite a PostgreSQL si el proyecto crece: el repositorio concentra todo el SQL,
   así que el cambio queda contenido en `infrastructure/db/`.
3. Evaluar el add-on de datos profundos si se quieren goleadores y alineaciones (ver `docs/datos.md`).
