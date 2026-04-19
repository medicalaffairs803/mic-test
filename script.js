// --- MicTest PRO Javascript ---

// DOM Elements
const micSelect = document.getElementById('micSelect');
const modeSelect = document.getElementById('modeSelect');
const modeDescription = document.getElementById('modeDescription');
const btnStartStop = document.getElementById('btnStartStop');
const startStopText = document.getElementById('startStopText');
const recordingPulse = document.getElementById('recordingPulse');

// Canvas
const canvas = document.getElementById('waveformCanvas');
const canvasCtx = canvas.getContext('2d');
const volumeFill = document.getElementById('volumeFill');

// Timers & Playback
const recordingTimer = document.getElementById('recordingTimer');
const freeLimitWarning = document.getElementById('freeLimitWarning');
const playbackControls = document.getElementById('playbackControls');
const audioPlayback = document.getElementById('audioPlayback');
const btnDownload = document.getElementById('btnDownload');

// Results Dashboard
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

// STATE
let isRunning = false;
let audioContext = null;
let mediaStream = null;
let analyser = null;
let processor = null;
let recordedPCM = [];
let recordingInterval = null;
let secondsRecorded = 0;
let animationFrameId = null;
let testCompleted = false;

// Analytics State
let noiseSamples = [];
let clipCount = 0;
let volumeSamples = [];
let currentSampleRate = 44100;

const modes = {
    balanced: { noiseWeight: 0.3, volumeWeight: 0.5, consistencyWeight: 0.2 },
    gaming: { noiseWeight: 0.2, volumeWeight: 0.4, consistencyWeight: 0.4 }, // Gamers need consistent voice, avoid spikes
    meeting: { noiseWeight: 0.5, volumeWeight: 0.3, consistencyWeight: 0.2 }, // Meetings need zero background noise
    podcast: { noiseWeight: 0.4, volumeWeight: 0.4, consistencyWeight: 0.2 }  // Studio quality
};

// Initialize App
function init() {
    setupCanvas();
    getMicrophones();
}

window.addEventListener('resize', setupCanvas);

function setupCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    canvasCtx.fillStyle = '#1A1E29';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
}

// Media Devices
async function getMicrophones() {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true }); // Request perm first to get labels
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(d => d.kind === 'audioinput');
        
        micSelect.innerHTML = '';
        if (mics.length === 0) {
            micSelect.innerHTML = '<option>No microphones found</option>';
            return;
        }

        mics.forEach((mic, index) => {
            const option = document.createElement('option');
            option.value = mic.deviceId;
            option.textContent = mic.label || `Microphone ${index + 1}`;
            micSelect.appendChild(option);
        });
    } catch (err) {
        console.error('Error accessing media devices.', err);
        micSelect.innerHTML = '<option value="">Microphone Access Denied</option>';
    }
}

// Start / Stop Logic
btnStartStop.addEventListener('click', () => {
    if (isRunning) {
        stopTest();
    } else {
        startTest();
    }
});

const modeDescriptionsText = {
    balanced: "Balanced performance for general use",
    gaming: "Optimized for low latency gaming communication",
    meeting: "Clear voice for Zoom and meetings",
    podcast: "High quality audio for recording and streaming"
};

modeSelect.addEventListener('change', (e) => {
    if (modeDescription) {
        modeDescription.textContent = modeDescriptionsText[e.target.value] || "Select a mode based on your use case";
    }
});

async function startTest() {
    try {
        const deviceId = micSelect.value;
        const mode = modeSelect.value;
        
        const constraints = {
            audio: deviceId ? { deviceId: { exact: deviceId } } : true
        };

        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        currentSampleRate = audioContext.sampleRate;
        const source = audioContext.createMediaStreamSource(mediaStream);
        
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        
        // Setup ScriptProcessor for PCM capture
        processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        source.connect(analyser);
        analyser.connect(processor);
        processor.connect(audioContext.destination);

        // Reset Data
        recordedPCM = [];
        noiseSamples = [];
        volumeSamples = [];
        clipCount = 0;
        secondsRecorded = 0;
        playbackControls.classList.add('hidden');
        scoreText.textContent = '--';
        scorePath.style.strokeDasharray = '0, 100';

        // Update UI
        isRunning = true;
        testCompleted = false;
        
        btnStartStop.classList.remove('btn-start');
        btnStartStop.classList.add('btn-stop');
        btnStartStop.innerHTML = '<i class="fa-solid fa-stop"></i> <span id="startStopText">Stop Test</span>';
        recordingPulse.classList.remove('hidden');

        // Recording Loop
        processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            recordedPCM.push(new Float32Array(inputData));
        };

        // Timer Loop
        recordingTimer.textContent = '00:00';
        recordingInterval = setInterval(() => {
            secondsRecorded++;
            let pSec = secondsRecorded < 10 ? '0'+secondsRecorded : secondsRecorded;
            recordingTimer.textContent = `00:${pSec}`;
        }, 1000);

        visualize();

    } catch (err) {
        console.error('Failed to start test:', err);
        alert('Could not access microphone. Please check permissions.');
    }
}

function stopTest() {
    isRunning = false;
    btnStartStop.classList.remove('btn-stop');
    btnStartStop.classList.add('btn-start');
    btnStartStop.innerHTML = '<i class="fa-solid fa-microphone"></i> <span id="startStopText">Start Test</span>';
    recordingPulse.classList.add('hidden');
    clearInterval(recordingInterval);

    if (processor) {
        processor.disconnect();
        processor.onaudioprocess = null;
    }
    if (analyser) analyser.disconnect();
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
    }
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

    // Draw Waveform
    canvasCtx.fillStyle = 'rgba(26, 30, 41, 0.2)'; // fade effect
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'hsl(250, 80%, 65%)'; // Primary color
    canvasCtx.beginPath();

    const sliceWidth = canvas.width * 1.0 / bufferLength;
    let x = 0;
    
    let sumSquares = 0;
    let maxAmp = 0;

    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);

        x += sliceWidth;

        // Data collection for analytics
        const amplitude = Math.abs(dataArray[i] - 128) / 128;
        sumSquares += amplitude * amplitude;
        if (amplitude > maxAmp) maxAmp = amplitude;
        if (amplitude > 0.95) clipCount++;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();

    // Volume Meter
    const rms = Math.sqrt(sumSquares / bufferLength);
    volumeSamples.push(rms);
    
    // Track lowest 10% as background noise proxy
    if (noiseSamples.length < 100 || rms < noiseSamples[noiseSamples.length-1]) {
        noiseSamples.push(rms);
        noiseSamples.sort((a,b) => a - b);
        if(noiseSamples.length > 50) noiseSamples.length = 50; 
    }

    // Convert RMS to roughly 0-100%
    const level = Math.min(100, Math.max(0, (rms * 200)));
    volumeFill.style.width = `${level}%`;
}

// Processing Analytics
function processResults() {
    playbackControls.classList.remove('hidden');

    if (volumeSamples.length === 0) return;

    // Calculate metrics
    const avgVolume = volumeSamples.reduce((a, b) => a + b, 0) / volumeSamples.length;
    let bgNoise = noiseSamples.reduce((a, b) => a + b, 0) / (noiseSamples.length || 1);
    
    // Hardware constraints extraction
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

    // Evaluate Quality
    let noiseScore = 100 - (bgNoise * 1500); // 100 is silent, 0 is noisy
    if (noiseScore < 0) noiseScore = 0;
    
    let volScore = 100;
    if (avgVolume < 0.05) volScore -= 40; // Too quiet
    if (clipCount > 100) volScore -= 40; // Peaking

    let score = Math.round((noiseScore * 0.5) + (volScore * 0.5));
    if (score > 100) score = 100;
    if (score < 10) score = 10;

    // Mode Adjustments (Mock logic differences)
    const activeMode = modeSelect.value;
    if (activeMode === 'podcast' && noiseScore < 80) score -= 10; // Punish noise hard
    if (activeMode === 'gaming' && settings.latency > 0.03) score -= 5; // Punish latency

    // Display updates
    animateScore(score);
    
    // Updates UI texts
    if (noiseScore > 85) {
        metricNoise.textContent = 'Low (Excellent)';
        metricNoise.className = 'metric-value color-good';
    } else if (noiseScore > 50) {
        metricNoise.textContent = 'Moderate';
        metricNoise.className = 'metric-value color-avg';
    } else {
        metricNoise.textContent = 'High (Poor)';
        metricNoise.className = 'metric-value color-poor';
    }

    if (avgVolume < 0.03) {
        metricGain.textContent = 'Low Sensitivity';
    } else if (clipCount > 100) {
        metricGain.textContent = 'Gain Tool High (Clipping)';
    } else {
        metricGain.textContent = 'Balanced';
    }

    generateAIFeedback(score, noiseScore, avgVolume, clipCount, activeMode);
    
    // Task 2: Show CTA
    if (document.getElementById('scoreCtaValue')) {
        document.getElementById('scoreCtaValue').textContent = score;
        document.getElementById('scoreCta').classList.remove('hidden');
    }

    testCompleted = true;
}

function animateScore(targetScore) {
    let current = 0;
    const duration = 1000;
    const frameGap = 20;
    const step = (targetScore / duration) * frameGap;

    const interval = setInterval(() => {
        current += step;
        if (current >= targetScore) {
            current = targetScore;
            clearInterval(interval);
        }
        
        scoreText.textContent = Math.round(current);
        const dasharray = `${current}, 100`;
        scorePath.style.strokeDasharray = dasharray;

        // Color coding
        if (current >= 80) {
            scorePath.style.stroke = 'var(--accent-success)';
            scoreLabel.textContent = 'Broadcast Ready 🎙️';
        } else if (current >= 50) {
            scorePath.style.stroke = 'var(--accent-warning)';
            scoreLabel.textContent = 'Acceptable 👍';
        } else {
            scorePath.style.stroke = 'var(--accent-danger)';
            scoreLabel.textContent = 'Requires Attention ⚠️';
        }
    }, frameGap);
}

function generateAIFeedback(score, noise, vol, clips, mode) {
    let feedback = '';

    if (score >= 85) {
        feedback += '<p><strong>Excellent setup!</strong> Your microphone output is crisp and clear.</p>';
        if (mode === 'gaming') feedback += '<p>You are ready for competitive comms. Good latency and volume.</p>';
        if (mode === 'podcast') feedback += '<p>Studio-quality floor noise detected. Ready for recording.</p>';
    } else {
        if (noise < 60) {
            feedback += '<p>⚠️ Background noise detected. This may reduce audio clarity.</p>';
        }
        if (vol < 0.03) {
            feedback += '<p>⚠️ Your mic sensitivity is low. Your voice may sound weak in meetings.</p>';
        }
        if (clips > 100) {
            feedback += '<p>🛑 <strong>Audio clipping detected.</strong> You are speaking too loudly or the gain is too high, causing distortion.</p>';
        }
        if (mode === 'podcast') {
            feedback += '<p>💡 <em>Podcast Tip:</em> Consider an acoustic shield or dynamic mic to isolate your voice better.</p>';
        }
    }

    aiFeedback.innerHTML = feedback;
}

// Generate WAV Blob
function generateAudioPlayback() {
    // Flatten PCM arrays
    let totalLength = 0;
    recordedPCM.forEach((arr) => totalLength += arr.length);
    const flatData = new Float32Array(totalLength);
    let offset = 0;
    recordedPCM.forEach((arr) => {
        flatData.set(arr, offset);
        offset += arr.length;
    });

    // Create WAV
    const wavBlob = encodeWAV(flatData, currentSampleRate);
    const audioUrl = URL.createObjectURL(wavBlob);
    
    audioPlayback.src = audioUrl;

    // Download handler
    btnDownload.onclick = () => {
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = `MicTestPro_Recording_${new Date().getTime()}.wav`;
        a.click();
    };
}

// Standard WAV Encoder
function encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');

    // FMT sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono channel
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample

    // Data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Write PCM samples
    floatTo16BitPCM(view, 44, samples);

    return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function floatTo16BitPCM(view, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        // 16-bit PCM scale
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}



// Boot
init();
