import { listMatches, type MatchStatusFilter } from "@/infrastructure/db/repository";
import { ensureData } from "@/application/sync";

export const dynamic = "force-dynamic";

/**
 * GET /api/matches
 *
 * API de lectura del historial. Reutiliza exactamente la misma consulta que la
 * interfaz (listMatches), asi que no hay logica duplicada entre la web y la API.
 *
 * Parametros: competicion, estado (finished|upcoming|all), desde, hasta, equipo,
 * q, pagina, porPagina.
 */
export async function GET(request: Request) {
  await ensureData();

  const url = new URL(request.url);
  const rawStatus = url.searchParams.get("estado");
  const status: MatchStatusFilter =
    rawStatus === "finished" || rawStatus === "upcoming" ? rawStatus : "all";

  const page = Math.max(1, Number.parseInt(url.searchParams.get("pagina") ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get("porPagina") ?? "20", 10) || 20),
  );

  const { matches, total } = listMatches({
    competitionSlug: url.searchParams.get("competicion") ?? undefined,
    status,
    fromDateKey: url.searchParams.get("desde") ?? undefined,
    toDateKey: url.searchParams.get("hasta") ?? undefined,
    teamId: url.searchParams.get("equipo") ?? undefined,
    query: url.searchParams.get("q") ?? undefined,
    order: status === "upcoming" ? "asc" : "desc",
    limit,
    offset: (page - 1) * limit,
  });

  return Response.json({
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / limit)),
    count: matches.length,
    matches,
  });
}
