import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCompetitionViewModel } from "@/application/queries";
import { EmptyState } from "@/components/EmptyState";
import { MatchRow } from "@/components/MatchRow";
import { StandingsTable } from "@/components/StandingsTable";
import { formatLongDate } from "@/lib/format";
import { buildQuery } from "@/lib/url";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const view = await getCompetitionViewModel(slug, null);
  return { title: view ? view.competition.name : "Competición no encontrada" };
}

export default async function CompetitionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ jornada?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);

  const requested: number | "all" | null =
    query.jornada === "todas"
      ? "all"
      : Number.isFinite(Number.parseInt(query.jornada ?? "", 10))
        ? Number.parseInt(query.jornada as string, 10)
        : null;

  const view = await getCompetitionViewModel(slug, requested);
  if (!view) notFound();

  const action = `/competicion/${slug}`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <header className="mb-4">
          <h1 className="font-display text-headline-lg text-on-surface">
            {view.competition.name}
          </h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {[view.competition.area, view.competition.season].filter(Boolean).join(" · ")}
            {" · "}
            {view.totalMatches} partidos
          </p>
        </header>

        <section className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
          <h2 className="mb-3 font-display text-headline-sm text-on-surface">
            Tabla de posiciones
          </h2>
          <StandingsTable rows={view.standings} />
          <p className="mt-3 text-label-sm text-on-surface-variant/70">
            Calculada a partir de los partidos finalizados que hay en la base.
          </p>
        </section>
      </div>

      <div className="lg:col-span-7">
        <div className="mb-3 flex flex-wrap items-center gap-1">
          <Link
            href={`${action}${buildQuery({ jornada: "todas" })}`}
            className={`rounded-lg px-2.5 py-1.5 text-label-sm transition-colors ${
              view.selectedMatchday === "all"
                ? "bg-primary-container text-on-primary-container"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }`}
          >
            Todas
          </Link>
          {view.matchdays.map((matchday) => (
            <Link
              key={matchday}
              href={`${action}${buildQuery({ jornada: matchday })}`}
              className={`rounded-lg px-2.5 py-1.5 text-label-sm transition-colors ${
                view.selectedMatchday === matchday
                  ? "bg-primary-container text-on-primary-container"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              J{matchday}
            </Link>
          ))}
        </div>

        {view.groups.length === 0 ? (
          <EmptyState
            icon="event_busy"
            title="Sin partidos en esta jornada"
            description="Elegí otra jornada o volvé a la vista completa."
            action={{ href: action, label: "Ver todas las jornadas" }}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {view.groups.map((group) => (
              <section key={group.dateKey}>
                <h2 className="mb-2 font-display text-headline-sm text-on-surface-variant">
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
      </div>
    </div>
  );
}
