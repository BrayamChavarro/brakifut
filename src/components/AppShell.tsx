import Link from "next/link";

import type { ShellViewModel } from "@/application/queries";
import { formatDateTime } from "@/lib/format";

import { MaterialIcon } from "./MaterialIcon";
import { SearchForm } from "./SearchForm";
import { SyncButton } from "./SyncButton";

/**
 * Marco de la aplicacion: header fijo + barra lateral de competiciones.
 *
 * Correccion deliberada respecto del prototipo: la barra es `hidden xl:flex` y
 * el contenido se desplaza con `xl:pl-64`. El prototipo tenia `fixed w-64` sin
 * breakpoint y un `pl-64` fijo, asi que en un telefono el contenido quedaba
 * aplastado en ~100 px. Ademas se reemplaza el <img> de `lh3.googleusercontent.com`
 * (URL temporal del generador) por el logotipo tipografico.
 */
export function AppShell({
  shell,
  children,
}: {
  shell: ShellViewModel;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-outline-variant/30 bg-surface/90 backdrop-blur-xl">
        <div className="flex h-full items-center gap-4 px-4 lg:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <MaterialIcon name="sports_soccer" className="text-primary-container" />
            <span className="font-display text-lg font-extrabold tracking-tight text-primary">
              PITCH<span className="text-primary-container">PULSE</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            <HeaderLink href="/" icon="calendar_month" label="Partidos" />
            <HeaderLink href="/competiciones" icon="emoji_events" label="Competiciones" />
          </nav>

          <div className="mx-auto hidden w-full max-w-md md:block">
            <SearchForm defaultValue="" />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
            <SyncButton isDemoData={shell.isDemoData} />
          </div>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-16 z-40 hidden w-64 flex-col overflow-y-auto border-r border-outline-variant/20 bg-surface-container-lowest xl:flex">
        <div className="p-4">
          <p className="mb-3 flex items-center justify-between px-2 text-label-sm font-bold uppercase tracking-wider text-on-surface-variant/80">
            <span>Competiciones</span>
            <MaterialIcon name="military_tech" className="text-[16px]" />
          </p>

          <nav className="flex flex-col gap-1">
            {shell.competitions.map((competition) => (
              <Link
                key={competition.id}
                href={`/competicion/${competition.slug}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                <MaterialIcon name="emoji_events" className="text-[18px]" />
                <span className="truncate text-body-sm">{competition.name}</span>
                <span className="ml-auto text-label-sm text-on-surface-variant/60">
                  {competition.matchCount}
                </span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-xl bg-surface-container-low/60 p-3">
            <div className="mb-1 flex items-center gap-1 text-label-md text-primary-container">
              <MaterialIcon name="database" className="text-[18px]" />
              <span>Fuente de datos</span>
            </div>
            <p className="text-body-sm leading-tight text-on-surface-variant">
              {shell.isDemoData
                ? "Dataset de demostración (sintético)."
                : "football-data.org"}
            </p>
            <p className="mt-1 text-label-sm text-on-surface-variant/70">
              {shell.lastSync
                ? `Última sincronización: ${formatDateTime(shell.lastSync.finishedAt)}`
                : "Sin sincronizar"}
            </p>
          </div>
        </div>
      </aside>

      <div className="pt-16 xl:pl-64">
        {shell.isDemoData ? <DemoBanner /> : null}
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-6">
          <nav className="mb-4 flex gap-2 overflow-x-auto pb-1 xl:hidden">
            {shell.competitions.map((competition) => (
              <Link
                key={competition.id}
                href={`/competicion/${competition.slug}`}
                className="whitespace-nowrap rounded-lg bg-surface-container-low px-3 py-1.5 text-body-sm text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                {competition.name}
              </Link>
            ))}
          </nav>
          {children}
        </div>
      </div>
    </>
  );
}

function HeaderLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded px-2 py-1 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
    >
      <MaterialIcon name={icon} className="text-[18px]" />
      {label}
    </Link>
  );
}

function DemoBanner() {
  return (
    <div className="border-b border-tertiary-fixed-dim/20 bg-tertiary-fixed-dim/5 px-4 py-2 lg:px-6">
      <p className="mx-auto flex max-w-[1400px] items-center gap-2 text-body-sm text-tertiary-fixed-dim">
        <MaterialIcon name="info" className="text-[16px]" />
        Los resultados mostrados son <strong>datos de demostración generados</strong>,
        no partidos reales. Configurá <code className="rounded bg-surface-container px-1">FOOTBALL_API_KEY</code>{" "}
        y sincronizá para traer el historial real de football-data.org.
      </p>
    </div>
  );
}
