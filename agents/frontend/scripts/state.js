/* Shared runtime state */
let profile = null;
let mde = null;
let planLoaded = false;
let sessionId = null;
let currentMode = 'document';


/* Websocket */
let wsVoice = null;

/* Audio */
let isListening = false;
let audioRecorderNode = null;
let audioRecorderContext = null;
let audioPlayerNode = null;
let audioPlayerContext = null;
let micStream = null;

/* Audio Animation */
let analyser = null;
let waveAnimFrame = null;
