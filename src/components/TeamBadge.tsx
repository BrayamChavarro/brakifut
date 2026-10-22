/** Escudo del equipo.
 *
 * El plan gratuito no da imagenes de escudos y el prototipo apuntaba a URLs
 * temporales del generador (lh3.googleusercontent.com). En lugar de depender de
 * un asset externo, se usa la sigla de tres letras que si provee la API (tla),
 * con el nombre completo como texto alternativo accesible.
 */
export function TeamBadge({
  tla,
  name,
  size = "md",
}: {
  tla: string | null;
  name: string;
  size?: "sm" | "md";
}) {
  const label = (tla ?? name.slice(0, 3)).toUpperCase();
  const dimensions = size === "sm" ? "h-6 w-6 text-[9px]" : "h-7 w-7 text-[10px]";

  return (
    <span
      title={name}
      className={`grid ${dimensions} shrink-0 place-items-center rounded bg-surface-container-high font-bold tracking-tight text-on-surface-variant`}
    >
      {label}
    </span>
  );
}
