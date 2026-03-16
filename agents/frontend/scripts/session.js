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
