#!/usr/bin/env bash
#
# deploy.sh — despliegue desde tu maquina local hacia el servidor de OCI.
#
# Uso:
#   bash deploy.sh                 # despliegue completo
#   bash deploy.sh --provision     # solo re-provisionar el servidor
#   bash deploy.sh --no-build      # solo reiniciar con la imagen actual
#
# Se ejecuta desde Git Bash o WSL (en Windows). NO funciona en el CMD clasico.
#
# Configuracion: se puede sobreescribir con variables de entorno.
#   HOST=... SSH_USER=... SSH_KEY=... REMOTE_DIR=... bash deploy.sh
#
# Por que se construye la imagen EN EL SERVIDOR y no aca:
#   El build de Next traza binarios nativos (sharp, @tailwindcss/oxide). Un
#   artefacto generado en Windows x64 apunta a sharp-win32-x64 y no arranca en
#   Linux. Construir en el destino garantiza la arquitectura correcta y evita
#   la necesidad de un registro de imagenes. El costo es que el servidor
#   necesita acceso a npm y a Docker Hub, que ya se verifico que tiene.

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuracion
# ---------------------------------------------------------------------------
HOST="${HOST:-144.22.246.243}"
SSH_USER="${SSH_USER:-opc}"
SSH_KEY="${SSH_KEY:-$HOME/Downloads/ssh-key-2026-10-16(1).key}"
REMOTE_DIR="${REMOTE_DIR:-/opt/pitchpulse}"
APP_PORT="${APP_PORT:-3000}"

SSH_OPTS=(
    -i "${SSH_KEY}"
    -o StrictHostKeyChecking=accept-new
    -o ConnectTimeout=15
    -o BatchMode=yes
    -o ServerAliveInterval=15
)

# Archivos que NO se sincronizan: se reconstruyen en el servidor o son secretos.
SYNC_EXCLUDES=(
    "node_modules"
    ".next"
    ".git"
    ".turbo"
    "data"
    "*.db"
    "*.db-wal"
    "*.db-shm"
    ".env"
    ".env.production"
    ".env.local"
    ".DS_Store"
)

MODE="full"
for arg in "$@"; do
    case "${arg}" in
        --provision) MODE="provision" ;;
        --no-build)  MODE="nobuild" ;;
        -h|--help)   sed -n '2,20p' "$0"; exit 0 ;;
        *)           printf 'Opcion desconocida: %s\n' "${arg}" >&2; exit 2 ;;
    esac
done

# ---------------------------------------------------------------------------
# Salida
# ---------------------------------------------------------------------------
step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[1;32m[ok]\033[0m %s\n' "$*"; }
warn() { printf '    \033[1;33m[aviso]\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

remote() {
    ssh "${SSH_OPTS[@]}" "${SSH_USER}@${HOST}" "$@"
}

# ---------------------------------------------------------------------------
step "1/7  Prerrequisitos locales"
# ---------------------------------------------------------------------------
command -v ssh >/dev/null 2>&1 || die "no encuentro 'ssh' en el PATH."

if [[ ! -f "${SSH_KEY}" ]]; then
    die "no encuentro la llave SSH en: ${SSH_KEY}
    Podes indicar otra ruta:  SSH_KEY=/ruta/a/llave.key bash deploy.sh"
fi
ok "llave SSH: ${SSH_KEY}"

# OpenSSH rechaza llaves con permisos abiertos. En Git Bash chmod aplica al
# sistema de archivos emulado, asi que alcanza para callar el aviso.
chmod 600 "${SSH_KEY}" 2>/dev/null || true

HAS_RSYNC=0
command -v rsync >/dev/null 2>&1 && HAS_RSYNC=1
if [[ ${HAS_RSYNC} -eq 1 ]]; then
    ok "rsync disponible (transferencia incremental)"
else
    warn "rsync no esta disponible; se usa tar por SSH (funciona igual, sin borrado de archivos eliminados)"
fi

[[ -f package.json ]] || die "corre este script desde la raiz del proyecto."
ok "raiz del proyecto: $(pwd)"

# ---------------------------------------------------------------------------
step "2/7  Conexion y verificacion del servidor"
# ---------------------------------------------------------------------------
SERVER_INFO="$(remote 'printf "%s|%s|%s|%s" "$(hostname)" "$(uname -m)" "$(. /etc/os-release && echo "$PRETTY_NAME")" "$(command -v nginx || echo sin-nginx)"' 2>/dev/null)" \
    || die "no pude conectarme a ${SSH_USER}@${HOST}. Revisa IP, usuario y llave."

IFS='|' read -r R_HOST R_ARCH R_OS R_NGINX <<< "${SERVER_INFO}"
ok "host: ${R_HOST}"
ok "SO:   ${R_OS}  (${R_ARCH})"
ok "nginx: ${R_NGINX}"
[[ "${R_NGINX}" == "sin-nginx" ]] && die "el servidor no tiene nginx instalado."

# ---------------------------------------------------------------------------
step "3/7  Sincronizacion del codigo"
# ---------------------------------------------------------------------------
remote "mkdir -p '${REMOTE_DIR}'"

if [[ ${HAS_RSYNC} -eq 1 ]]; then
    RSYNC_EXCLUDES=()
    for item in "${SYNC_EXCLUDES[@]}"; do
        RSYNC_EXCLUDES+=(--exclude "${item}")
    done
    # --delete mantiene el servidor espejado: si borras un archivo aca, se borra alla.
    rsync -az --delete \
        "${RSYNC_EXCLUDES[@]}" \
        --exclude 'deploy.sh' \
        -e "ssh ${SSH_OPTS[*]}" \
        ./ "${SSH_USER}@${HOST}:${REMOTE_DIR}/"
    ok "codigo sincronizado con rsync"
else
    # Alternativa sin rsync: empaquetar respetando las mismas exclusiones.
    TAR_EXCLUDES=()
    for item in "${SYNC_EXCLUDES[@]}"; do
        TAR_EXCLUDES+=(--exclude="./${item}")
    done
    TAR_EXCLUDES+=(--exclude="./deploy.sh")

    tar czf - "${TAR_EXCLUDES[@]}" . | remote "tar xzf - -C '${REMOTE_DIR}'"
    ok "codigo transferido con tar sobre SSH"
fi

# Normaliza finales de linea: el repo viene de Windows y un CRLF suelto en un
# script bash lo rompe con un error de interprete dificil de leer.
remote "find '${REMOTE_DIR}/deploy' -type f \( -name '*.sh' -o -name '*.conf' \) -exec sed -i 's/\r\$//' {} +"
ok "finales de linea normalizados"

# ---------------------------------------------------------------------------
step "4/7  Provisionamiento del servidor (idempotente)"
# ---------------------------------------------------------------------------
remote "sudo bash '${REMOTE_DIR}/deploy/provision.sh'"

if [[ "${MODE}" == "provision" ]]; then
    step "Listo (solo provisionamiento)"
    exit 0
fi

# ---------------------------------------------------------------------------
step "5/7  Construccion de la imagen y arranque"
# ---------------------------------------------------------------------------
if [[ "${MODE}" == "nobuild" ]]; then
    warn "se omite la construccion (--no-build)"
    remote "cd '${REMOTE_DIR}' && sudo docker compose up -d --remove-orphans"
else
    # --pull trae la base actualizada; el build ocurre en el servidor para que
    # los binarios nativos correspondan a su arquitectura (x86_64).
    remote "cd '${REMOTE_DIR}' && sudo docker compose build --pull"
    remote "cd '${REMOTE_DIR}' && sudo docker compose up -d --remove-orphans"
fi
ok "contenedores levantados"

remote "cd '${REMOTE_DIR}' && sudo docker compose ps"
remote "cd '${REMOTE_DIR}' && sudo docker image prune -f >/dev/null 2>&1 || true"

# ---------------------------------------------------------------------------
step "6/7  Verificacion: la aplicacion responde"
# ---------------------------------------------------------------------------
# Se le da margen: en el primer arranque la base se siembra desde cero.
HEALTH_INTERNAL=""
for attempt in $(seq 1 30); do
    HEALTH_INTERNAL="$(remote "curl -sS --max-time 10 http://127.0.0.1:${APP_PORT}/api/health" 2>/dev/null || true)"
    if [[ "${HEALTH_INTERNAL}" == *'"status":"ok"'* ]]; then
        break
    fi
    printf '    esperando al contenedor... (%s/30)\r' "${attempt}"
    sleep 2
done
printf '%*s\r' 45 ''

if [[ "${HEALTH_INTERNAL}" == *'"status":"ok"'* ]]; then
    ok "contenedor sano (127.0.0.1:${APP_PORT}):"
    printf '        %s\n' "${HEALTH_INTERNAL}"
else
    warn "el contenedor no reporta salud. Ultimos logs:"
    remote "cd '${REMOTE_DIR}' && sudo docker compose logs --tail=40 app" || true
    die "despliegue sin confirmar. Revisa los logs de arriba."
fi

# Verificacion del camino completo: Internet -> nginx -> contenedor.
step "7/7  Verificacion del camino publico"
if command -v curl >/dev/null 2>&1; then
    PUBLIC_CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "http://${HOST}/" || echo "000")"
    if [[ "${PUBLIC_CODE}" == "200" ]]; then
        ok "http://${HOST}/ responde 200 (nginx -> contenedor)"
    else
        warn "http://${HOST}/ devolvio ${PUBLIC_CODE}"
        warn "si es 502, revisa el booleano de SELinux: getsebool httpd_can_network_connect"
        warn "si es 000, revisa la Security List de OCI y el firewalld del host"
        exit 1
    fi

    HEALTH_CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "http://${HOST}/api/health" || echo "000")"
    ok "http://${HOST}/api/health -> ${HEALTH_CODE}"
else
    warn "no hay curl local; se omite la verificacion publica"
fi

printf '\n\033[1;32mDespliegue completado.\033[0m\n'
printf '    Sitio       : http://%s/\n' "${HOST}"
printf '    Salud       : http://%s/api/health\n' "${HOST}"
printf '    API         : http://%s/api/matches?estado=finished\n' "${HOST}"
printf '    Logs        : ssh -i "%s" %s@%s "cd %s && sudo docker compose logs -f app"\n' "${SSH_KEY}" "${SSH_USER}" "${HOST}" "${REMOTE_DIR}"
