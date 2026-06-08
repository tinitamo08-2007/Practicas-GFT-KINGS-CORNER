// ============================================================
// FUNCION: Crear 100 incidencias de prueba en Jira automaticamente.
// ============================================================

require('dotenv').config();

const DOMINIO  = process.env.JIRA_DOMINIO;
const EMAIL    = process.env.JIRA_EMAIL;
const TOKEN    = process.env.JIRA_API_TOKEN;
const PROYECTO = process.env.JIRA_PROJECT_KEY;

if (!DOMINIO || !EMAIL || !TOKEN || !PROYECTO) {
    console.error('Faltan variables de entorno de Jira. Revisa tu archivo .env');
    process.exit(1);
}

const JIRA_API_BASE    = `https://${DOMINIO}/rest/api/3`;
const URL_CREAR_TICKET = `${JIRA_API_BASE}/issue`;
const CABECERA_AUTH    = 'Basic ' + Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');

const incidencias = [
    // ── HARDWARE (25) ─────────────────────────────────────────
    { resumen: "PC del departamento de ventas no arranca", descripcion: "El ordenador del puesto V-12 no enciende al pulsar el boton de encendido. No hay ninguna luz ni sonido. Ocurre desde esta manana.", prioridad: "High", tipo: "Bug" },
    { resumen: "Pantalla azul recurrente en equipo de contabilidad", descripcion: "El ordenador de Ana Ruiz muestra BSOD varias veces al dia con el codigo 0x0000007E. Ocurrio tras la ultima actualizacion de Windows.", prioridad: "High", tipo: "Bug" },
    { resumen: "Impresora de planta 2 no imprime en color", descripcion: "La impresora HP Color LaserJet de la segunda planta imprime solo en blanco y negro aunque la opcion de color esta seleccionada.", prioridad: "Medium", tipo: "Task" },
    { resumen: "Monitor del puesto 7A con lineas horizontales", descripcion: "El monitor del puesto 7A muestra lineas horizontales de color verde en la parte inferior de la pantalla. Se ha probado con otro cable y persiste.", prioridad: "Medium", tipo: "Bug" },
    { resumen: "Bateria del portatil de direccion no carga", descripcion: "El portatil Dell XPS del director general no carga la bateria aunque este conectado a la corriente. La bateria se queda al 12%.", prioridad: "High", tipo: "Task" },
    { resumen: "Ventilador del servidor principal hace ruido", descripcion: "El servidor principal del rack A emite un ruido alto y constante. La temperatura del servidor ha subido 8 grados respecto a la semana pasada.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Disco duro con errores en el servidor de backups", descripcion: "El log del servidor de backups muestra errores de lectura en el disco D: con codigo SMART 05. Posible fallo inminente.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Raton inalambrico del puesto 3B no responde", descripcion: "El raton Logitech inalambrico del puesto 3B no se mueve aunque se cambiaron las pilas. El receptor USB funciona en otro equipo.", prioridad: "Low", tipo: "Task" },
    { resumen: "Proyector de sala de reuniones sin imagen", descripcion: "El proyector Epson de la sala principal no muestra imagen al conectarlo por HDMI. La lampara enciende pero la pantalla queda en negro.", prioridad: "Medium", tipo: "Bug" },
    { resumen: "Escaner no reconocido por el sistema", descripcion: "El escaner Canon de recepcion dejo de aparecer en los equipos del area tras reinstalar Windows. Se ha probado desconectando y reconectando.", prioridad: "Medium", tipo: "Task" },
    { resumen: "Camara web no funciona en videollamadas", descripcion: "La camara web integrada del portatil del departamento legal no aparece en Teams ni en Zoom. En el administrador de dispositivos aparece con un signo de exclamacion.", prioridad: "Medium", tipo: "Task" },
    { resumen: "Puerto USB del ordenador de recepcion no detecta dispositivos", descripcion: "Los puertos USB delanteros del PC de recepcion no detectan ningun dispositivo. Los traseros si funcionan.", prioridad: "Low", tipo: "Task" },
    { resumen: "PC se apaga solo despues de 15 minutos de uso", descripcion: "El ordenador del puesto de atencion al cliente se apaga sin aviso pasados unos 15 minutos. No hay mensaje de error previo al apagado.", prioridad: "High", tipo: "Bug" },
    { resumen: "Impresora de recepcion atascada con papel", descripcion: "La impresora de recepcion indica atasco de papel pero ya se retiro el papel visible. El error no desaparece al reiniciarla.", prioridad: "Medium", tipo: "Task" },
    { resumen: "SAI del servidor de archivos emitiendo alarma", descripcion: "El sistema de alimentacion ininterrumpida del servidor de archivos emite una alarma sonora continua. La bateria del SAI puede estar agotada.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Switch de la planta 3 parpadeando sin conectividad", descripcion: "El switch HP de la tercera planta tiene todos los puertos parpadeando en rojo. Ningun equipo de esa planta tiene conexion a red.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Auriculares con microfono sin sonido en llamadas", descripcion: "Los auriculares del agente de soporte no transmiten audio aunque esten bien conectados. El microfono no aparece como dispositivo en Windows.", prioridad: "Low", tipo: "Task" },
    { resumen: "Disco duro externo no aparece en el explorador", descripcion: "El disco duro externo Seagate de 2TB no aparece en el explorador de archivos al conectarlo. En administracion de discos si aparece pero sin letra de unidad.", prioridad: "Medium", tipo: "Task" },
    { resumen: "Teclado con varias teclas que no responden", descripcion: "El teclado del puesto 11C tiene las teclas F5, F6 y la tecla de mayusculas derecha sin respuesta. Se ha probado en otro ordenador y ocurre lo mismo.", prioridad: "Low", tipo: "Task" },
    { resumen: "Servidor de desarrollo con temperatura elevada", descripcion: "Las sondas de temperatura del servidor de desarrollo marcan 78 grados en la CPU. La temperatura normal es de 55 grados. Se ha limpiado el polvo.", prioridad: "High", tipo: "Bug" },
    { resumen: "Pantalla tactil del quiosco de entrada no responde", descripcion: "El quiosco de fichaje de la entrada principal no registra las pulsaciones en la pantalla tactil. Los empleados no pueden fichar.", prioridad: "High", tipo: "Bug" },
    { resumen: "Cable de red danado en el rack de planta 4", descripcion: "Un cable del rack de planta 4 esta visiblemente danado en la funda. Dos puestos de trabajo en esa planta tienen conexion intermitente.", prioridad: "Medium", tipo: "Task" },
    { resumen: "Router de backup no conmuta al fallar el principal", descripcion: "Tras simular un fallo del router principal, el router de backup no tomo el relevo automaticamente. La conmutacion debe ser inmediata segun el SLA.", prioridad: "High", tipo: "Bug" },
    { resumen: "Memoria RAM insuficiente en equipo del departamento grafico", descripcion: "El ordenador del departamento de diseno se queda sin memoria RAM al abrir Photoshop con varios archivos grandes. Tiene 8GB y necesita ampliacion.", prioridad: "Medium", tipo: "Task" },
    { resumen: "UPS sin bateria, servidor web sin proteccion ante cortes", descripcion: "El UPS que protege el servidor web muestra la bateria al 0% y no proporciona ninguna autonomia ante un corte de luz.", prioridad: "High", tipo: "Bug" },

    // ── SOFTWARE (25) ─────────────────────────────────────────
    { resumen: "Excel se cierra al abrir archivos con mas de 10000 filas", descripcion: "Microsoft Excel 365 se cierra de forma inesperada al intentar abrir archivos CSV con mas de 10000 filas. No aparece mensaje de error.", prioridad: "High", tipo: "Bug" },
    { resumen: "Aplicacion de nominas genera error al exportar a PDF", descripcion: "Al intentar exportar el informe mensual de nominas a PDF, la aplicacion SAGE muestra el error 'Object reference not set to an instance of an object'.", prioridad: "High", tipo: "Bug" },
    { resumen: "Antivirus bloqueando la aplicacion de gestion interna", descripcion: "El antivirus corporativo bloquea el ejecutable de la aplicacion de gestion interna desde la ultima actualizacion de firmas. La aplicacion no puede abrirse.", prioridad: "High", tipo: "Bug" },
    { resumen: "Outlook no sincroniza el calendario con el movil", descripcion: "Las citas creadas en Outlook en el ordenador no aparecen en el movil del usuario y viceversa. El problema ocurre desde hace tres dias.", prioridad: "Medium", tipo: "Bug" },
    { resumen: "Microsoft Teams no muestra notificaciones de mensajes", descripcion: "Varios usuarios reportan que Teams no muestra notificaciones cuando reciben mensajes directos ni menciones en canales.", prioridad: "Medium", tipo: "Bug" },
    { resumen: "SAP no carga el modulo de compras", descripcion: "Al intentar abrir el modulo de compras en SAP, la pantalla se queda en blanco despues de varios minutos. El resto de modulos funcionan correctamente.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Licencia de Adobe Creative Cloud expirada en equipo de marketing", descripcion: "El equipo de marketing no puede usar Illustrator ni Photoshop porque la licencia de Creative Cloud expiro. Hay trabajo urgente pendiente.", prioridad: "High", tipo: "Task" },
    { resumen: "Software de control de acceso no abre puertas de emergencia", descripcion: "El sistema de control de acceso no responde al comando de apertura de las puertas de emergencia del edificio B. Esto supone un riesgo de seguridad.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Aplicacion de facturacion no genera PDFs correctamente", descripcion: "Los PDFs generados por la aplicacion de facturacion tienen el logo de la empresa deformado y el numero de factura cortado en algunos modelos de impresora.", prioridad: "Medium", tipo: "Bug" },
    { resumen: "Dashboard de analisis no carga los graficos", descripcion: "El dashboard de Power BI integrado en el portal interno no muestra los graficos. La pantalla queda en blanco con el icono de carga girando indefinidamente.", prioridad: "High", tipo: "Bug" },
    { resumen: "Sistema de reserva de salas no disponible", descripcion: "La aplicacion web de reserva de salas devuelve error 503 desde las 10:00. Los empleados no pueden reservar ni ver la disponibilidad de salas.", prioridad: "High", tipo: "Bug" },
    { resumen: "Error en la sincronizacion del CRM con el ERP", descripcion: "Los pedidos creados en el CRM no se estan sincronizando con el ERP. El ultimo registro sincronizado es de hace 6 horas.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Generador de informes bloqueado por permisos insuficientes", descripcion: "Al intentar ejecutar el generador de informes mensual, el sistema indica 'Permiso denegado al directorio de exportacion'. Antes funcionaba correctamente.", prioridad: "Medium", tipo: "Bug" },
    { resumen: "Aplicacion de contabilidad con datos duplicados en cierre mensual", descripcion: "Al realizar el cierre mensual, la aplicacion de contabilidad esta duplicando algunos asientos. El jefe de contabilidad necesita solucion urgente.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Plugin de firma electronica no funciona en Chrome", descripcion: "El plugin de firma electronica para contratos solo funciona en Internet Explorer. En Chrome y Edge devuelve error de compatibilidad.", prioridad: "High", tipo: "Bug" },
    { resumen: "Sistema de tickets no envia emails de notificacion", descripcion: "Los tecnicos no reciben el email de notificacion cuando se les asigna un ticket. El servidor SMTP esta configurado correctamente segun los logs.", prioridad: "Medium", tipo: "Bug" },
    { resumen: "Actualizacion de Windows rompio el acceso a impresoras de red", descripcion: "Tras instalar la actualizacion KB5034441, los equipos que se actualizaron no pueden ver las impresoras de red. Los equipos sin actualizar si las ven.", prioridad: "High", tipo: "Bug" },
    { resumen: "VirtualBox no arranca maquinas virtuales tras actualizacion", descripcion: "Despues de actualizar VirtualBox a la version 7.1, las maquinas virtuales no arrancan y muestran el error 'VERR_NEM_VM_CREATE_FAILED'.", prioridad: "Medium", tipo: "Bug" },
    { resumen: "Correos importantes del dominio interno clasificados como spam", descripcion: "Los correos enviados entre cuentas del dominio empresa.com estan llegando a la carpeta de spam de los destinatarios desde ayer.", prioridad: "High", tipo: "Bug" },
    { resumen: "Aplicacion movil corporativa no sincroniza datos offline", descripcion: "La aplicacion movil del equipo comercial no sincroniza los datos capturados sin conexion cuando vuelve a tener internet.", prioridad: "Medium", tipo: "Bug" },
    { resumen: "Sistema de punto de venta no cierra el turno correctamente", descripcion: "Al intentar cerrar el turno en el TPV, el sistema se queda en estado de espera sin completar el cierre. Los datos del dia pueden perderse.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Solicitud de nueva licencia para herramienta de diseno", descripcion: "El departamento de marketing solicita una licencia adicional de Figma para el nuevo disenador que se incorpora la proxima semana.", prioridad: "Low", tipo: "Task" },
    { resumen: "Los logs del servidor de aplicaciones no se generan", descripcion: "El directorio de logs del servidor de aplicaciones lleva 4 dias sin nuevas entradas. Esto impide diagnosticar otros errores del sistema.", prioridad: "High", tipo: "Bug" },
    { resumen: "Error 500 en el portal de recursos humanos", descripcion: "El portal web de RRHH devuelve error 500 al intentar acceder al modulo de vacaciones. Afecta a todos los empleados que quieren solicitar dias libres.", prioridad: "High", tipo: "Bug" },
    { resumen: "Software de videoconferencia sin audio en salas equipadas", descripcion: "El sistema de videoconferencia de las salas A y B no transmite audio aunque los microfonos y altavoces esten encendidos y configurados.", prioridad: "Medium", tipo: "Bug" },

    // ── RED (25) ───────────────────────────────────────────────
    { resumen: "VPN corporativa no conecta desde teletrabajo", descripcion: "Multiples empleados en teletrabajo no pueden conectarse a la VPN corporativa. El error es 'TLS handshake failed'. Afecta a toda la plantilla remota.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Internet muy lento en toda la oficina central", descripcion: "La velocidad de internet en la oficina principal ha bajado de 1Gbps a menos de 10Mbps desde las 09:00. Afecta a todos los departamentos.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "WiFi de la sala de reuniones principal sin cobertura", descripcion: "La red WiFi corporativa no tiene cobertura en la sala de reuniones principal. El punto de acceso esta encendido pero no emite senal.", prioridad: "High", tipo: "Bug" },
    { resumen: "DNS no resuelve nombres de servidores internos", descripcion: "Los equipos no pueden resolver los nombres de los servidores internos. Las IPs directas si funcionan. El servidor DNS parece haber perdido las zonas internas.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Firewall bloqueando acceso a proveedor externo", descripcion: "El firewall esta bloqueando las conexiones salientes al proveedor de servicios de pago. Los clientes no pueden completar transacciones online.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Perdida de paquetes en la conexion con la sede de Barcelona", descripcion: "La conexion MPLS con la sede de Barcelona tiene una perdida de paquetes del 30%. Las videollamadas entre sedes son inutilizables.", prioridad: "High", tipo: "Bug" },
    { resumen: "Conflicto de IP duplicada en la red de produccion", descripcion: "Dos dispositivos tienen la misma IP en la red de produccion. Esto esta causando intermitencia en varios servicios criticos.", prioridad: "High", tipo: "Bug" },
    { resumen: "Servidor DHCP sin respuesta para nuevos equipos", descripcion: "Los equipos nuevos que se conectan a la red no reciben IP automaticamente. El servidor DHCP no responde a las solicitudes aunque el servicio esta activo.", prioridad: "High", tipo: "Bug" },
    { resumen: "Red de invitados con acceso a recursos internos", descripcion: "Los dispositivos conectados a la red WiFi de invitados pueden acceder a carpetas compartidas internas. Esto es un fallo de seguridad grave.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Latencia alta en llamadas VoIP entre sedes", descripcion: "Las llamadas internas entre la sede principal y la delegacion de Valencia tienen un retardo de mas de 500ms, haciendo la conversacion imposible.", prioridad: "High", tipo: "Bug" },
    { resumen: "Tunel VPN site-to-site con la sede de Londres caido", descripcion: "El tunel VPN IPSec entre la sede central y la oficina de Londres esta caido desde las 14:00. Los empleados de Londres no tienen acceso a los sistemas centrales.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Caida total de internet en la delegacion de Sevilla", descripcion: "La delegacion de Sevilla no tiene conexion a internet desde esta manana. El router de la delegacion esta encendido pero sin enlace WAN.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Proxy bloqueando descargas de actualizaciones de software", descripcion: "El servidor proxy esta bloqueando las descargas de actualizaciones de varios fabricantes de software. Los equipos no pueden actualizarse automaticamente.", prioridad: "Medium", tipo: "Task" },
    { resumen: "Segmento de red de produccion inaccesible desde desarrollo", descripcion: "Los desarrolladores no pueden conectarse a los servidores de pre-produccion. La ruta entre el segmento de desarrollo y produccion parece bloqueada.", prioridad: "High", tipo: "Bug" },
    { resumen: "Servidor NTP desincronizado afectando a los logs", descripcion: "El servidor NTP interno tiene la hora desfasada 45 minutos. Esto esta causando inconsistencias en los timestamps de todos los logs del sistema.", prioridad: "Medium", tipo: "Bug" },
    { resumen: "Ancho de banda saturado en horario de 10:00 a 12:00", descripcion: "El enlace de internet se satura completamente cada dia entre las 10:00 y las 12:00. Se sospecha que algun equipo esta descargando archivos grandes.", prioridad: "High", tipo: "Bug" },
    { resumen: "VLAN de desarrollo mezclada con VLAN de produccion", descripcion: "Tras una reconfiguracion del switch principal, trafico de la VLAN de desarrollo esta entrando en la VLAN de produccion. Riesgo de seguridad y estabilidad.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Servidor proxy caido, navegacion interrumpida", descripcion: "El servidor proxy ha dejado de responder. Todos los usuarios que necesitan el proxy para navegar no tienen acceso a internet.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Certificado SSL del servidor web expirado", descripcion: "El certificado SSL del portal web corporativo expiro ayer. Los navegadores muestran advertencia de seguridad y los clientes no pueden acceder.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Monitoreo de red sin datos desde hace 12 horas", descripcion: "La herramienta de monitoreo de red no muestra datos desde anoche. No se sabe si hay dispositivos caidos o con problemas en la red.", prioridad: "High", tipo: "Bug" },
    { resumen: "Acceso a servicios en nube bloqueado por politica de red", descripcion: "Los empleados no pueden acceder a OneDrive ni a SharePoint Online desde la red corporativa. Las mismas cuentas si funcionan desde redes externas.", prioridad: "High", tipo: "Task" },
    { resumen: "Intermitencia en la conexion de la red de almacenes", descripcion: "Los lectores de codigo de barras de los almacenes pierden la conexion a la red varias veces por hora. Esto retrasa el picking de pedidos.", prioridad: "High", tipo: "Bug" },
    { resumen: "Router de la cafeteria emitiendo red con el nombre de la red corporativa", descripcion: "Un router no autorizado en la cafeteria esta emitiendo una red WiFi con el mismo SSID que la red corporativa. Posible punto de acceso malicioso.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Impresoras de red sin visibilidad desde equipos Windows 11", descripcion: "Tras la actualizacion a Windows 11, los equipos actualizados no descubren las impresoras de red automaticamente. Las impresoras si se pueden anadir manualmente por IP.", prioridad: "Medium", tipo: "Task" },
    { resumen: "Balanceador de carga distribuyendo trafico de forma desigual", descripcion: "El balanceador de carga esta enviando el 90% del trafico a un solo servidor. Los otros dos servidores del cluster estan casi sin carga.", prioridad: "High", tipo: "Bug" },

    // ── ACCESOS (25) ──────────────────────────────────────────
    { resumen: "Usuario bloqueado tras intentos fallidos de inicio de sesion", descripcion: "La cuenta de usuario jgarcia@empresa.com esta bloqueada tras 10 intentos fallidos. El usuario dice no haber intentado entrar desde ayer.", prioridad: "Medium", tipo: "Task" },
    { resumen: "Contrasena expirada sin aviso previo al usuario", descripcion: "El usuario de facturacion no recibio ningun aviso de que su contrasena iba a expirar. Se quedo sin acceso en medio del cierre mensual.", prioridad: "High", tipo: "Bug" },
    { resumen: "Nuevo empleado sin acceso a los sistemas desde su primer dia", descripcion: "El nuevo empleado del departamento de IT que se incorporo hoy no tiene creada la cuenta en Active Directory ni acceso a ninguna aplicacion.", prioridad: "High", tipo: "Task" },
    { resumen: "Permisos incorrectos en el modulo de compras del ERP", descripcion: "El usuario mlopez@empresa.com puede aprobar ordenes de compra aunque su perfil no deberia tener ese permiso. Detectado en auditoria interna.", prioridad: "High", tipo: "Bug" },
    { resumen: "Cuenta de ex empleado con acceso activo al correo corporativo", descripcion: "La cuenta de correo de un empleado que causo baja hace tres semanas sigue activa y con acceso. El proceso de baja no desactivo la cuenta.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "MFA no llega al telefono del usuario", descripcion: "El codigo de doble factor de autenticacion no llega al movil del responsable financiero. Lleva tres dias sin poder acceder al portal bancario corporativo.", prioridad: "High", tipo: "Bug" },
    { resumen: "Acceso remoto de administrador sin registro de auditoria", descripcion: "Se ha detectado que las sesiones de administracion remota a los servidores no quedan registradas en el log de auditoria. Incumplimiento de politica de seguridad.", prioridad: "High", tipo: "Bug" },
    { resumen: "Grupo de seguridad mal configurado en Active Directory", descripcion: "El grupo de seguridad 'Contabilidad-Lectura' tiene permisos de escritura en los ficheros contables. Detectado tras revision de permisos.", prioridad: "High", tipo: "Bug" },
    { resumen: "Politica de contrasenas no aplicada a cuentas de servicio", descripcion: "Las cuentas de servicio no tienen configurada la politica de expiracion de contrasena. Algunas cuentas llevan mas de dos anos con la misma contrasena.", prioridad: "High", tipo: "Bug" },
    { resumen: "Tokens de API publicados en el repositorio de codigo", descripcion: "Se han encontrado tokens de API de servicios en produccion hardcodeados en el repositorio publico de GitHub. Es necesario revocarlos de inmediato.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Cuenta de administrador local habilitada en todos los PCs", descripcion: "La cuenta de administrador local esta habilitada con la contrasena por defecto en todos los equipos del parque. Riesgo de seguridad critico.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Usuario con sesion activa en servidor de produccion sin autorizar", descripcion: "Los logs muestran una sesion activa en el servidor de produccion con un usuario que no deberia tener acceso. La sesion lleva 6 horas abierta.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Certificado de cliente expirado bloquea acceso a la intranet", descripcion: "El certificado de cliente del equipo del director de operaciones ha expirado. No puede acceder a ninguna aplicacion de la intranet que requiera certificado.", prioridad: "High", tipo: "Task" },
    { resumen: "SSO no funciona con la aplicacion del proveedor externo", descripcion: "El inicio de sesion unico no funciona con la plataforma del proveedor de formacion. Los usuarios tienen que crear cuentas separadas y gestionar otra contrasena.", prioridad: "Medium", tipo: "Task" },
    { resumen: "Permisos de lectura en ficheros de nominas visibles por toda la empresa", descripcion: "La carpeta con los ficheros de nominas individuales es visible y accesible en modo lectura por todos los usuarios de la empresa. Fallo grave de privacidad.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Permisos de administrador concedidos sin proceso de aprobacion", descripcion: "Un usuario del departamento comercial tiene permisos de administrador local en su equipo. No hay solicitud ni aprobacion registrada.", prioridad: "Medium", tipo: "Bug" },
    { resumen: "No se puede acceder a la carpeta compartida del proyecto", descripcion: "Todo el equipo del proyecto Omega no puede acceder a la carpeta compartida del proyecto desde ayer por la tarde. Permisos posiblemente alterados.", prioridad: "High", tipo: "Task" },
    { resumen: "Cuenta de servicio deshabilitada por politica de inactividad", descripcion: "La cuenta de servicio que ejecuta el proceso de sincronizacion nocturna fue deshabilitada automaticamente por la politica de cuentas inactivas.", prioridad: "High", tipo: "Bug" },
    { resumen: "Usuario reporta inicio de sesion sospechoso desde otro pais", descripcion: "El usuario rmorales@empresa.com ha recibido un aviso de inicio de sesion desde una IP de un pais extranjero. El usuario confirma que no fue el.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Datos sensibles accesibles sin cifrado en servidor compartido", descripcion: "Se han encontrado ficheros con datos personales de clientes sin cifrar en una carpeta del servidor compartido accesible a varios departamentos.", prioridad: "Highest", tipo: "Bug" },
    { resumen: "Reset de contrasena urgente para acceso a sistema de produccion", descripcion: "El administrador del sistema de produccion no puede acceder porque olvido su contrasena y el proceso de recuperacion automatico no funciona.", prioridad: "High", tipo: "Task" },
    { resumen: "Acceso de proveedores externos sin control de tiempo", descripcion: "Los accesos VPN concedidos a proveedores externos para mantenimiento no tienen fecha de expiracion. Algunos llevan activos mas de seis meses.", prioridad: "High", tipo: "Bug" },
    { resumen: "Solicitud de acceso a sistema de RRHH para nuevo responsable", descripcion: "La nueva responsable de RRHH que se incorporo la semana pasada no tiene acceso al sistema de gestion de personal. Necesita acceso completo.", prioridad: "Medium", tipo: "Task" },
    { resumen: "Politica de bloqueo de pantalla no se aplica en portatiles", descripcion: "Los portatiles de la empresa no bloquean la pantalla automaticamente tras el tiempo de inactividad configurado. La politica de grupo parece no estar aplicandose.", prioridad: "Medium", tipo: "Bug" },
    { resumen: "Auditoria detecta accesos fuera de horario laboral", descripcion: "La revision del log de accesos muestra que tres cuentas de usuario han accedido a los sistemas entre las 02:00 y las 04:00 durante la ultima semana.", prioridad: "High", tipo: "Bug" }
];

async function crearTicketEnJira(incidencia) {
    const descripcionADF = {
        type: 'doc', version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: incidencia.descripcion }] }]
    };

    const cuerpo = {
        fields: {
            project:     { key: PROYECTO },
            summary:     incidencia.resumen,
            description: descripcionADF,
            issuetype:   { name: incidencia.tipo },
            priority:    { name: incidencia.prioridad }
        }
    };

    try {
        const respuesta = await fetch(URL_CREAR_TICKET, {
            method: 'POST',
            headers: {
                'Authorization': CABECERA_AUTH,
                'Content-Type':  'application/json',
                'Accept':        'application/json'
            },
            body: JSON.stringify(cuerpo)
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            console.error(`Error al crear "${incidencia.resumen}":`, JSON.stringify(datos.errors || datos));
            return null;
        }

        console.log(`Creado: ${datos.key} - ${incidencia.resumen}`);
        return datos.key;
    } catch (err) {
        console.error(`Excepcion al crear "${incidencia.resumen}":`, err.message);
        return null;
    }
}

async function poblarJira() {
    console.log(`Iniciando carga de ${incidencias.length} incidencias en Jira...`);
    console.log(`Proyecto: ${PROYECTO} | Dominio: ${DOMINIO}`);
    console.log('');

    let exitosos = 0;
    let fallidos = 0;

    for (let i = 0; i < incidencias.length; i++) {
        const resultado = await crearTicketEnJira(incidencias[i]);
        if (resultado) exitosos++; else fallidos++;
        // 700ms entre tickets para no superar el rate limit de Jira
        await new Promise(resolve => setTimeout(resolve, 700));
    }

    console.log('');
    console.log(`Proceso completado: ${exitosos} creados, ${fallidos} fallidos.`);
}

poblarJira().catch(err => {
    console.error('Error inesperado:', err);
    process.exit(1);
});