// Diccionario Español (España, es-ES): clave = texto inglés (fuente), valor = español.
// Mismas claves que `it`; si falta una clave, se muestra el inglés (fallback natural).

export const es: Record<string, string> = {
  // --- Navegación / chrome ---
  Overview: "Resumen",
  Growth: "Crecimiento",
  Videos: "Vídeos",
  Analytics: "Analíticas",
  Dashboard: "Panel",
  "Log out": "Cerrar sesión",
  Profile: "Perfil",
  "Open menu": "Abrir menú",
  "Close menu": "Cerrar menú",

  // --- Indicador en directo ---
  LIVE: "EN VIVO",
  RETRYING: "REINTENTANDO",
  "Auto-refresh every 5 seconds": "Actualización automática cada 5 segundos",

  // --- Botón de instalación ---
  "Install the app": "Instalar la app",
  Install: "Instalar",
  Share: "Compartir",
  "“Add to Home Screen”": "“Añadir a pantalla de inicio”",
  "To install the app: tap": "Para instalar la app: toca",
  "and then": "y luego",

  // --- Botón de sincronización ---
  Sync: "Sincronizar",
  "Syncing…": "Sincronizando…",
  "to DB": "en la BD",
  "already up to date": "ya actualizado",
  "sync error": "error de sincronización",
  "Sync to the database the snapshots saved on this device":
    "Sincroniza en la base de datos las instantáneas guardadas en este dispositivo",

  // --- Carga / errores ---
  "Loading your stats…": "Cargando tus estadísticas…",
  "Loading the video…": "Cargando el vídeo…",
  "Loading history…": "Cargando el historial…",
  "Update error:": "Error de actualización:",
  "retrying in 5 seconds.": "reintentando en 5 segundos.",
  "N/A": "N/D",

  // --- Landing ---
  "Sign in with your TikTok account and watch followers, views, likes, comments and shares across all your videos update in real time, every 5 seconds.":
    "Inicia sesión con tu cuenta de TikTok y observa cómo los seguidores, las visualizaciones, los me gusta, los comentarios y los compartidos de todos tus vídeos se actualizan en tiempo real, cada 5 segundos.",
  "Continue with TikTok": "Continuar con TikTok",
  "No data is stored: access tokens live in httpOnly cookies and stats in a temporary in-memory cache.":
    "No se almacena ningún dato: los tokens de acceso viven en cookies httpOnly y las estadísticas en una caché temporal en memoria.",
  "You denied access on TikTok.": "Has denegado el acceso en TikTok.",
  "Security check failed: try again.": "La verificación de seguridad ha fallado: inténtalo de nuevo.",
  "Couldn’t complete sign-in: try again.":
    "No se pudo completar el inicio de sesión: inténtalo de nuevo.",
  "Your session expired: sign in again.": "Tu sesión ha caducado: inicia sesión de nuevo.",
  "An error occurred: try again.": "Se ha producido un error: inténtalo de nuevo.",

  // --- Métricas comunes ---
  Views: "Visualizaciones",
  Viewers: "Espectadores",
  Likes: "Me gusta",
  Comments: "Comentarios",
  Shares: "Compartidos",
  Saves: "Guardados",
  Interactions: "Interacciones",
  Engagement: "Interacción",
  Following: "Siguiendo",
  Followers: "Seguidores",

  // --- Resumen ---
  "Interaction breakdown": "Desglose de interacciones",
  "Totals across all videos": "Totales de todos los vídeos",
  "Sum across": "Suma de",
  "public videos · updated every 5 seconds · “saves” are read from the public pages about once a minute (N/A if TikTok blocks them).":
    "vídeos públicos · actualizado cada 5 segundos · los “guardados” se leen de las páginas públicas aproximadamente una vez por minuto (N/D si TikTok los bloquea).",
  "Avg view / video": "Media de visualizaciones / vídeo",
  "Avg like / video": "Media de me gusta / vídeo",
  "Avg share rate": "Tasa de compartidos media",
  "Public videos": "Vídeos públicos",
  "Latest videos": "Últimos vídeos",
  "See all": "Ver todos",
  "No public videos found.": "No se encontraron vídeos públicos.",
  "Best video": "Mejor vídeo",
  "Top by share rate": "Top por tasa de compartidos",
  Details: "Detalles",

  // --- Lista de vídeos ---
  "All videos": "Todos los vídeos",
  "Export the video list as CSV": "Exportar la lista de vídeos como CSV",
  Page: "Página",
  of: "de",
  "← Prev": "← Ant.",
  "Next →": "Sig. →",

  // --- Detalle del vídeo ---
  "Video not found.": "Vídeo no encontrado.",
  "← All videos": "← Todos los vídeos",
  "Saves updated.": "Guardados actualizados.",
  "Scraping failed, try again shortly.": "El scraping ha fallado, inténtalo de nuevo en breve.",
  "Error during scraping": "Error durante el scraping",
  "by views": "por visualizaciones",
  "Published on": "Publicado el",
  Duration: "Duración",
  "Open on TikTok": "Abrir en TikTok",
  "Close the player": "Cerrar el reproductor",
  "Play the video": "Reproducir el vídeo",
  "Reread this video's saves now from the public page (scraping)":
    "Volver a leer ahora los guardados de este vídeo desde la página pública (scraping)",
  "Refreshing saves…": "Actualizando guardados…",
  "Refresh saves (scraping)": "Actualizar guardados (scraping)",
  "Intensity · per 1,000 views": "Intensidad · por cada 1,000 visualizaciones",
  "Available once the video reaches 1,000 views.":
    "Disponible cuando el vídeo alcanza las 1,000 visualizaciones.",
  Missing: "Faltan",
  "views to reach 1,000.": "visualizaciones para llegar a 1,000.",
  "Compared to profile average": "Comparado con la media del perfil",
  This: "Este",
  Average: "Media",
  "Current counters updated every 5 seconds. The trend over time is reconstructed from the snapshots the site records (the TikTok API does not expose it per individual video); it populates gradually.":
    "Contadores actuales actualizados cada 5 segundos. La tendencia a lo largo del tiempo se reconstruye a partir de las instantáneas que registra el sitio (la API de TikTok no la expone por vídeo individual); se rellena poco a poco.",
  "Trend over time": "Tendencia a lo largo del tiempo",
  "Configure the database to record this video's trend over time.":
    "Configura la base de datos para registrar la tendencia a lo largo del tiempo de este vídeo.",
  "Collecting data: the curve appears after a few readings (one snapshot every ~5 minutes while the video is active).":
    "Recopilando datos: la curva aparece tras algunas lecturas (una instantánea cada ~5 minutos mientras el vídeo está activo).",
  "Speed · last hour": "Velocidad · última hora",
  "views in the last hour": "visualizaciones en la última hora",
  "Current share rate": "Tasa de compartidos actual",
  "shares / views": "compartidos / visualizaciones",
  "Views over time": "Visualizaciones a lo largo del tiempo",
  "Share rate over time": "Tasa de compartidos a lo largo del tiempo",

  // --- Crecimiento ---
  today: "hoy",
  "7 days": "7 días",
  "30 days": "30 días",
  "90 days": "90 días",
  "120 days": "120 días",
  "Network error": "Error de red",
  "Real trend over time: snapshots are saved in your browser while you use the app.":
    "Tendencia real a lo largo del tiempo: las instantáneas se guardan en tu navegador mientras usas la app.",
  Total: "Total",
  "Change/hour": "Cambio/hora",
  "Change/day": "Cambio/día",
  "Export history as CSV": "Exportar el historial como CSV",
  "Can’t read history:": "No se puede leer el historial:",
  "At the pace of the last 7 days (": "Al ritmo de los últimos 7 días (",
  "/day) you’ll reach": "/día) alcanzarás",
  "followers in about": "seguidores en aproximadamente",
  "days.": "días.",
  "Followers gained": "Seguidores ganados",
  "Follower growth": "Crecimiento de seguidores",
  publications: "publicaciones",
  "Likes over time": "Me gusta a lo largo del tiempo",
  "Saves over time": "Guardados a lo largo del tiempo",
  "Collecting data. Statistics are saved in your browser (and on the server) while you use the app, one snapshot per minute: at least two different moments are needed to track growth.":
    "Recopilando datos. Las estadísticas se guardan en tu navegador (y en el servidor) mientras usas la app, una instantánea por minuto: se necesitan al menos dos momentos diferentes para seguir el crecimiento.",
  "snapshots so far — come back later.": "instantáneas hasta ahora — vuelve más tarde.",
  "Leave the dashboard open and come back later.":
    "Deja el panel abierto y vuelve más tarde.",

  // --- Analíticas ---
  "Saves / 1,000": "Guardados / 1,000",
  "Views · last": "Visualizaciones · últimos",
  "Interactions · last": "Interacciones · últimos",
  videos: "vídeos",
  "Average views by publish day": "Media de visualizaciones por día de publicación",
  "Average views by time slot": "Media de visualizaciones por franja horaria",
  "When to post · day × hour heatmap": "Cuándo publicar · mapa de calor día × hora",
  "Average views by duration": "Media de visualizaciones por duración",
  "No videos available.": "No hay vídeos disponibles.",
  "These charts capture the current state of each video. For the trend over time (daily growth, peaks) see the Growth section.":
    "Estos gráficos reflejan el estado actual de cada vídeo. Para la tendencia a lo largo del tiempo (crecimiento diario, picos) consulta la sección Crecimiento.",
  "avg views": "media de visualizaciones",
  Mon: "Lun",
  Tue: "Mar",
  Wed: "Mié",
  Thu: "Jue",
  Fri: "Vie",
  Sat: "Sáb",
  Sun: "Dom",
  "Total interactions": "Interacciones totales",
  "Best video (views)": "Mejor vídeo (visualizaciones)",
  "Views from top 10": "Visualizaciones del top 10",
  "how much of the views comes from the 10 best videos":
    "qué parte de las visualizaciones proviene de los 10 mejores vídeos",
};
