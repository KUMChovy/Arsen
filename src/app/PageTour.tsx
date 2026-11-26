import { ProductTour } from './ProductTour'

const guides = {
  workout: [
    { key: 'workout-header', title: 'Entreno de hoy', text: 'Cambia la rutina o el día desde el botón junto al título.' },
    { key: 'workout-exercise', title: 'Ejercicio actual', text: 'Usa las flechas para elegir el ejercicio y revisa sus indicaciones y series.' },
    { key: 'workout-exercise', title: 'Referencia y opciones', text: 'Consulta el descanso, las series registradas y la referencia anterior. El menú del ejercicio ofrece más acciones.' },
    { key: 'workout-header', title: 'Sesiones pendientes', text: 'Si dejaste una sesión abierta, puedes retomarla desde el aviso correspondiente.' },
    { key: 'entreno', title: 'Registra tus series', text: 'El botón central abre el registro del ejercicio seleccionado. Al completar los ejercicios puedes decidir cuándo cerrar la sesión.' },
  ],
  routine: [
    { key: 'routine-header', title: 'Tu rutina', text: 'Crea, importa o exporta una rutina; también puedes elegir, duplicar o eliminar las existentes. El historial se conserva.' },
    { key: 'routine-mode-view', mode: 'view', title: 'Vista Ver', text: 'Cuando crees una rutina, consulta sus días, abre sus ejercicios y revisa su historial aquí.' },
    { key: 'routine-mode-view', mode: 'view', title: 'Días y sesiones', text: 'Abre un día para consultar sus ejercicios e iniciar el entrenamiento; usa el historial para revisar sesiones anteriores.' },
    { key: 'routine-mode-edit', mode: 'edit', title: 'Vista Editar', text: 'Con una rutina creada, cambia su nombre y organiza días; agrega, mueve, duplica, ordena o quita ejercicios y ajusta sus indicaciones.' },
    { key: 'routine-mode-edit', mode: 'edit', title: 'Organiza tus días', text: 'Crea y renombra días, asigna un día de la semana si quieres y cambia su orden. Puedes duplicarlos o eliminarlos.' },
    { key: 'routine-mode-edit', mode: 'edit', title: 'Configura ejercicios', text: 'Para cada día puedes elegir ejercicios del catálogo y ajustar series, repeticiones, descanso, equipo y notas.' },
    { key: 'routine-mode-catalog', mode: 'catalog', title: 'Vista Catálogo', text: 'Busca, crea y edita ejercicios de tu catálogo personal. Quitarlos del catálogo no borra las rutinas existentes.' },
    { key: 'routine-mode-catalog', mode: 'catalog', title: 'Sinful Shell', text: 'Explora fichas por nombre, alias o músculo, revisa imágenes e indicaciones y agrega una copia a tu catálogo personal.' },
    { key: 'routine-header', mode: 'view', title: 'Crear una rutina', text: 'El asistente te guía para elegir nombre, días y ejercicios. Puedes agregar más o cambiar la rutina después.' },
  ],
  routineDay: [
    { key: 'page-header', title: 'Detalle del día', text: 'Consulta los ejercicios de este día y sus indicaciones.' },
    { key: 'page-header', title: 'Iniciar entrenamiento', text: 'Cuando el día tenga ejercicios, puedes comenzar desde esta pantalla.' },
    { key: 'rutina', title: 'Volver a rutina', text: 'Regresa para elegir otro día o seguir organizando la rutina.' },
  ],
  progress: [
    { key: 'page-header', title: 'Tu progreso', text: 'Explora tus registros y cambia de vista para revisar ejercicios o tendencias.' },
    { key: 'page-header', title: 'Filtros y exportación', text: 'Elige un periodo y filtra por rutina, día o ejercicio. Los botones CSV y JSON exportan los datos según esos filtros.' },
    { key: 'page-header', title: 'Tendencias y registros', text: 'Cambia entre las vistas disponibles para explorar tus datos y abre un ejercicio para ver su detalle.' },
    { key: 'progreso', title: 'Detalle por ejercicio', text: 'Abre un ejercicio para consultar su evolución y sus registros.' },
  ],
  exercise: [
    { key: 'page-header', title: 'Evolución del ejercicio', text: 'Consulta los registros y gráficas disponibles para este ejercicio.' },
    { key: 'progreso', title: 'Más ejercicios', text: 'Regresa a Progreso para elegir otro ejercicio.' },
  ],
  history: [
    { key: 'page-header', title: 'Tu historial', text: 'Revisa sesiones anteriores y filtra por periodo, rutina, día o ejercicio.' },
    { key: 'page-header', title: 'Encuentra un registro', text: 'Combina filtros para reducir la lista o límpialos para volver a ver todo.' },
    { key: 'page-header', title: 'Editar registros', text: 'Abre la sesión para revisar sus series y las opciones de edición disponibles.' },
    { key: 'historial', title: 'Consulta un registro', text: 'Abre una fecha o sesión para ver sus detalles.' },
  ],
  historyDate: [
    { key: 'page-header', title: 'Historial por fecha', text: 'Consulta los registros de la fecha seleccionada y abre una sesión para ver más detalles.' },
  ],
  session: [
    { key: 'page-header', title: 'Detalle de sesión', text: 'Consulta los ejercicios y series guardados en esta sesión.' },
    { key: 'historial', title: 'Volver al historial', text: 'Regresa para consultar otra fecha o sesión.' },
  ],
  settings: [
    { key: 'page-header', title: 'Ajustes', text: 'Abre cada categoría para explorar sus opciones. Puedes volver a esta ayuda cuando quieras.' },
    { key: 'settings-datos', title: 'Datos', text: 'Abre Cuenta y respaldo, exporta un archivo o importa uno. Fusionar agrega datos; reemplazar sustituye los datos locales tras confirmarlo.' },
    { key: 'settings-datos', title: 'Unidades y equipo', text: 'Elige la unidad de peso, configura los discos disponibles y exporta tu progreso desde Datos.' },
    { key: 'settings-salud', title: 'Salud opcional', text: 'Activa o desactiva la conexión de salud y revisa sus permisos. La integración es opcional.' },
    { key: 'settings-rutinas', title: 'Rutinas', text: 'Ve a la gestión de rutinas o importa una rutina desde un archivo JSON.' },
    { key: 'settings-deload', title: 'Deload', text: 'Programa un periodo de descarga, ajusta sus porcentajes y revisa sus avisos.' },
    { key: 'settings-deload', title: 'Administrar la descarga', text: 'Puedes iniciarla, programarla, posponer una sugerencia o finalizarla. Guarda los cambios en series y peso cuando quieras.' },
    { key: 'settings-notifications', title: 'Notificaciones', text: 'Configura los avisos de la app y revisa el permiso de Android. La campana reúne las alertas y el historial de esta semana.' },
    { key: 'settings-storage', title: 'Almacenamiento', text: 'Consulta el uso local y la protección disponible para los datos guardados en el dispositivo.' },
    { key: 'settings-storage', title: 'Protección local', text: 'Revisa cuántas rutinas, sesiones y series ocupan espacio y solicita almacenamiento persistente si está disponible.' },
    { key: 'settings-cleanup', title: 'Zona de limpieza', text: 'Revisa las opciones para limpiar datos. Las acciones que eliminan información requieren confirmación.' },
  ],
  account: [
    { key: 'account-header', title: 'Cuenta y respaldos', text: 'Inicia sesión para acceder a las opciones de cuenta y copias.' },
    { key: 'account-backups', title: 'Administra tus copias', text: 'Desde esta pantalla puedes preparar un respaldo o revisar las versiones disponibles.' },
    { key: 'account-backups', title: 'Respaldo automático', text: 'Revisa la configuración y el estado del respaldo automático de este dispositivo, si está disponible.' },
    { key: 'account-backups', title: 'Restaurar datos', text: 'Revisa la copia antes de confirmar una restauración; esta acción reemplaza los datos locales de este dispositivo.' },
  ],
} as const
export type PageTourKey = keyof typeof guides

export function pageTourForPath(path: string): PageTourKey | null {
  if (path === '/') return 'workout'
  if (path === '/rutina') return 'routine'
  if (/^\/rutina\/dia\/[^/]+\/?$/.test(path)) return 'routineDay'
  if (path === '/progreso') return 'progress'
  if (/^\/progreso\/ejercicio\/[^/]+\/?$/.test(path)) return 'exercise'
  if (path === '/historial') return 'history'
  if (/^\/(?:progreso\/historial|historial)\/sesion\/[^/]+\/?$/.test(path)) return 'session'
  if (/^\/progreso\/historial\/[^/]+\/?$/.test(path)) return 'historyDate'
  if (path === '/settings') return 'settings'
  if (path === '/cuenta') return 'account'
  return null
}

export function PageTour({ page, onFinish, error = false }: { page: PageTourKey; onFinish: () => void; error?: boolean }) {
  const emptyWorkout = page === 'workout' && Boolean(document.querySelector('[data-tour="workout-empty"]'))
  const steps = emptyWorkout ? [
    { key: 'workout-header', title: 'Entreno de hoy', text: 'Aquí consultarás y registrarás tu entrenamiento cuando tengas una rutina.' },
    { key: 'workout-empty', title: 'Crea tu primera rutina', text: 'Abre Rutina para elegir tus días y ejercicios con el asistente. Después podrás volver a Entreno.' },
    { key: 'entreno', title: 'Registra tus series', text: 'Cuando elijas un ejercicio, el botón central abre su registro de series.' },
  ] : guides[page]
  return <ProductTour steps={steps} onFinish={onFinish} error={error} scrollToTarget />
}
