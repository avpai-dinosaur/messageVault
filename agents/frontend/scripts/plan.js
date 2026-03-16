function initMDE() {
  mde = new EasyMDE({
    element: document.getElementById('plan-editor'),
    spellChecker: false,
    autosave: { enabled: false },
    toolbar: [
      'bold',
      'italic',
      'heading',
      '|',
      'unordered-list',
      'ordered-list',
      '|',
      'preview',
      'side-by-side',
      'fullscreen',
    ],
    placeholder: 'No reentry plan yet. Reentry plan will appear here once generated...',
    status: false,
    minHeight: '100px',
  });
  document.getElementById('plan-editor').style.display = 'none';
}

async function loadPlan() {
  if (!sessionId) return;
  try {
    const res = await fetch(
      `${API_BASE}/apps/${APP_NAME}/users/${USER_ID}/sessions/${sessionId}/artifacts/${ARTIFACT_NAME}`
    );
    if (!res.ok) return;
    const data = await res.json();

    const content = data?.inlineData?.data ? atob(data.inlineData.data) : null;
    if (content && content.trim()) setPlanContent(content);
  } catch {
    // No plan yet.
  }
}

function setPlanContent(markdown) {
  if (!mde) return;
  document.querySelector('.EasyMDEContainer').style.display = '';
  mde.value(markdown);
  planLoaded = true;
}

async function savePlan() {
  if (!mde || !planLoaded || !sessionId) return;
  try {
    const content = mde.value();
    const b64 = btoa(unescape(encodeURIComponent(content)));
    const res = await fetch(
      `${API_BASE}/apps/${APP_NAME}/users/${USER_ID}/sessions/${sessionId}/artifacts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: ARTIFACT_NAME,
          artifact: { inlineData: { data: b64, mimeType: 'text/markdown' } },
        }),
      }
    );
    if (!res.ok) throw new Error();
    showToast('Plan saved ✓');
  } catch {
    showToast('Save failed - please try again');
  }
}

async function refreshPlan() {
  await loadPlan();
  showToast('Plan refreshed');
}
