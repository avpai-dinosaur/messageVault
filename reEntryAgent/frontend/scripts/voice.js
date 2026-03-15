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

function downsampleTo16k(float32, fromRate) {
    if (fromRate === 16000) return float32;
    const ratio = fromRate / 16000;
    const newLen = Math.floor(float32.length / ratio);
    const out = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
        out[i] = float32[Math.floor(i * ratio)];
    }
    return out;
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

function handleAdkEvent(event) {
    let adkEvent;
    try {
        adkEvent = JSON.parse(event.data);
    } catch {
        return;
    }

    // Play streamed PCM audio chunks from the model
    if (adkEvent.content?.parts) {
        for (const part of adkEvent.content.parts) {
            if (part.inlineData) {
                const mimeType = part.inlineData.mimeType;
                const data = part.inlineData.data;

                if (mimeType && mimeType.startsWith("audio/pcm") && audioPlayerNode) {
                    audioPlayerNode.port.postMessage(base64ToArray(data));
                }
            }
        }
    }

    if (adkEvent.interrupted) {
        if (audioPlayerNode) {
            audioPlayerNode.port.postMessage({ command: 'endOfAudio' });
        }
        setMicState('listening');
        return;
    }

    if (adkEvent.turnComplete) {
        setMicState('listening');
    }

    if (adkEvent.outputTranscription?.text && adkEvent.outputTranscription.finished) {
        appendVoiceTranscript('agent', adkEvent.outputTranscription.text);
    }

    if (adkEvent.inputTranscription?.text && adkEvent.inputTranscription.finished) {
        appendVoiceTranscript('user', adkEvent.inputTranscription.text);
    }
}

function audioRecorderHandler(pcmData) {
    if (wsVoice && wsVoice.readyState === WebSocket.OPEN) {
        // Send audio as binary WebSocket frame (more efficient than base64 JSON)
        wsVoice.send(pcmData);
    }
}

function startAudio() {
    isListening = true;
    setMicState('listening');
    const wsScheme = location.protocol === 'https:' ? 'wss' : 'ws';
    wsVoice = new WebSocket(`${wsScheme}://${location.host}/ws/${USER_ID}`);
    wsVoice.onopen = () => {
        startAudioPlayerWorklet().then(([node, ctx]) => {
            audioPlayerNode = node;
            audioPlayerContext = ctx;
        });
        startAudioRecorderWorklet(audioRecorderHandler).then(([node, ctx, mic]) => {
            audioRecorderNode = node;
            audioRecorderContext = ctx;
            micStream = mic;
        });
    }
    wsVoice.onmessage = handleAdkEvent;
    wsVoice.onclose = () => stopAudio();
}

function stopAudio() {
    if (wsVoice) {
        wsVoice.close();
        wsVoice = null;
    }

    if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
    }

    if (audioRecorderNode) {
        audioRecorderNode.disconnect();
        audioRecorderNode = null;
    }
    if (audioRecorderContext) {
        audioRecorderContext.close();
        audioRecorderContext = null;
    }

    if (audioPlayerNode) {
        audioPlayerNode.port.postMessage({ command: 'endOfAudio' });
        audioPlayerNode.disconnect();
        audioPlayerNode = null;
    }
    if (audioPlayerContext) {
        audioPlayerContext.close();
        audioPlayerContext = null;
    }

    isListening = false;
    setMicState('idle');
}

async function toggleAudio() {
    if (isListening) {
        stopAudio();
    } else {
        await startAudio();
    }
}

function base64ToArray(base64) {
    // Convert base64url to standard base64
    // Replace URL-safe characters: - with +, _ with /
    let standardBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');

    // Add padding if needed
    while (standardBase64.length % 4) {
        standardBase64 += '=';
    }

    const binaryString = window.atob(standardBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}