import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getMatchDetailViewModel } from "@/application/queries";
import { MATCH_STATUS_LABEL, hasScore, type Match } from "@/domain/match";
import { MaterialIcon } from "@/components/MaterialIcon";
import { MatchRow } from "@/components/MatchRow";
import { StandingsTable } from "@/components/StandingsTable";
import { TeamBadge } from "@/components/TeamBadge";
import { formatDateTime, formatLongDate, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const view = await getMatchDetailViewModel(id);

  if (!view) return { title: "Partido no encontrado" };

  const { match } = view;
  const score = hasScore(match) ? ` ${match.homeScore}-${match.awayScore}` : "";

  return {
    title: `${match.homeTeam.name} vs ${match.awayTeam.name}${score}`,
    description: `${match.competitionName} · ${formatLongDate(match.kickoffUtc)}`,
  };
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await getMatchDetailViewModel(id);

  if (!view) notFound();

  const { match } = view;
  const played = hasScore(match);
  const homeWon = played && match.homeScore! > match.awayScore!;
  const awayWon = played && match.awayScore! > match.homeScore!;
  const highlight = [match.homeTeam.id, match.awayTeam.id];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <nav className="mb-3 flex items-center gap-1 text-label-sm text-on-surface-variant">
          <Link href="/" className="hover:text-on-surface hover:underline">
            Partidos
          </Link>
          <MaterialIcon name="chevron_right" className="text-[14px]" />
          <Link
            href={`/competicion/${match.competitionSlug}`}
            className="hover:text-on-surface hover:underline"
          >
            {match.competitionName}
          </Link>
        </nav>

        <section className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-5">
          <p className="mb-4 text-label-sm text-on-surface-variant">
            {match.competitionName}
            {match.matchday !== null ? ` · Jornada ${match.matchday}` : ""}
            {match.season ? ` · Temporada ${match.season}` : ""}
          </p>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex flex-col items-center gap-2 text-center">
              <TeamBadge tla={match.homeTeam.tla} name={match.homeTeam.name} />
              <span className="font-display text-headline-sm text-on-surface">
                {match.homeTeam.name}
              </span>
              <span className="text-label-sm text-on-surface-variant">Local</span>
            </div>

            <div className="flex min-w-[110px] flex-col items-center">
              {played ? (
                <span className="font-display text-score-display tabular-nums text-on-surface">
                  {match.homeScore} - {match.awayScore}
                </span>
              ) : (
                <>
                  <span className="font-display text-headline-lg tabular-nums text-on-surface">
                    {formatTime(match.kickoffUtc)}
                  </span>
                  <span className="text-label-sm text-on-surface-variant">
                    {MATCH_STATUS_LABEL[match.status]}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <TeamBadge tla={match.awayTeam.tla} name={match.awayTeam.name} />
              <span className="font-display text-headline-sm text-on-surface">
                {match.awayTeam.name}
              </span>
              <span className="text-label-sm text-on-surface-variant">Visitante</span>
            </div>
          </div>

          {played ? (
            <p className="mt-4 text-center text-body-sm text-on-surface-variant">
              {homeWon
                ? `Ganó ${match.homeTeam.name}`
                : awayWon
                  ? `Ganó ${match.awayTeam.name}`
                  : "Empate"}
            </p>
          ) : null}

          <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-outline-variant/20 pt-4 sm:grid-cols-3">
            <div>
              <dt className="text-label-sm uppercase tracking-wide text-on-surface-variant/70">
                Fecha
              </dt>
              <dd className="text-body-sm text-on-surface">
                {formatLongDate(match.kickoffUtc)}
              </dd>
            </div>
            <div>
              <dt className="text-label-sm uppercase tracking-wide text-on-surface-variant/70">
                Hora local
              </dt>
              <dd className="text-body-sm text-on-surface">
                {formatTime(match.kickoffUtc)}
              </dd>
            </div>
            <div>
              <dt className="text-label-sm uppercase tracking-wide text-on-surface-variant/70">
                Estadio
              </dt>
              <dd className="text-body-sm text-on-surface">
                {match.venue ?? "No informado"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 font-display text-headline-sm text-on-surface">
            Historial entre estos equipos
          </h2>
          {view.headToHead.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">
              No hay enfrentamientos anteriores registrados para estos equipos.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {view.headToHead.map((previous) => (
                <MatchRow key={previous.id} match={previous} showDate />
              ))}
            </div>
          )}
        </section>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TeamForm title={`Últimos de ${match.homeTeam.name}`} matches={view.recentHome} />
          <TeamForm title={`Últimos de ${match.awayTeam.name}`} matches={view.recentAway} />
        </div>
      </div>

      <aside className="lg:col-span-4">
        <div className="sticky top-24 flex flex-col gap-4">
          <section className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
            <h2 className="mb-3 font-display text-headline-sm text-on-surface">
              Tabla de {match.competitionName}
            </h2>
            <StandingsTable rows={view.standings.slice(0, 8)} highlightTeamIds={highlight} compact />
            <p className="mt-2 text-label-sm text-on-surface-variant/70">
              Puesto: {view.homePosition ?? "-"} {match.homeTeam.name} ·{" "}
              {view.awayPosition ?? "-"} {match.awayTeam.name}
            </p>
          </section>

          <section className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
            <h2 className="mb-2 flex items-center gap-1.5 font-display text-headline-sm text-on-surface">
              <MaterialIcon name="update" className="text-[18px] text-primary-container" />
              Procedencia
            </h2>
            <ul className="flex flex-col gap-1 text-body-sm text-on-surface-variant">
              <li>
                Fuente:{" "}
                <strong className="text-on-surface">
                  {match.source === "football-data" ? "football-data.org" : "demostración"}
                </strong>
              </li>
              <li>
                Actualizado: <strong className="text-on-surface">{formatDateTime(match.updatedAt)}</strong>
              </li>
            </ul>
            <p className="mt-2 text-label-sm text-on-surface-variant/70">
              Sin datos en vivo: este plan no publica minuto a minuto, goles ni
              tarjetas.
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}

function TeamForm({ title, matches }: { title: string; matches: Match[] }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-headline-sm text-on-surface">{title}</h2>
      {matches.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">Sin partidos finalizados.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {matches.map((item) => (
            <li key={item.id}>
              <MatchRow match={item} showDate />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
