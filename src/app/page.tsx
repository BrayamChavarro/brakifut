import type { Metadata } from "next";
import Link from "next/link";

import {
  getHomeViewModel,
  type HomeFilters,
} from "@/application/queries";
import { DateNav } from "@/components/DateNav";
import { EmptyState } from "@/components/EmptyState";
import { MaterialIcon } from "@/components/MaterialIcon";
import { MatchRow } from "@/components/MatchRow";
import { Pagination } from "@/components/Pagination";
import { StandingsTable } from "@/components/StandingsTable";
import { formatLongDate } from "@/lib/format";
import { buildQuery, type QueryValue } from "@/lib/url";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Partidos",
  description: "Historial de resultados, buscable por competición, fecha o equipo.",
};

interface HomeSearchParams {
  competicion?: string;
  estado?: string;
  fecha?: string;
  q?: string;
  pagina?: string;
}

const STATUS_OPTIONS = [
  { value: "finished", label: "Resultados" },
  { value: "upcoming", label: "Próximos" },
  { value: "all", label: "Todos" },
] as const;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  const params = await searchParams;

  const status =
    params.estado === "upcoming"
      ? "upcoming"
      : params.estado === "all"
        ? "all"
        : "finished";

  // "Proximos" se lee hacia adelante; el historial hacia atras.
  const order = status === "upcoming" ? "asc" : "desc";

  const page = Number.parseInt(params.pagina ?? "1", 10);

  const filters: HomeFilters = {
    competition: params.competicion || undefined,
    status,
    date: params.fecha || undefined,
    query: params.q || undefined,
    order,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };

  const view = await getHomeViewModel(filters);

  const baseQuery: Record<string, QueryValue> = {
    competicion: filters.competition,
    estado: status === "finished" ? undefined : status,
    fecha: filters.date,
    q: filters.query,
  };

  const heading =
    status === "upcoming"
      ? "Próximos partidos"
      : status === "all"
        ? "Todos los partidos"
        : "Historial de resultados";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <header className="mb-4">
          <h1 className="font-display text-headline-lg text-on-surface">{heading}</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {filters.date
              ? formatLongDate(`${filters.date}T12:00:00Z`)
              : "Explorá por competición o elegí una fecha. También podés buscar un equipo."}
          </p>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((option) => (
              <Link
                key={option.value}
                href={`/${buildQuery({
                  competicion: filters.competition,
                  fecha: filters.date,
                  q: filters.query,
                  estado: option.value === "finished" ? undefined : option.value,
                })}`}
                className={`rounded-lg px-3 py-1.5 text-label-md transition-colors ${
                  status === option.value
                    ? "bg-primary-container text-on-primary-container"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>

          {view.competitions.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              <Link
                href={`/${buildQuery({ estado: status === "finished" ? undefined : status, fecha: filters.date })}`}
                className={`rounded-lg px-2.5 py-1.5 text-label-sm transition-colors ${
                  filters.competition
                    ? "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    : "bg-surface-container-high text-primary-container"
                }`}
              >
                Todas
              </Link>
              {view.competitions.map((competition) => (
                <Link
                  key={competition.id}
                  href={`/${buildQuery({
                    competicion: competition.slug,
                    estado: status === "finished" ? undefined : status,
                    fecha: filters.date,
                  })}`}
                  className={`rounded-lg px-2.5 py-1.5 text-label-sm transition-colors ${
                    filters.competition === competition.slug
                      ? "bg-surface-container-high text-primary-container"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                >
                  {competition.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mb-4">
          <DateNav dateKey={filters.date ?? null} action="/" base={baseQuery} />
        </div>

        {view.groups.length === 0 ? (
          <EmptyState
            icon="event_busy"
            title="No hay partidos con estos filtros"
            description="Probá con otra fecha, cambiá de pestaña o quitá el filtro de competición."
            action={{ href: "/", label: "Ver todo el historial" }}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {view.groups.map((group) => (
              <section key={group.dateKey} aria-labelledby={`dia-${group.dateKey}`}>
                <h2
                  id={`dia-${group.dateKey}`}
                  className="mb-2 font-display text-headline-sm text-on-surface-variant"
                >
                  {formatLongDate(`${group.dateKey}T12:00:00Z`)}
                </h2>
                <div className="flex flex-col gap-2">
                  {group.matches.map((match) => (
                    <MatchRow key={match.id} match={match} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-4">
          <Pagination
            page={view.page}
            pageCount={view.pageCount}
            action="/"
            base={baseQuery}
          />
        </div>
      </div>

      <aside className="lg:col-span-4">
        <div className="sticky top-24 flex flex-col gap-4">
          {view.featuredCompetition ? (
            <section className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-display text-headline-sm text-on-surface">
                  {view.featuredCompetition.name}
                </h2>
                <Link
                  href={`/competicion/${view.featuredCompetition.slug}`}
                  className="text-label-sm text-primary-container hover:underline"
                >
                  Ver tabla
                </Link>
              </div>
              <StandingsTable rows={view.featuredStandings} compact />
            </section>
          ) : null}

          <section className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
            <h2 className="mb-2 flex items-center gap-1.5 font-display text-headline-sm text-on-surface">
              <MaterialIcon name="info" className="text-[18px] text-primary-container" />
              Sobre los datos
            </h2>
            <ul className="flex flex-col gap-1.5 text-body-sm text-on-surface-variant">
              <li>
                Resultados totales en la base: <strong className="text-on-surface">{view.total}</strong>
              </li>
              <li>
                Fuente actual:{" "}
                <strong className="text-on-surface">
                  {view.lastSync?.provider === "football-data"
                    ? "football-data.org"
                    : "dataset de demostración"}
                </strong>
              </li>
              <li>
                Los resultados se muestran hasta la última sincronización. No se
                publican marcadores en vivo.
              </li>
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}
