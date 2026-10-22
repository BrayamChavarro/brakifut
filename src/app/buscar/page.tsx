import type { Metadata } from "next";
import Link from "next/link";

import { getSearchViewModel } from "@/application/queries";
import { EmptyState } from "@/components/EmptyState";
import { MatchRow } from "@/components/MatchRow";
import { SearchForm } from "@/components/SearchForm";
import { StandingsTable } from "@/components/StandingsTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Búsqueda",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const view = await getSearchViewModel(params.q ?? "");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="font-display text-headline-lg text-on-surface">Búsqueda</h1>
        <p className="mt-1 mb-3 text-body-sm text-on-surface-variant">
          Buscá por equipo, competición o estadio.
        </p>
        <SearchForm defaultValue={view.query} id="buscador-principal" />
      </header>

      {view.query.length === 0 ? (
        <EmptyState
          icon="travel_explore"
          title="¿Qué querés buscar?"
          description="Escribí el nombre de un equipo (por ejemplo «Real Madrid»), una competición («Bundesliga») o un estadio."
        />
      ) : (
        <>
          <section aria-labelledby="resultados-equipos">
            <h2
              id="resultados-equipos"
              className="mb-2 font-display text-headline-sm text-on-surface"
            >
              Equipos ({view.teams.length})
            </h2>

            {view.teams.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">
                Ningún equipo coincide con «{view.query}».
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {view.teams.map((team) => (
                  <Link
                    key={team.id}
                    href={`/equipo/${encodeURIComponent(team.id)}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-2 transition-colors hover:border-primary-container/40 hover:bg-surface-container"
                  >
                    <span className="truncate text-body-md text-on-surface">
                      {team.name}
                    </span>
                    <span className="shrink-0 text-label-sm text-on-surface-variant">
                      {team.matchCount} partidos
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {view.competitions.length > 0 ? (
            <section aria-labelledby="resultados-competiciones">
              <h2
                id="resultados-competiciones"
                className="mb-2 font-display text-headline-sm text-on-surface"
              >
                Competiciones
              </h2>
              <div className="flex flex-wrap gap-2">
                {view.competitions.map((competition) => (
                  <Link
                    key={competition.id}
                    href={`/competicion/${competition.slug}`}
                    className="rounded-lg bg-surface-container-low px-3 py-1.5 text-body-sm text-on-surface transition-colors hover:bg-surface-container-high"
                  >
                    {competition.name}
                    <span className="ml-2 text-on-surface-variant">
                      {competition.matchCount}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="resultados-partidos">
            <h2
              id="resultados-partidos"
              className="mb-2 font-display text-headline-sm text-on-surface"
            >
              Partidos ({view.totalMatches})
            </h2>

            {view.matches.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">
                No hay partidos que coincidan con «{view.query}».
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {view.matches.map((match) => (
                  <MatchRow key={match.id} match={match} showDate />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
