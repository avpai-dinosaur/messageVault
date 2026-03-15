function switchMode(mode) {
  currentMode = mode;
  document.getElementById('document-mode').style.display = mode === 'document' ? 'flex' : 'none';
  document.getElementById('voice-mode').style.display = mode === 'voice' ? 'flex' : 'none';
  document.getElementById('btn-doc-mode').classList.toggle('active', mode === 'document');
  document.getElementById('btn-voice-mode').classList.toggle('active', mode === 'voice');
}
