/* Shared runtime state */
let profile = null;
let mde = null;
let planLoaded = false;
let sessionId = null;
let wsVoice = null;
let micStream = null;
let isListening = false;
let audioContext = null;
let analyser = null;
let waveAnimFrame = null;
let currentMode = 'document';
