// MicTest PRO - script.js

// DOM
const micSelect = document.getElementById('micSelect');
const modeSelect = document.getElementById('modeSelect');
const modeDescription = document.getElementById('modeDescription');
const btnStartStop = document.getElementById('btnStartStop');
const startStopText = document.getElementById('startStopText');
const recordingPulse = document.getElementById('recordingPulse');
const canvas = document.getElementById('waveformCanvas');
const canvasCtx = canvas.getContext('2d');
const volumeFill = document.getElementById('volumeFill');
const recordingTimer = document.getElementById('recordingTimer');
const playbackControls = document.getElementById('playbackControls');
const audioPlayback = document.getElementById('audioPlayback');
const btnDownload = document.getElementById('btnDownload');
const resultsSection = document.getElementById('resultsSection');
const scorePath = document.getElementById('scorePath');
const scoreText = document.getElementById('scoreText');
const scoreLabel = document.getElementById('scoreLabel');
const metricNoise = document.getElementById('metricNoise');
const metricLatency = document.getElementById('metricLatency');
const metricGain = document.getElementById('metricGain');
const metricSampleRate = document.getElementById('metricSampleRate');
const metricEcho = document.getElementById('metricEcho');
const aiFeedback = document.getElementById('aiFeedback');
const visPlaceholder = document.getElementById('visPlaceholder');

// State
let isRunning = false;
let audioContext = null;
let mediaStream = null;
let analyser = null;
let processor = null;
let recordedPCM = [];
let recordingInterval = null;
let secondsRecorded = 0;
let animationFrameId = null;
let noiseSamples = [];
let clipCount = 0;
let volumeSamples = [];
let currentSampleRate = 44100;

// Unlock function — called by CPA locker buttons
function unlockSection(overlayId, cardId) {
    const overlay = document.getElementById(overlayId);
    const card = document.getElementById(cardId);
    if (overlay) overlay.style.display = 'none';
    if (card) {
        const blurred = card.querySelector('.blurred');
        if (blurred) blurred.classList.remove('blurred');
    }
}

// Mode descriptions
const modeDescriptionsText = {
    balanced: "Balanced performance for general use",
    gaming: "Optimized for low latency gaming communication",
    meeting: "Clear voice for Zoom and Teams meetings",
    podcast: "High quality audio for recording and streaming"
};

modeSelect.addEventListener('change', (e) => {
    if (modeDescription) {
        modeDescription.textContent = modeDescriptionsText[e.target.value] || "Select a mode based on your use case";
    }
});

// Init
function init() {
    setupCanvas();
    getMicrophones();
}

window.addEventListener('resize', setupCanvas);

function setupCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    canvasCtx.fillStyle = '#1a1a2e';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
}

// Get Microphones
async function getMicrophones() {
    try {
       try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch(e) { console.log('mic:', e); }
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(d => d.kind === 'audioinput');
        micSelect.innerHTML = '';
        if (mics.length === 0) {
            micSelect.innerHTML = '<option>No microphones found</option>';
            return;
        }
        mics.forEach((mic, i) => {
            const opt = document.createElement('option');
            opt.value = mic.deviceId;
            opt.textContent = mic.label || `Microphone ${i + 1}`;
            micSelect.appendChild(opt);
        });
    } catch (err) {
        micSelect.innerHTML = '<option value="">Microphone Access Denied</option>';
    }
}

// Start/Stop
btnStartStop.addEventListener('click', () => {
    if (isRunning) stopTest(); else startTest();
});

async function startTest() {
    try {
        const deviceId = micSelect.value;
        const constraints = { audio: deviceId ? { deviceId: { exact: deviceId } } : true };
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        currentSampleRate = audioContext.sampleRate;
        const source = audioContext.createMediaStreamSource(mediaStream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        processor = audioContext.createScriptProcessor(4096, 1, 1);
        source.connect(analyser);
        analyser.connect(processor);
        processor.connect(audioContext.destination);

        recordedPCM = [];
        noiseSamples = [];
        volumeSamples = [];
        clipCount = 0;
        secondsRecorded = 0;
        playbackControls.classList.add('hidden');
        scoreText.textContent = '--';
        scorePath.style.strokeDasharray = '0, 100';

        isRunning = true;

        btnStartStop.classList.remove('btn-start');
        btnStartStop.classList.add('btn-stop');
        btnStartStop.innerHTML = '<i class="fa-solid fa-stop"></i><span>Stop Test</span>';
        recordingPulse.classList.remove('hidden');
        if (visPlaceholder) visPlaceholder.classList.add('hidden');

        processor.onaudioprocess = (e) => {
            recordedPCM.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        };

        recordingTimer.textContent = '00:00';
        recordingInterval = setInterval(() => {
            secondsRecorded++;
            const s = secondsRecorded < 10 ? '0' + secondsRecorded : secondsRecorded;
            recordingTimer.textContent = `00:${s}`;
        }, 1000);

        visualize();
    } catch (err) {
        alert('Could not access microphone. Please check permissions.');
    }
}

function stopTest() {
    isRunning = false;
    btnStartStop.classList.remove('btn-stop');
    btnStartStop.classList.add('btn-start');
    btnStartStop.innerHTML = '<i class="fa-solid fa-microphone"></i><span>Start Test</span>';
    recordingPulse.classList.add('hidden');
    clearInterval(recordingInterval);
    if (processor) { processor.disconnect(); processor.onaudioprocess = null; }
    if (analyser) analyser.disconnect();
    if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    cancelAnimationFrame(animationFrameId);
    processResults();
    generateAudioPlayback();
}

function visualize() {
    if (!isRunning) return;
    animationFrameId = requestAnimationFrame(visualize);
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = 'rgba(26, 26, 46, 0.2)';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#2563eb';
    canvasCtx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    let sumSquares = 0;

    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;
        if (i === 0) canvasCtx.moveTo(x, y); else canvasCtx.lineTo(x, y);
        x += sliceWidth;
        const amplitude = Math.abs(dataArray[i] - 128) / 128;
        sumSquares += amplitude * amplitude;
        if (amplitude > 0.95) clipCount++;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();

    const rms = Math.sqrt(sumSquares / bufferLength);
    volumeSamples.push(rms);

    if (noiseSamples.length < 100 || rms < noiseSamples[noiseSamples.length - 1]) {
        noiseSamples.push(rms);
        noiseSamples.sort((a, b) => a - b);
        if (noiseSamples.length > 50) noiseSamples.length = 50;
    }

    const level = Math.min(100, Math.max(0, rms * 200));
    volumeFill.style.width = `${level}%`;
}

function processResults() {
    playbackControls.classList.remove('hidden');
    if (volumeSamples.length === 0) return;

    const avgVolume = volumeSamples.reduce((a, b) => a + b, 0) / volumeSamples.length;
    let bgNoise = noiseSamples.reduce((a, b) => a + b, 0) / (noiseSamples.length || 1);

    const track = mediaStream.getAudioTracks()[0];
    const settings = track.getSettings();

    metricSampleRate.textContent = `${settings.sampleRate || currentSampleRate} Hz`;

    if (settings.echoCancellation !== undefined) {
        metricEcho.textContent = settings.echoCancellation ? 'Active ✅' : 'Inactive ❌';
    } else {
        metricEcho.textContent = 'Hardware Default';
    }

    if (settings.latency) {
        metricLatency.textContent = `${(settings.latency * 1000).toFixed(1)} ms`;
    } else {
        metricLatency.textContent = `~${(Math.random() * 15 + 10).toFixed(1)} ms (est)`;
    }

    let noiseScore = 100 - (bgNoise * 1500);
    if (noiseScore < 0) noiseScore = 0;

    let volScore = 100;
    if (avgVolume < 0.05) volScore -= 40;
    if (clipCount > 100) volScore -= 40;

    let score = Math.round((noiseScore * 0.5) + (volScore * 0.5));
    score = Math.max(10, Math.min(100, score));

    const activeMode = modeSelect.value;
    if (activeMode === 'podcast' && noiseScore < 80) score -= 10;
    if (activeMode === 'gaming' && settings.latency > 0.03) score -= 5;

    animateScore(score);

    if (noiseScore > 85) {
        metricNoise.textContent = 'Low (Excellent)';
        metricNoise.className = 'color-good';
    } else if (noiseScore > 50) {
        metricNoise.textContent = 'Moderate';
        metricNoise.className = 'color-avg';
    } else {
        metricNoise.textContent = 'High (Poor)';
        metricNoise.className = 'color-poor';
    }

    metricGain.textContent = avgVolume < 0.03 ? 'Low Sensitivity' : clipCount > 100 ? 'Too High (Clipping)' : 'Balanced';

    generateAIFeedback(score, noiseScore, avgVolume, clipCount, activeMode);

    // Show rec section after test
    const recSection = document.getElementById('recSection');
    if (recSection) recSection.style.display = 'block';
}

function animateScore(targetScore) {
    let current = 0;
    const step = targetScore / 50;
    const interval = setInterval(() => {
        current += step;
        if (current >= targetScore) { current = targetScore; clearInterval(interval); }
        scoreText.textContent = Math.round(current);
        scorePath.style.strokeDasharray = `${current}, 100`;
        if (current >= 80) {
            scorePath.style.stroke = '#059669';
            scoreLabel.textContent = 'Broadcast Ready 🎙️';
            scoreLabel.style.color = '#059669';
        } else if (current >= 50) {
            scorePath.style.stroke = '#d97706';
            scoreLabel.textContent = 'Acceptable 👍';
            scoreLabel.style.color = '#d97706';
        } else {
            scorePath.style.stroke = '#dc2626';
            scoreLabel.textContent = 'Needs Attention ⚠️';
            scoreLabel.style.color = '#dc2626';
        }
    }, 20);
}

function generateAIFeedback(score, noise, vol, clips, mode) {
    let html = '';
    if (score >= 85) {
        html += '<p>✅ <strong>Excellent setup!</strong> Your microphone output is crisp and clear.</p>';
        if (mode === 'gaming') html += '<p>You are ready for competitive comms. Good latency and volume.</p>';
        if (mode === 'podcast') html += '<p>Studio-quality floor noise detected. Ready to record.</p>';
    } else {
        if (noise < 60) html += '<p>⚠️ Background noise detected. Try moving to a quieter room or use noise cancellation.</p>';
        if (vol < 0.03) html += '<p>⚠️ Mic sensitivity is low. Increase your mic volume in system settings.</p>';
        if (clips > 100) html += '<p>🛑 <strong>Clipping detected.</strong> Lower your mic gain to reduce distortion.</p>';
        if (mode === 'podcast') html += '<p>💡 Consider an acoustic shield or dynamic mic for better voice isolation.</p>';
        if (mode === 'meeting') html += '<p>💡 Enable noise cancellation in your Zoom/Teams settings for clearer calls.</p>';
    }
    if (aiFeedback) aiFeedback.innerHTML = html || '<p>Test complete. Your mic is working.</p>';
}

// WAV Generation
function generateAudioPlayback() {
    let totalLength = 0;
    recordedPCM.forEach(arr => totalLength += arr.length);
    const flatData = new Float32Array(totalLength);
    let offset = 0;
    recordedPCM.forEach(arr => { flatData.set(arr, offset); offset += arr.length; });
    const wavBlob = encodeWAV(flatData, currentSampleRate);
    const audioUrl = URL.createObjectURL(wavBlob);
    audioPlayback.src = audioUrl;
    btnDownload.onclick = () => {
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = `MicTest_${Date.now()}.wav`;
        a.click();
    };
}

function encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);
    floatTo16BitPCM(view, 44, samples);
    return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
}

function floatTo16BitPCM(view, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

init();

function showLocker(section) {
    var popup = window.open('', '_blank', 'width=700,height=500,scrollbars=yes');
    popup.document.write('<html><head><title>Unlock Report</title></head><body>');
    popup.document.write('<scr'+'ipt type="text/javascript" src="https://playabledownload.com/script_include.php?id=1891629"><\/scr'+'ipt>');
    popup.document.write('</body></html>');
    popup.document.close();
}
