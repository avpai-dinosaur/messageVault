async function loadProfile() {
  try {
    const res = await fetch(`${API_BASE}/api/profile`);
    if (!res.ok) throw new Error();
    profile = await res.json();
  } catch {
    profile = { name: 'Unknown', id: 'unknown', facility: '' };
  }

  const initials = profile.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  document.getElementById('profile-chip').style.display = 'flex';
  document.getElementById('profile-avatar').textContent = initials;
  document.getElementById('profile-name-label').textContent = profile.name;
  document.getElementById('plan-subtitle').textContent = profile.facility
    ? `${profile.name} · ${profile.facility}`
    : profile.name;
  document.getElementById('voice-full-name').textContent = profile.name;
  document.getElementById('voice-avatar-initials').textContent = initials;
}

async function ensureSession() {
  try {
    const res = await fetch(`${API_BASE}/apps/${APP_NAME}/users/${USER_ID}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) throw new Error(`Session creation failed: ${res.status}`);
    const data = await res.json();
    sessionId = data.id;
  } catch (e) {
    console.error('Failed to create ADK session:', e);
    showToast('Could not connect to agent - is the server running?');
  }
}
