import { MaterialIcon } from "./MaterialIcon";

/**
 * Buscador.
 *
 * Es un <form method="get"> real, no un input manejado con JavaScript. Ventaja:
 * funciona sin JS, es accesible por teclado, y la URL queda compartible
 * (/buscar?q=river). La validacion y el estado vacio los resuelve el servidor.
 */
export function SearchForm({
  defaultValue = "",
  id,
}: {
  defaultValue?: string;
  id?: string;
}) {
  return (
    <form
      action="/buscar"
      method="get"
      role="search"
      className="relative flex items-center"
    >
      <label htmlFor={id ?? "search"} className="sr-only">
        Buscar equipos, competiciones o partidos
      </label>
      <MaterialIcon
        name="search"
        className="pointer-events-none absolute left-2 text-[18px] text-on-surface-variant"
      />
      <input
        id={id ?? "search"}
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoComplete="off"
        placeholder="Buscar equipos, competiciones, estadios..."
        className="w-full rounded-lg bg-surface-container-low py-1.5 pl-9 pr-3 text-body-sm text-on-surface shadow-inner outline-none transition-colors placeholder:text-on-surface-variant/60 focus:bg-surface-container focus:ring-1 focus:ring-primary-container/50"
      />
    </form>
  );
}
