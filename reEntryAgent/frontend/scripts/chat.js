function appendWelcomeMessage() {
  const name = profile?.name?.split(' ')[0] || 'your loved one';
  appendAgentMessage(
    `Hello. I'm here to help you support ${name} through their reentry process. ` +
    'You can ask me about their plan, search for resources, or ask me to update any section.'
  );
}

function appendUserMessage(text) {
  const wrap = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.className = 'msg user';
  msg.innerHTML = `<div class="msg-label">You</div><div class="msg-bubble"><p>${escHtml(text)}</p></div>`;
  wrap.appendChild(msg);
  wrap.scrollTop = wrap.scrollHeight;
}

function appendAgentMessage(text) {
  const wrap = document.getElementById('chat-messages');
  const name = profile?.name?.split(' ')[0] || 'Agent';
  const msg = document.createElement('div');
  msg.className = 'msg agent';
  msg.innerHTML = `<div class="msg-label">${escHtml(name)}'s Advocate</div><div class="msg-bubble"></div>`;
  msg.querySelector('.msg-bubble').innerHTML = marked.parse(text);
  wrap.appendChild(msg);
  wrap.scrollTop = wrap.scrollHeight;
  return msg;
}

function showTyping() {
  const wrap = document.getElementById('chat-messages');
  const el = document.createElement('div');
  el.className = 'msg agent';
  el.id = 'typing-indicator';
  el.innerHTML = '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
  wrap.appendChild(el);
  wrap.scrollTop = wrap.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !sessionId) return;
  input.value = '';
  autoResize(input);

  appendUserMessage(text);
  showTyping();

  try {
    const res = await fetch(`${API_BASE}/run_sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appName: APP_NAME,
        userId: USER_ID,
        sessionId,
        newMessage: {
          role: 'user',
          parts: [{ text }],
        },
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let agentText = '';
    let planWasUpdated = false;

    hideTyping();
    const agentMsgEl = appendAgentMessage('...');
    const bubble = agentMsgEl.querySelector('.msg-bubble');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop();

      for (const part of parts) {
        const dataLine = part.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        const json = dataLine.slice(5).trim();
        if (!json || json === '[DONE]') continue;

        let event;
        try {
          event = JSON.parse(json);
        } catch {
          continue;
        }

        if (event.content?.parts) {
          for (const p of event.content.parts) {
            if (p.text) agentText += p.text;
          }
          bubble.innerHTML = marked.parse(agentText || '...');
          agentMsgEl.scrollIntoView({ block: 'end' });
        }

        if (event.actions?.artifactDelta || event.actions?.artifact_delta) {
          planWasUpdated = true;
        }
      }
    }

    bubble.innerHTML = marked.parse(agentText || '(no response)');

    if (planWasUpdated) {
      await loadPlan();
      showToast('Plan updated ✓');
    }
  } catch (e) {
    hideTyping();
    console.error('SSE error:', e);
    appendAgentMessage('Sorry, something went wrong. Please try again.');
  }
}

function handleChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
}
