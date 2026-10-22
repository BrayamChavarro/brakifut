import type { StandingRow } from "@/domain/standings";

import { TeamBadge } from "./TeamBadge";

/**
 * Tabla de posiciones.
 *
 * Se muestra compacta (posicion, equipo, jugados, diferencia de gol, puntos)
 * porque el ancho disponible en la barra lateral es chico y las columnas
 * completas no aportan en la lectura rapida. La tabla completa vive en la
 * pagina de la competicion.
 *
 * Las tres primeras posiciones se marcan con un punto verde: es la convencion
 * de "zona de clasificacion" que el usuario ya conoce.
 */
export function StandingsTable({
  rows,
  highlightTeamIds = [],
  compact = false,
}: {
  rows: StandingRow[];
  highlightTeamIds?: string[];
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-body-sm text-on-surface-variant">
        Todavía no hay partidos finalizados.
      </p>
    );
  }

  return (
    <div className="overflow-hidden">
      <table className="w-full border-collapse text-body-sm">
        <thead>
          <tr className="text-label-sm uppercase tracking-wide text-on-surface-variant/70">
            <th scope="col" className="w-8 py-1.5 text-left font-semibold">
              #
            </th>
            <th scope="col" className="py-1.5 text-left font-semibold">
              Equipo
            </th>
            <th scope="col" className="w-10 py-1.5 text-center font-semibold">
              PJ
            </th>
            {compact ? null : (
              <th scope="col" className="w-10 py-1.5 text-center font-semibold">
                DG
              </th>
            )}
            <th scope="col" className="w-10 py-1.5 text-center font-semibold">
              Pts
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const position = index + 1;
            const isHighlighted = highlightTeamIds.includes(row.teamId);

            return (
              <tr
                key={row.teamId}
                className={`border-t border-outline-variant/15 ${
                  isHighlighted ? "bg-primary-container/5" : ""
                }`}
              >
                <td className="py-1.5">
                  <span className="flex items-center gap-1 tabular-nums text-on-surface-variant">
                    {position <= 3 ? (
                      <span
                        aria-label="Zona de clasificación"
                        className="h-1.5 w-1.5 rounded-full bg-primary-container"
                      />
                    ) : null}
                    {position}
                  </span>
                </td>
                <td className="max-w-0 py-1.5">
                  <span className="flex items-center gap-2">
                    <TeamBadge tla={row.tla} name={row.teamName} size="sm" />
                    <span className="truncate text-on-surface">{row.teamName}</span>
                  </span>
                </td>
                <td className="py-1.5 text-center tabular-nums text-on-surface-variant">
                  {row.played}
                </td>
                {compact ? null : (
                  <td className="py-1.5 text-center tabular-nums text-on-surface-variant">
                    {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                  </td>
                )}
                <td className="py-1.5 text-center font-bold tabular-nums text-on-surface">
                  {row.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
