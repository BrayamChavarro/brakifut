# Guía Paso a Paso: Creación y Configuración de Máquina Virtual en Oracle Cloud Infrastructure (OCI)

**Autores:** Brayam Chavarro y Killian Rodriguez  
**Propósito:** Este manual detalla el proceso completo para aprovisionar una instancia de computo (*Compute Instance*) en Oracle Cloud, conectarse de manera segura a través de Cloud Shell utilizando claves SSH, y configurar un servidor web Nginx con su respectiva regla en el firewall.

---

## Índice de Contenidos
1. [Paso 1: Creación de la Instancia de Cómputo (Basic Information)](#paso-1-creación-de-la-instancia-de-cómputo-basic-information)
2. [Paso 2: Configuración de Recursos y Forma (Shape & Networking)](#paso-2-configuración-de-recursos-y-forma-shape--networking)
3. [Paso 3: Carga de Clave SSH en Cloud Shell](#paso-3-carga-de-clave-ssh-en-cloud-shell)
4. [Paso 4: Ajuste de Permisos del Archivo de Llave Privada](#paso-4-ajuste-de-permisos-del-archivo-de-llave-privada)
5. [Paso 5 y 6: Establecer Conexión SSH con la Instancia](#paso-5-y-6-establecer-conexión-ssh-con-la-instancia)
6. [Paso 7: Instalación del Servidor Web Nginx](#paso-7-instalación-del-servidor-web-nginx)
7. [Paso 8: Configuración del Firewall (Firewalld)](#paso-8-configuración-del-firewall-firewalld)

---

## Paso 1: Creación de la Instancia de Cómputo (Basic Information)

El primer paso consiste en acceder a la consola web de Oracle Cloud e iniciar sesión con las credenciales correspondientes. Una vez dentro, nos dirigimos al servicio de cómputo para crear una nueva instancia virtual.

* **Nombre de la instancia:** Se asigna un identificador único (en este caso, `BRAKI`).
* **Compartimiento (*Compartment*):** Se selecciona el compartimiento lógico donde se organizarán los recursos de infraestructura (por ejemplo, `Infraestructura_y_Cloud`).
* **Dominio de disponibilidad (*Availability Domain*):** Se determina la zona geográfica o centro de datos físico donde operará la máquina (ej. `AD 1` dentro de la región configurada).

![Creación de instancia - Información básica](https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/oracle/oracle.png)
*(Referencia visual del asistente de Oracle Cloud para la información básica de la máquina virtual).*

---

## Paso 2: Configuración de Recursos y Forma (Shape & Networking)

En esta etapa se definen las especificaciones de hardware y la capacidad de procesamiento de la máquina virtual.

* **Forma (*Shape*):** Se selecciona el modelo de procesador y arquitectura (ej. `VM.Standard.E3.Flex` con tecnología AMD).
* **Capacidad (*Shape Build*):** Se personalizan los recursos asignados, tales como 1 núcleo OCPU, 16 GB de memoria RAM y un ancho de banda de red predeterminado.
* **Redes (*Networking*):** Se configuran los parámetros de conectividad, subredes y asignación de direcciones IP públicas para permitir la comunicación remota.

---

## Paso 3: Carga de Clave SSH en Cloud Shell

Para administrar la máquina virtual de forma segura sin exponer contraseñas vulnerables, se utiliza autenticación por pares de llaves SSH. 

1. Abrimos el **Cloud Shell** integrado en la consola de Oracle Cloud.
2. Mediante la interfaz gráfica de la terminal en la nube, cargamos el archivo de la llave privada (`.key`) previamente generado o descargado.

---

## Paso 4: Ajuste de Permisos del Archivo de Llave Privada

Antes de utilizar la llave privada para establecer una conexión remota, los sistemas operativos basados en Unix/Linux exigen restricciones estrictas de seguridad sobre los permisos del archivo.

Ejecutamos el comando `ls` para verificar la presencia del archivo y seguidamente aplicamos permisos restrictivos de lectura exclusiva para el propietario mediante el comando `chmod 600`:

```bash
ls
chmod 600 ~/ssh-key-2026-10-16\(1\).key
```

---

## Paso 5 y 6: Establecer Conexión SSH con la Instancia

Una vez asegurada la llave, procedemos a realizar la conexión remota utilizando el comando `ssh` seguido de la ruta del archivo de clave y la dirección IP pública asignada a la instancia (`opc@<IP_PUBLICA>`).

```bash
ssh -i ~/ssh-key-2026-10-16\(1\).key opc@144.22.246.243
```

Al intentar conectar por primera vez, el sistema solicitará confirmar la autenticidad del host escribiendo `yes`. Tras esto, la conexión se establece de forma exitosa, cambiando el prompt de la terminal al usuario y nombre de la máquina (`[opc@braki ~]$`).

---

## Paso 7: Instalación del Servidor Web Nginx

Ya dentro de nuestra máquina virtual, actualizamos los repositorios e instalamos **Nginx**, un servidor web de alto rendimiento idóneo para alojar y publicar páginas web en internet.

Utilizamos el gestor de paquetes del sistema operativo ejecutando el siguiente comando:

```bash
sudo dnf install -y nginx
```

---

## Paso 8: Configuración del Firewall (Firewalld)

Para permitir que los usuarios externos puedan acceder a los servicios web alojados en el puerto HTTP estándar (`80`), debemos configurar de forma permanente el cortafuegos del sistema operativo (*firewalld*) y recargar las reglas activas:

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

Una vez ejecutados ambos comandos, el sistema devolverá el mensaje `success`, confirmando que el puerto se encuentra abierto y preparado para recibir tráfico web de manera permanente.

---

### Conclusión
Con estos pasos completados de manera secuencial, la máquina virtual se encuentra completamente creada, asegurada mediante llaves SSH, provista de un servidor web activo y con el tráfico HTTP habilitado a través del firewall.