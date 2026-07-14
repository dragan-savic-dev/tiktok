// Avviato una volta all'avvio del server Next. Fa partire il ciclo di raccolta
// snapshot in background (solo su runtime Node, non Edge).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startBackgroundCollection } = await import("./lib/background");
  startBackgroundCollection();
}
