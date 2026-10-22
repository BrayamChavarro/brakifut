import Link from "next/link";

import { MaterialIcon } from "./MaterialIcon";

/** Estado vacio generico. Un listado vacio nunca debe quedar en blanco. */
export function EmptyState({
  icon = "search_off",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant/30 bg-surface-container-low/40 px-6 py-12 text-center">
      <MaterialIcon name={icon} className="text-[32px] text-on-surface-variant/60" />
      <p className="font-display text-headline-sm text-on-surface">{title}</p>
      <p className="max-w-md text-body-sm text-on-surface-variant">{description}</p>
      {action ? (
        <Link
          href={action.href}
          className="mt-2 rounded-lg bg-primary-container px-3 py-1.5 text-label-md text-on-primary-container transition-opacity hover:opacity-90"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
