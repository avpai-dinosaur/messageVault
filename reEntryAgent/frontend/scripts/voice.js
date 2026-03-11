function buildWaveform() {
  const wrap = document.getElementById('waveform');
  wrap.innerHTML = '';
  const count = 32;
  for (let i = 0; i < count; i += 1) {
    const bar = document.createElement('div');
    bar.className = 'wave-bar';
    bar.style.height = '4px';
    wrap.appendChild(bar);
  }
}

function setMicState(state) {
  const btn = document.getElementById('mic-btn');
  const status = document.getElementById('mic-status');
  const micIcon = document.getElementById('mic-icon-mic');
  const stopIcon = document.getElementById('mic-icon-stop');

  btn.className = `mic-btn ${state}`;

  if (state === 'idle') {
    micIcon.style.display = '';
    stopIcon.style.display = 'none';
    status.textContent = 'Tap to start conversation';
    stopWaveAnimation();
  } else if (state === 'listening') {
    micIcon.style.display = '';
    stopIcon.style.display = 'none';
    status.textContent = 'Listening... tap to stop';
    startWaveAnimation(true);
  } else if (state === 'agent-speaking') {
    micIcon.style.display = 'none';
    stopIcon.style.display = '';
    status.textContent = 'Speaking... tap to interrupt';
    startWaveAnimation(false);
  }
}

async function toggleMic() {
  if (isListening) {
    stopMic();
  } else {
    await startMic();
  }
}

async function startMic() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showToast('Microphone access denied');
    return;
  }

  isListening = true;
  setMicState('listening');

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 64;
  const source = audioContext.createMediaStreamSource(micStream);
  source.connect(analyser);

  const wsScheme = location.protocol === 'https:' ? 'wss' : 'ws';
  wsVoice = new WebSocket(`${wsScheme}://${location.host}/ws/voice`);

  wsVoice.onopen = () => {
    const recorder = new MediaRecorder(micStream, { mimeType: 'audio/webm' });
    recorder.ondataavailable = (e) => {
      if (wsVoice.readyState === WebSocket.OPEN && e.data.size > 0) {
        wsVoice.send(e.data);
      }
    };
    recorder.start(100);
    wsVoice._recorder = recorder;
  };

  wsVoice.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'transcript_user') {
      appendVoiceTranscript('user', msg.text);
    } else if (msg.type === 'transcript_agent') {
      appendVoiceTranscript('agent', msg.text);
      setMicState('agent-speaking');
    } else if (msg.type === 'agent_done') {
      setMicState('listening');
    } else if (msg.type === 'plan_updated') {
      loadPlan();
      showToast('Plan updated ✓');
    }
  };

  wsVoice.onclose = () => {
    isListening = false;
    setMicState('idle');
  };
}

function stopMic() {
  isListening = false;
  if (wsVoice) {
    wsVoice.close();
    wsVoice = null;
  }
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  setMicState('idle');
}

function startWaveAnimation(fromMic) {
  const bars = document.querySelectorAll('.wave-bar');
  if (!bars.length) return;

  function animate() {
    if (analyser && fromMic) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      bars.forEach((bar, i) => {
        const idx = Math.floor((i * data.length) / bars.length);
        const val = data[idx] / 255;
        const h = 4 + val * 44;
        bar.style.height = `${h}px`;
        bar.classList.toggle('active', val > 0.1);
      });
    } else {
      bars.forEach((bar, i) => {
        const val = Math.abs(Math.sin(Date.now() / 300 + i * 0.4)) * 0.6 + 0.1;
        bar.style.height = `${4 + val * 44}px`;
        bar.classList.add('active');
      });
    }
    waveAnimFrame = requestAnimationFrame(animate);
  }
  animate();
}

function stopWaveAnimation() {
  if (waveAnimFrame) {
    cancelAnimationFrame(waveAnimFrame);
    waveAnimFrame = null;
  }
  document.querySelectorAll('.wave-bar').forEach((b) => {
    b.style.height = '4px';
    b.classList.remove('active');
  });
}

function appendVoiceTranscript(role, text) {
  const wrap = document.getElementById('voice-transcript');
  const name = role === 'agent' ? (profile?.name?.split(' ')[0] || 'Agent') : 'You';
  const line = document.createElement('div');
  line.className = `transcript-line ${role}`;
  line.innerHTML = `<div class="speaker">${escHtml(name)}</div>${escHtml(text)}`;
  wrap.appendChild(line);
  wrap.scrollTop = wrap.scrollHeight;
}
