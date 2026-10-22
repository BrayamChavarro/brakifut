/**
 * Iconos de Material Symbols.
 *
 * Se centraliza en un componente por dos razones: se declara una sola vez
 * `aria-hidden` (son decorativos, el texto de al lado ya comunica) y la clase
 * `material-symbols-outlined` queda literal en el codigo, que es lo que
 * necesita el escaner de clases para no purgarla.
 */
export function MaterialIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className ?? ""}`}>
      {name}
    </span>
  );
}
