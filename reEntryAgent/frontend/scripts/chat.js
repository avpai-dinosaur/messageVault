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

function appendAgentMessage(text, isToolMessage = false, toolHeader = null) {
    const wrap = document.getElementById('chat-messages');
    const name = profile?.name?.split(' ')[0] || 'Agent';
    const msg = document.createElement('div');
    msg.className = 'msg agent';
    const defaultLabel = `${escHtml(name)}'s Advocate`;
    const resolvedToolHeader = toolHeader == null ? "Unknown Tool" : escHtml(toolHeader);

    if (isToolMessage) {
        msg.innerHTML = 
            `<div class="msg-label">
                <button type="button" class="tool-toggle"></button>
                ${resolvedToolHeader}
            </div>
            <div class="msg-bubble"></div>`;
    } else {
        msg.innerHTML = 
            `<div class="msg-label">${defaultLabel}</div>
            <div class="msg-bubble"></div>`;
    }

    msg.querySelector('.msg-bubble').innerHTML = marked.parse(text);

    if (isToolMessage) {
        const toggle = msg.querySelector('.tool-toggle');
        const bubble = msg.querySelector('.msg-bubble');
        let isExpanded = false;
        toggle.addEventListener('click', () => {
            isExpanded = !isExpanded;
            toggle.textContent = isExpanded ? '▾' : '▸';
            bubble.style.display = isExpanded ? '' : 'none';
        });
        toggle.textContent = '▸';
        bubble.style.display = 'none';
    }

    wrap.appendChild(msg);
    wrap.scrollTop = wrap.scrollHeight;
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

function extractEventSummary(event) {
    const lines = [];
    const parts = event?.content?.parts;
    let isToolMessage = false;
    let toolHeader = null;
    if (Array.isArray(parts)) {
        for (const part of parts) {
            if (part?.functionCall) {
                isToolMessage = true;
                const functionName = part.functionCall.name || 'unknown_function';
                toolHeader = `Calling ${functionName}`;
                lines.push(`### ${toolHeader}`);
                for (const [arg_name, arg_val] of Object.entries(part.functionCall.args || {})) {
                    lines.push(`- **${arg_name}**: ${JSON.stringify(arg_val)}`);
                }
            }
            else if (part?.functionResponse) {
                isToolMessage = true;
                const functionName = part.functionResponse.name || 'unknown_function';
                toolHeader = `${functionName} Response`;
                lines.push(`### ${toolHeader}`);
                for (const [resp_name, resp_val] of Object.entries(part.functionResponse.response || {})) {
                    lines.push(`- **${resp_name}**: ${JSON.stringify(resp_val)}`);
                }
            }
            else if (part?.text) {
                lines.push(part.text.trim());
            }
        }
    }
    return [lines.join('\n'), isToolMessage, toolHeader];
}

function isArtifactUpdateEvent(event) {
  const artifactDelta = event?.actions?.artifactDelta;
  return artifactDelta != null
    && typeof artifactDelta === 'object'
    && Object.prototype.hasOwnProperty.call(artifactDelta, ARTIFACT_NAME);
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
    const res = await fetch(`${API_BASE}/run`, {
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

    hideTyping();

    const payload = await res.json();
    console.debug('run payload:', payload);
    let isPlanUpdated = false;
    for (const event of payload){
        const [summary, isToolMessage, toolHeader] = extractEventSummary(event);
        appendAgentMessage(summary, isToolMessage, toolHeader);
        isPlanUpdated = isPlanUpdated || isArtifactUpdateEvent(event);
    }

    if (isPlanUpdated) {
      await loadPlan();
      showToast('Plan updated ✓');
    }
  } catch (e) {
    hideTyping();
    console.error('Run request error:', e);
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
