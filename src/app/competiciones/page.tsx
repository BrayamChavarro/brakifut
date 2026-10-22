import type { Metadata } from "next";
import Link from "next/link";

import { getShellViewModel } from "@/application/queries";
import { MaterialIcon } from "@/components/MaterialIcon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Competiciones",
};

export default async function CompetitionsPage() {
  const shell = await getShellViewModel();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="font-display text-headline-lg text-on-surface">Competiciones</h1>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Historial y tabla de posiciones por competición.
        </p>
      </header>

      {shell.competitions.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">
          Todavía no hay competiciones cargadas. Usá el botón «Sincronizar».
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shell.competitions.map((competition) => (
            <Link
              key={competition.id}
              href={`/competicion/${competition.slug}`}
              className="flex items-center gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 transition-colors hover:border-primary-container/40 hover:bg-surface-container"
            >
              <MaterialIcon name="emoji_events" className="text-[24px] text-primary-container" />
              <span className="min-w-0">
                <span className="block truncate font-display text-headline-sm text-on-surface">
                  {competition.name}
                </span>
                <span className="block text-label-sm text-on-surface-variant">
                  {[competition.area, competition.season].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="ml-auto shrink-0 text-label-sm text-on-surface-variant">
                {competition.matchCount} partidos
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
