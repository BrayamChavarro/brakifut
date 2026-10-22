import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" genera .next/standalone con solo los archivos y dependencias
  // que el servidor necesita en ejecucion. Es lo que permite que la imagen de
  // Docker no instale devDependencies. No afecta a `next dev` ni a `next start`.
  output: "standalone",
  // cacheComponents (el nuevo modelo de PPR) queda desactivado a proposito:
  // obliga a envolver toda lectura de datos en <Suspense> y a adoptar "use cache".
  // El MVP lee SQLite local directamente; activarlo solo agrega modo de falla.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
