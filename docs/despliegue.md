# Despliegue en Oracle Cloud

Este documento describe el despliegue **real y verificado** del MVP, no un plan.
Las decisiones que siguen salen de inspeccionar el servidor, no de suponerlo.

## Datos del servidor

| Dato | Valor | Como se obtuvo |
| --- | --- | --- |
| IP publica | `144.22.246.243` | provisto |
| Usuario | `opc` (sudo sin password) | verificado |
| Llave | `~/Downloads/ssh-key-2026-10-16(1).key` | verificada |
| Sistema | Oracle Linux Server **9.8** | `cat /etc/oracle-release` |
| Arquitectura | **x86_64** (no ARM) | `uname -m` |
| Kernel | `6.12.0-206.104.4.4.el9uek.x86_64` | `uname -r` |
| CPU / RAM | 2 vCPU / 15.5 GB | `nproc`, `free -m` |
| Disco | 30 GB, ~19 GB libres | `df -h /` |
| Nginx | **1.20.1 ya instalado y activo en :80** | `rpm -qa`, `ss -tlnp` |
| Docker | **no instalado**, ausente de los repos de Oracle | `dnf list --available` |
| firewalld | activo, servicios `http` y `ssh` abiertos | `firewall-cmd --list-all` |
| SELinux | **Enforcing**, `httpd_can_network_connect` en **off** | `getenforce`, `getsebool` |

Corrección respecto de la version anterior de este documento: decia "Ubuntu 24.04 ARM"
y "PostgreSQL + worker". Nada de eso aplicaba. El servidor es Oracle Linux x86_64 y la
persistencia del MVP es SQLite en un archivo, sin worker y sin base de datos servida.

## Arquitectura

```
Internet :80
    |
    v
Nginx del HOST  (/etc/nginx/conf.d/pitchpulse.conf)
    |  proxy_pass http://127.0.0.1:3000
    v
Contenedor pitchpulse  (Next.js 16, modo standalone, node:24-bookworm-slim)
    |
    v
Volumen Docker  pitchpulse-data  ->  /app/data/pitchpulse.db   (SQLite + WAL)
```

### Por que Nginx NO va en un contenedor

El servidor ya tenia Nginx 1.20.1 instalado, activo y ocupando el puerto 80
(`ss -tlnp` lo confirma). Un Nginx en contenedor chocaria por el puerto y no aportaria
nada. El proxy inverso es el del host; el archivo vive en `deploy/nginx-pitchpulse.conf`
y lo instala `deploy/provision.sh`.

### Por que el contenedor publica solo en 127.0.0.1

Docker escribe reglas de iptables que **no pasan por firewalld**. Un `3000:3000` quedaria
expuesto a Internet aunque firewalld dijera que no. Publicando `127.0.0.1:3000:3000`, el
unico proceso que puede entrar es el Nginx del host. Efecto lateral util: si un
`firewall-cmd --reload` llega a limpiar las reglas de Docker, la aplicacion no queda
expuesta en ningun momento.

## Topologia: donde va cada cosa

- **Frontend y backend son el mismo proceso.** En el App Router de Next.js, `/api/*` son
  Route Handlers que corren dentro del mismo servidor Node que renderiza las paginas. No
  existe un backend separado al que "redirigir `/api/`". Nginx manda todo al mismo destino.
- **No hay archivos estaticos que servir con `root`.** Las paginas son `force-dynamic` y
  leen SQLite en cada peticion: `next build` produce un **servidor**, no un puñado de HTML.
  Por eso Nginx no tiene directiva `root`: hace proxy, no sirve archivos.
- **No hay migraciones.** El esquema es idempotente (`CREATE TABLE IF NOT EXISTS`) y se
  aplica al abrir la base. No hay ORM ni carpeta de migraciones.
- **No hay worker.** El MVP no publica resultados en vivo, asi que no hay polling.

## Despliegue

Desde tu maquina (Git Bash o WSL — **no** en el CMD clasico), en la raiz del proyecto:

```bash
bash deploy.sh
```

El script hace, en orden:

1. Verifica `ssh`, que la llave exista y que estes en la raiz del proyecto.
2. Se conecta y reporta host, SO, arquitectura y si hay nginx.
3. Sincroniza el codigo con `rsync` (o `tar` por SSH si no hay rsync).
4. Corre `deploy/provision.sh` en el servidor (idempotente).
5. Construye la imagen **en el servidor** y levanta el stack.
6. Espera a `/api/health` y muestra los logs si no responde.
7. Verifica `http://144.22.246.243/` desde afuera, o sea el camino completo.

Modos: `bash deploy.sh --provision` (solo preparar el servidor),
`bash deploy.sh --no-build` (reiniciar con la imagen actual).

Sobreescribir configuracion sin editar el script:

```bash
SSH_KEY=/ruta/a/otra.key HOST=1.2.3.4 bash deploy.sh
```

### Por que la imagen se construye en el servidor

El build de Next traza binarios nativos (`sharp`, `@tailwindcss/oxide`). Un artefacto
generado en Windows x64 apunta a `sharp-win32-x64` y no arranca en Linux: se comprobo
leyendo el contenido de `.next/standalone/node_modules/@img`. Construir en el destino
garantiza la arquitectura correcta y evita montar un registro de imagenes. El costo es que
el servidor necesita salida a npm y a Docker Hub, ya verificado.

El `package-lock.json` se genero en Windows pero incluye las entradas de **todas** las
plataformas (`sharp-linux-x64`, `sharp-linux-arm64`, `oxide-linux-*-gnu`, `lightningcss-*`),
asi que `npm ci` resuelve los binarios de Linux dentro del contenedor.

## Las cuatro trampas de este servidor

Ya resueltas en el codigo, pero conviene saberlas porque son las que hacen perder horas.

### 1. Los dos firewalls de OCI

Filtrar pasa por **dos** capas y hay que abrir el puerto en ambas:

1. **Security List / NSG de la VCN** (nivel red, consola de OCI).
2. **firewalld del host** (`firewall-cmd`).

Sintoma clasico: la app responde por `curl localhost` en el servidor pero no desde afuera.
Casi siempre es alguna de las dos capas.

### 2. SELinux bloquea Nginx -> contenedor

`httpd_can_network_connect` estaba en **off**. Con SELinux en Enforcing, Nginx **no puede**
abrir conexiones de red salientes: al proxear devuelve **502** aunque el contenedor este
perfecto. Se activa asi (y `provision.sh` lo hace solo, de forma persistente):

```bash
sudo setsebool -P httpd_can_network_connect 1
```

Ese `-P` es importante: sin el, el cambio se pierde al reiniciar.

### 3. `$releasever` no es "9"

En Oracle Linux, `$releasever` vale **"9.8"**. El repositorio de Docker CE publica bajo
`.../linux/centos/9/...`, asi que un repo con `$releasever` haria que dnf pida
`.../centos/9.8/...` y reciba **404**. Por eso `provision.sh` escribe la `baseurl` con el
**9 fijo**. Verificado: ese endpoint responde 200 y el `9.8` no existe.

Ademas, `docker-engine` **no esta** en los repos de Oracle (`ol9_addons`): la busqueda
devuelve "No matching Packages to list". Por eso se instala Docker CE del repositorio
oficial.

### 4. Docker y firewalld se pelean

Docker inserta reglas propias en iptables; `firewall-cmd --reload` puede limpiarlas y dejar
el puerto publicado inaccesible hasta reiniciar Docker. Como aca publicamos **solo en
loopback**, esto no expone nada, pero puede cortar el camino Nginx -> contenedor. Si despues
de un `--reload` la web da 502:

```bash
sudo systemctl restart docker
sudo docker compose -f /opt/pitchpulse/docker-compose.yml up -d
```

## Operacion

```bash
# Logs en vivo
ssh -i ~/Downloads/ssh-key-2026-10-16\(1\).key opc@144.22.246.243 \
  "cd /opt/pitchpulse && sudo docker compose logs -f app"

# Estado
ssh -i ~/Downloads/ssh-key-2026-10-16\(1\).key opc@144.22.246.243 \
  "cd /opt/pitchpulse && sudo docker compose ps"

# Reiniciar
ssh -i ~/Downloads/ssh-key-2026-10-16\(1\).key opc@144.22.246.243 \
  "cd /opt/pitchpulse && sudo docker compose restart"
```

### Backup de la base

La base vive en un volumen Docker y corre en **modo WAL**: ademas de `pitchpulse.db` existen
`pitchpulse.db-wal` y `pitchpulse.db-shm`. **Copiar solo el `.db` con `cp` puede darte una
base desactualizada**, porque parte de los datos todavia esta en el `-wal`.

Correcto:

```bash
sudo docker exec pitchpulse sh -c 'command -v sqlite3 >/dev/null && echo hay-sqlite3 || echo no-hay-sqlite3'
# Si no hay sqlite3 en la imagen, se copia en caliente y se valida:
sudo docker run --rm -v pitchpulse_pitchpulse-data:/data -v /tmp:/backup alpine \
  sh -c 'cp /data/pitchpulse.db* /backup/ && ls -la /backup'
```

La forma robusta, si el proyecto crece, es `sqlite3 pitchpulse.db ".backup /tmp/copia.db"`,
que hace un backup consistente con la base en uso.

### Actualizar

```bash
bash deploy.sh          # reconstruye la imagen y recrea el contenedor
```

El volumen no se toca: el historial sobrevive al redespliegue.

## Lo que falta

- **HTTPS.** Requiere dos cosas que hoy no estan: abrir el **puerto 443** en la Security
  List de OCI *y* en firewalld, y tener un **dominio** apuntando a la IP. Let's Encrypt no
  emite certificados para direcciones IP, asi que sin dominio no hay TLS valido. Con ambos
  resueltos, el cambio es agregar un `server { listen 443 ssl; }` en
  `deploy/nginx-pitchpulse.conf` y correr `certbot --nginx`.
- **Rotacion de la base.** SQLite crece sin limite. Para este alcance no es un problema.
- **Un solo proceso escritor.** SQLite con WAL admite muchas lecturas pero **una** escritura
  a la vez. Si algun dia se escala el contenedor horizontalmente, hay que migrar a
  PostgreSQL. Todo el SQL esta contenido en `src/infrastructure/db/repository.ts`, asi que
  el cambio esta acotado a esa carpeta.
