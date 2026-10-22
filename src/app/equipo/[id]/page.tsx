import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getTeamViewModel } from "@/application/queries";
import { MatchRow } from "@/components/MatchRow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Equipo",
};

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await getTeamViewModel(decodeURIComponent(id));

  if (!view) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="font-display text-headline-lg text-on-surface">{view.team.name}</h1>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          {view.matches.length} partidos registrados
        </p>
      </header>

      <section>
        <h2 className="mb-2 font-display text-headline-sm text-on-surface">
          Historial
        </h2>
        <div className="flex flex-col gap-2">
          {view.matches.map((match) => (
            <MatchRow key={match.id} match={match} showDate />
          ))}
        </div>
      </section>
    </div>
  );
}
