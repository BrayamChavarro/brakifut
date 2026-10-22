# Fuentes de datos

## Comparación

Precios verificados el 2026-10-16 en la web de cada proveedor. Revalidá antes de contratar.

| Proveedor | Free tier | Plan con live | Competiciones | Rate limit |
| --- | --- | --- | --- | --- |
| [football-data.org](https://www.football-data.org/pricing) | €0/mes, scores **diferidos** | €12/mes | 12 en free, 30 en Standard (€49) | 10 llamadas/min (free) |
| [API-Football](https://www.api-football.com) | Plan gratuito por día | Planes pagos | Cobertura amplia (~1000 ligas) | Por día; verificar |
| SportMonks | Sin free tier útil | Pago | Amplia, webhooks en planes altos | Por plan |
| TheSportsDB | Free con Patreon | — | Básica | Baja fiabilidad para live |

Notas de verificación:

- `football-data.org` respondió y los números de la tabla son los de su página de precios.
- `api-football.com` y `api-sports.io` bloquearon el fetch automático (403). Sus límites del plan
  gratuito **no están verificados acá**: confirmalos en el dashboard antes de decidir.

## Decisión

**football-data.org, plan gratuito.** La v1 no tiene marcador en vivo: los scores del free tier son
diferidos, pero alcanza para construir fixtures, resultados, tablas e historial de punta a punta.

Qué incluye el free tier (verificado 2026-10-16): 12 competiciones, fixtures, schedules y
**league tables**, con 10 llamadas/minuto. Scores **diferidos**, no en vivo.

Qué implica:

- No hay worker de alta frecuencia todavía: alcanza un job de sincronización cada 15-30 min más
  revalidación bajo demanda.
- Los widgets del prototipo que dependen de live o de estadísticas avanzadas quedan sin fuente:
  ver la tabla en `design/README.md`.
- El salto a live es un add-on que no toca el dominio: solo se agrega el polling por ventana y SSE.

Alternativa cuando llegue la Fase 7: el plan de €12/mes desbloquea live scores con 20 llamadas/min.
Si además querés goleadores, alineaciones y tarjetas (que el prototipo muestra), el plan que los
incluye es el de €29/mes "Free + Deep Data", no el de €12.

## Regla de oro del polling (Fase 7)

**Preferí un endpoint batch antes que N llamadas por partido.**

Un endpoint del tipo `GET /matches?status=LIVE` devuelve *todos* los partidos en vivo en una sola
llamada. Con 1 llamada cada 20 s cubrís los 12 partidos en vivo de la jornada a 3 llamadas/min.
La alternativa ingenua (12 llamadas cada 20 s) son 36 llamadas/min y te saca del free tier al instante.

## Presupuesto de polling (Fase 7)

| Estado del partido | Frecuencia | Estrategia | Costo estimado |
| --- | --- | --- | --- |
| En vivo | 15-20 s | 1 llamada batch a todos los live | 3-4 llamadas/min total |
| `halftime` | 60 s | batch | 1 llamada/min |
| Próximo (< 2 h) | 5 min | batch por fecha | 0,2 llamadas/min |
| Finalizado | 1 vez, + 10 min de gracia | por partido | 2 llamadas |
| Histórico | bajo demanda, caché 24 h | por partido | 1 llamada |

Los intervalos son configurables por entorno (`POLL_LIVE_SECONDS`, `POLL_UPCOMING_SECONDS`) para
ajustarlos al plan contratado sin recompilar.

## Puerto del proveedor

```ts
export interface FootballProvider {
  readonly name: string;

  /** Partidos de una ventana temporal. Una sola llamada para todos los partidos. */
  fetchMatches(params: {
    competitionIds?: string[];
    fromUtc: string;
    toUtc: string;
    statuses?: MatchStatus[];
  }): Promise<ProviderMatch[]>;

  fetchStandings(params: { competitionId: string; season: string }): Promise<ProviderStanding[]>;

  /** Capacidades reales del proveedor: la UI se adapta, no asume. */
  readonly capabilities: {
    liveScores: boolean;
    expectedGoals: boolean;
    possession: boolean;
    lineups: boolean;
    odds: boolean;
  };
}
```

`capabilities` es clave: el free tier de football-data.org no tiene live scores ni xG. En vez de
esparcir `if (provider === "footballdata")` por la UI, la UI consulta capacidades y oculta o marca
como "no disponible" lo que el proveedor no ofrece.

## Identidad canónica

Cada proveedor nombra y numera los equipos a su manera. Para no atar la base a un proveedor:

```sql
create table team (
  id          text primary key,      -- slug interno estable: "real-madrid"
  name        text not null,
  short_name  text,
  crest_url   text
);

create table team_provider_map (
  team_id      text not null references team(id),
  provider     text not null,        -- "footballdata"
  provider_id  text not null,        -- "86"
  primary key (provider, provider_id)
);
```

La app siempre usa `team.id`. La tabla de mapeo es la única que conoce los ids del proveedor.
Cargala con un seed inicial y mantené un reporte de ids sin mapear para detectar altas nuevas.

## Legal

- Respetá la atribución exigida por el plan contratado.
- Las **cuotas de apuestas** suelen tener licencia separada y add-on propio (€15/mes en
  football-data.org). El toggle "Cuotas" del prototipo depende de eso.
- Los escudos y nombres de clubes son marcas registradas: usalos solo como referencia informativa.
