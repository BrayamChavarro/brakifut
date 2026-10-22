/**
 * Construccion de query strings.
 *
 * Los enlaces de la UI tienen que preservar los filtros activos al cambiar
 * uno solo (por ejemplo: cambiar de fecha sin perder la competicion elegida).
 * Centralizarlo evita el clasico bug de perder filtros al navegar.
 */
export type QueryValue = string | number | boolean | null | undefined;

export function buildQuery(
  params: Record<string, QueryValue>,
  base?: Record<string, QueryValue>,
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries({ ...base, ...params })) {
    if (value === null || value === undefined || value === "" || value === false) {
      continue;
    }
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}
