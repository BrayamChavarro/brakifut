# syntax=docker/dockerfile:1

# Imagen base: Debian (glibc), NO Alpine (musl).
# Motivo concreto: sharp y el motor de Tailwind v4 (@tailwindcss/oxide)
# distribuyen binarios nativos precompilados. La variante glibc es la que
# Node.js prueba y documenta; con musl aparecen fallos de enlace intermitentes.
#
# Node 24 es OBLIGATORIO: la persistencia usa `node:sqlite`, que no existe en
# versiones anteriores y que en Node 22 todavia exigia --experimental-sqlite.

# ---------------------------------------------------------------------------
# Etapa 1 — Dependencias
# ---------------------------------------------------------------------------
# Se separa del build para aprovechar la cache de capas: mientras
# package-lock.json no cambie, `npm ci` no se vuelve a ejecutar.
#
# El package-lock.json se genero en Windows, pero incluye las entradas de
# TODAS las plataformas para las dependencias opcionales nativas
# (@img/sharp-linux-x64, @img/sharp-linux-arm64, @tailwindcss/oxide-linux-*,
# lightningcss-*). Por eso `npm ci` resuelve bien los binarios de Linux aca.
FROM node:24-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# Etapa 2 — Build
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Genera .next/standalone (ver `output` en next.config.ts): solo el servidor y
# las dependencias que realmente usa en ejecucion.
RUN npm run build

# ---------------------------------------------------------------------------
# Etapa 3 — Runtime
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DB_FILE=/app/data/pitchpulse.db

# Usuario sin privilegios. El proceso no necesita root para nada.
# /app/data se crea aca y con este dueno: cuando Docker inicializa el volumen
# nombrado la primera vez, hereda estos permisos. Si se omitiera el chown, el
# contenedor no podria escribir la base y fallaria al primer arranque.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --home-dir /app --shell /usr/sbin/nologin nextjs \
 && mkdir -p /app/data \
 && chown -R nextjs:nodejs /app

# El output standalone ya trae node_modules recortado y server.js.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# NOTA: este proyecto no tiene carpeta public/. Si en el futuro se agrega una,
# hay que descomentar la linea siguiente, porque Docker falla si la ruta no
# existe y no se puede copiar condicionalmente.
# COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node","-e","fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
