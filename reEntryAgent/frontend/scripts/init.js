async function init() {
  await loadProfile();
  await ensureSession();
  initMDE();
  await loadPlan();
  buildWaveform();
}

init();
