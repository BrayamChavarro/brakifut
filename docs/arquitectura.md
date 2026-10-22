# Arquitectura

Arquitectura hexagonal ligera en un solo paquete. El dominio no depende de nada; la infraestructura
implementa lo que el dominio y la aplicación definen.

## Regla de dependencias

```
app (UI + route handlers)  →  application (casos de uso)  →  domain (entidades y reglas)
                                        ↑
                              infrastructure (implementa puertos)
```

Nunca al revés. `src/domain` no importa Next.js, ni Prisma, ni `fetch`.

## Estructura de carpetas

```
oracle-cloud/
├── design/                       # prototipo Stitch (referencia visual, no se despliega)
├── docs/                         # pautas y decisiones
├── src/
│   ├── domain/                   # puro, sin I/O, 100% testeable
│   │   ├── match.ts              # Match, MatchEvent, Score
│   │   ├── competition.ts
│   │   ├── team.ts
│   │   └── match-status.ts       # máquina de estados
│   ├── application/              # casos de uso
│   │   ├── get-matches-by-date.ts
│   │   ├── get-match-detail.ts
│   │   ├── get-standings.ts
│   │   └── sync-competition.ts   # usado por el job de sincronización
│   ├── infrastructure/
│   │   ├── providers/            # un archivo por proveedor
│   │   │   ├── provider.port.ts  # interfaz
│   │   │   ├── football-data/    # adapter real
│   │   │   ├── mock/             # adapter de desarrollo (sin red)
│   │   │   └── index.ts          # factory según FOOTBALL_PROVIDER
│   │   ├── db/                   # repositorios + migraciones
│   │   └── events/               # pub/sub para SSE (Fase 7)
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # Marcador Central (home)
│   │   ├── partido/[id]/page.tsx
│   │   ├── competicion/[slug]/page.tsx
│   │   └── api/
│   │       ├── matches/route.ts
│   │       └── live/route.ts     # SSE (Fase 7)
│   ├── components/               # UI derivada del prototipo
│   │   ├── match-row.tsx
│   │   ├── match-hero.tsx
│   │   ├── live-feed.tsx
│   │   └── standings-table.tsx
│   ├── styles/tokens.css         # tokens portados del prototipo
│   └── worker/index.ts           # job de sincronización (entrypoint aparte)
├── docker-compose.yml
├── env.example
└── README.md
```

## Dominio (boceto)

```ts
export type MatchStatus =
  | "scheduled"
  | "live"
  | "halftime"
  | "finished"
  | "postponed"
  | "suspended"
  | "cancelled";

export type MatchEvent =
  | { type: "goal"; minute: number; teamId: string; scorerId?: string; ownGoal?: boolean; penalty?: boolean }
  | { type: "card"; card: "yellow" | "red"; minute: number; teamId: string; playerId: string }
  | { type: "substitution"; minute: number; teamId: string; inPlayerId: string; outPlayerId: string };

export interface Match {
  id: string;              // id interno estable
  competitionId: string;
  season: string;
  kickoffUtc: string;      // ISO 8601, siempre UTC
  status: MatchStatus;
  minute?: number;
  home: { team: TeamRef; score: number };
  away: { team: TeamRef; score: number };
  events: MatchEvent[];
  updatedAt: string;
}
```

Decisiones de modelado:

- `status` es un enum con transiciones válidas explícitas, no un booleano `isLive`.
- `minute` es opcional: solo existe entre el kickoff y el final.
- Los eventos se guardan como lista ordenada y se deduplican al insertar.
- Los agregados que muestra el prototipo (xG, posesión, tiros) son opcionales por proveedor:
  modelalos como `MatchStats | undefined`, no como campos obligatorios.

## Flujo de datos

### v1 — sin live scores

1. Un job programado corre cada 15-30 minutos (y bajo demanda cuando alguien abre la app).
2. Pide al proveedor los fixtures, resultados y tablas de las competiciones configuradas.
3. Hace **una** llamada por competición y fecha, no una por partido.
4. Normaliza al modelo canónico y hace upsert idempotente.
5. La UI lee siempre de PostgreSQL, nunca espera al proveedor.

El plan gratuito entrega **scores diferidos**: un partido puede tardar en reflejar el resultado
final. La UI debe mostrar la hora de la última sincronización en vez de fingir frescura.

### Fase 7 — con live scores

1. El worker despierta según el presupuesto de polling (`docs/datos.md`).
2. Pregunta a PostgreSQL qué partidos están en ventana (en vivo o por arrancar).
3. Hace **una** llamada batch al proveedor por conjunto de partidos.
4. Normaliza, deduplica eventos y hace upsert.
5. Publica el delta (`match.updated`).
6. El route handler SSE empuja el delta al navegador.
7. El navegador actualiza solo la fila afectada.

## Por qué no un monorepo

Un monorepo con `apps/web` + `apps/worker` + `packages/domain` es correcto cuando hay varios
consumidores del dominio (mobile, admin, otros servicios). Hoy hay un solo consumidor y dos procesos
del mismo despliegue. La separación por capas dentro de `src/` da el mismo orden sin el costo de
workspaces, CI múltiple y versionado de paquetes internos.

Si aparece una app móvil o un panel de administración, recién ahí se parte en workspace: las capas
ya están separadas, así que el cambio es mecánico.
