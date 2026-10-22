#!/usr/bin/env bash
#
# provision.sh — preparacion del servidor. Se ejecuta EN EL SERVIDOR, con sudo.
#
#   sudo bash /opt/pitchpulse/deploy/provision.sh
#
# Es idempotente: se puede correr todas las veces que haga falta. Cada paso
# comprueba primero si ya esta hecho.
#
# Contexto verificado de este servidor (Oracle Cloud, Oracle Linux 9.8 x86_64):
#   - Docker NO esta instalado y NO existe en los repos de Oracle (ol9_addons
#     no tiene docker-engine). Se instala Docker CE del repo oficial.
#   - $releasever en Oracle Linux es "9.8". El repo de Docker CE publica bajo
#     "9", asi que si se dejara $releasever dnf pediria .../centos/9.8/... y
#     recibe 404. Por eso la baseurl queda FIJADA en 9.
#   - SELinux esta en Enforcing y httpd_can_network_connect esta en OFF. Sin
#     activarlo, Nginx no puede conectarse al contenedor y devuelve 502.
#   - Nginx ya esta instalado y activo en el puerto 80.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/pitchpulse}"
NGINX_CONF_DIR="/etc/nginx/conf.d"
NGINX_CONF="${NGINX_CONF_DIR}/pitchpulse.conf"
DOCKER_REPO="/etc/yum.repos.d/docker-ce.repo"

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[1;32m[ok]\033[0m %s\n' "$*"; }
warn() { printf '    \033[1;33m[aviso]\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

[[ ${EUID} -eq 0 ]] || die "Este script necesita root. Correlo con: sudo bash $0"

# ---------------------------------------------------------------------------
log "1/6  Docker Engine"
# ---------------------------------------------------------------------------
if command -v docker >/dev/null 2>&1; then
    ok "ya instalado: $(docker --version)"
else
    if [[ ! -f "${DOCKER_REPO}" ]]; then
        # baseurl con el 9 fijo, a proposito: ver nota de $releasever arriba.
        cat > "${DOCKER_REPO}" <<'REPO'
[docker-ce-stable]
name=Docker CE Stable - $basearch
baseurl=https://download.docker.com/linux/centos/9/$basearch/stable
enabled=1
gpgcheck=1
gpgkey=https://download.docker.com/linux/centos/gpg
REPO
        ok "repo de Docker CE agregado (releasever fijado en 9)"
    fi

    dnf -y install \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin
    ok "Docker CE instalado"
fi

systemctl enable --now docker
ok "servicio docker habilitado y corriendo: $(docker --version)"

docker compose version >/dev/null 2>&1 \
    || die "falta el plugin 'docker compose'. Instala docker-compose-plugin."
ok "plugin de compose: $(docker compose version --short 2>/dev/null || echo presente)"

# El usuario humano entra al grupo docker para poder usarlo sin sudo en
# sesiones nuevas. Los despliegues igual usan sudo, asi que no dependen de esto.
if id -nG opc 2>/dev/null | grep -qw docker; then
    ok "el usuario opc ya pertenece al grupo docker"
else
    usermod -aG docker opc 2>/dev/null && ok "usuario opc agregado al grupo docker (requiere re-login para tener efecto)" \
        || warn "no se pudo agregar opc al grupo docker"
fi

# ---------------------------------------------------------------------------
log "2/6  SELinux (el paso que rompe Nginx si se olvida)"
# ---------------------------------------------------------------------------
if [[ "$(getenforce)" == "Enforcing" ]]; then
    if [[ "$(getsebool httpd_can_network_connect)" == *"on"* ]]; then
        ok "httpd_can_network_connect ya esta en on"
    else
        setsebool -P httpd_can_network_connect 1
        ok "httpd_can_network_connect activado de forma PERSISTENTE"
        warn "sin esto Nginx responderia 502 al proxear al contenedor"
    fi
else
    ok "SELinux no esta en Enforcing ($(getenforce)); no hace falta el booleano"
fi

# ---------------------------------------------------------------------------
log "3/6  Nginx del host"
# ---------------------------------------------------------------------------
command -v nginx >/dev/null 2>&1 || die "nginx no esta instalado en el host"

[[ -f "${APP_DIR}/deploy/nginx-pitchpulse.conf" ]] \
    || die "no encuentro ${APP_DIR}/deploy/nginx-pitchpulse.conf. Sincroniza el codigo primero."

# Se normalizan los finales de linea: el repo viaja desde Windows y un CRLF
# suelto en una config de nginx o en un script rompe de formas confusas.
sed -i 's/\r$//' "${APP_DIR}/deploy/nginx-pitchpulse.conf"

install -m 644 "${APP_DIR}/deploy/nginx-pitchpulse.conf" "${NGINX_CONF}"

if nginx -t 2>/dev/null; then
    ok "configuracion de nginx valida"
else
    die "nginx -t fallo. Revisa la config con: nginx -t"
fi

systemctl enable nginx >/dev/null 2>&1 || true
systemctl reload nginx 2>/dev/null || systemctl restart nginx
ok "nginx recargado y escuchando en el puerto 80"

# ---------------------------------------------------------------------------
log "4/6  Firewall"
# ---------------------------------------------------------------------------
# A nivel firewalld el 80 ya estaba abierto (servicio http). Se asegura de forma
# idempotente: agregar un servicio ya presente no hace nada.
if systemctl is-active --quiet firewalld; then
    firewall-cmd --permanent --add-service=http >/dev/null
    firewall-cmd --reload >/dev/null
    ok "firewalld: servicios abiertos -> $(firewall-cmd --list-services)"
    warn "recorda que ademas hace falta la regla en la Security List / NSG de la VCN de OCI"
else
    ok "firewalld no esta activo"
fi

# ---------------------------------------------------------------------------
log "5/6  Directorio de la aplicacion y variables de entorno"
# ---------------------------------------------------------------------------
mkdir -p "${APP_DIR}"
ok "directorio ${APP_DIR} listo"

ENV_FILE="${APP_DIR}/.env.production"
if [[ -f "${ENV_FILE}" ]]; then
    ok "${ENV_FILE} ya existe (no se toca)"
else
    if [[ -f "${APP_DIR}/env.production.example" ]]; then
        cp "${APP_DIR}/env.production.example" "${ENV_FILE}"
        chmod 600 "${ENV_FILE}"
        warn "se creo ${ENV_FILE} desde la plantilla"
        warn "REVISALO: por defecto usa FOOTBALL_PROVIDER=seed (datos de demostracion)"
    else
        die "no encuentro env.production.example y no hay .env.production previo"
    fi
fi
chmod 600 "${ENV_FILE}" 2>/dev/null || true

# ---------------------------------------------------------------------------
log "6/6  Resumen"
# ---------------------------------------------------------------------------
printf '    Docker      : %s\n' "$(docker --version)"
printf '    Compose     : %s\n' "$(docker compose version --short 2>/dev/null || echo n/d)"
printf '    SELinux     : %s (httpd_can_network_connect=%s)\n' "$(getenforce)" "$(getsebool httpd_can_network_connect | awk '{print $3}')"
printf '    Nginx       : %s\n' "${NGINX_CONF}"
printf '    App dir     : %s\n' "${APP_DIR}"
printf '    Env         : %s\n' "${ENV_FILE}"
printf '\n\033[1;32mServidor provisionado.\033[0m Siguiente paso: construir y levantar el stack.\n'
