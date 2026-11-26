/* ===================================
   MIC TEST PRO — SCRIPT.JS
=================================== */

const startBtn =
document.getElementById("startBtn");

const stopBtn =
document.getElementById("stopBtn");

const micStatus =
document.getElementById("micStatus");

const volumeText =
document.getElementById("volumeText");

const meterFill =
document.getElementById("meterFill");

const noiseLevel =
document.getElementById("noiseLevel");

const qualityLevel =
document.getElementById("qualityLevel");

const latencyLevel =
document.getElementById("latencyLevel");

const deviceName =
document.getElementById("deviceName");

const canvas =
document.getElementById("visualizer");

const canvasCtx =
canvas.getContext("2d");

const recordBtn =
document.getElementById("recordBtn");

const recordBtnText =
document.getElementById("recordBtnText");

const recordTimer =
document.getElementById("recordTimer");

const recordStatus =
document.getElementById("recordStatus");

const playbackWrap =
document.getElementById("playbackWrap");

const playbackAudio =
document.getElementById("playbackAudio");

const downloadBtn =
document.getElementById("downloadBtn");

let audioContext;
let analyser;
let microphone;
let dataArray;
let animationId;
let stream;
let mediaRecorder = null;
let recordedChunks = [];
let recordStartTime = 0;
let recordTimerInterval = null;
let recordingUrl = null;
let recordAutoStopped = false;

/* =========================
   CANVAS SIZE
========================= */

function resizeCanvas(){

  canvas.width =
  canvas.offsetWidth;

  canvas.height =
  canvas.offsetHeight;

}

resizeCanvas();

window.addEventListener(
"resize",
resizeCanvas
);

/* =========================
   START MIC TEST
========================= */

async function startMicTest(){

  if(mediaRecorder &&
     mediaRecorder.state !== "inactive"){

    mediaRecorder.stop();

  }

  if(
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ){

    micStatus.textContent =
    "Browser Not Supported";

    document.querySelector(".dot")
    .style.background =
    "#ef4444";

    return;

  }

  try{

    stream =
    await navigator.mediaDevices
    .getUserMedia({
      audio:true
    });

    /* Added 2026-11-26: if the user picked a
       specific microphone in the dropdown,
       switch the stream to that device. */
    if(selectedDeviceId){

      const currentTrack =
      stream.getAudioTracks()[0];

      const currentSettings =
      currentTrack ?
      currentTrack.getSettings() :
      {};

      if(
        currentSettings.deviceId &&
        currentSettings.deviceId !== selectedDeviceId
      ){

        stream.getTracks()
        .forEach(track =>
          track.stop()
        );

        try{

          stream =
          await navigator.mediaDevices
          .getUserMedia({
            audio: {
              deviceId: {
                exact: selectedDeviceId
              }
            }
          });

        }

        catch(switchError){

          stream =
          await navigator.mediaDevices
          .getUserMedia({
            audio:true
          });

        }

      }

    }

    audioContext =
    new(
      window.AudioContext ||
      window.webkitAudioContext
    )();

    analyser =
    audioContext.createAnalyser();

    analyser.fftSize = 2048;

    const bufferLength =
    analyser.frequencyBinCount;

    dataArray =
    new Uint8Array(bufferLength);

    microphone =
    audioContext
    .createMediaStreamSource(
      stream
    );

    microphone.connect(analyser);

    micStatus.textContent =
    "Microphone Connected";

    if(recordBtn && window.MediaRecorder){

      recordBtn.disabled = false;

    }else if(recordBtn && recordStatus){

      recordStatus.textContent =
      "Recording is not supported in this browser. The live test still works as normal.";

    }

    document.querySelector(".dot")
    .style.background =
    "#22c55e";

    detectDevice();

    /* Added 2026-11-26: refresh the microphone
       dropdown now that device labels are
       available after permission. */
    refreshMicDevices();

    visualize();

  }

  catch(error){

    micStatus.textContent =
    "Microphone Access Denied";

    document.querySelector(".dot")
    .style.background =
    "#ef4444";

    console.error(error);

  }

}

/* =========================
   STOP TEST
========================= */

function stopMicTest(){

  if(mediaRecorder &&
     mediaRecorder.state !== "inactive"){

    mediaRecorder.stop();

  }

  if(recordBtn){

    recordBtn.disabled = true;

  }

  if(stream){

    stream.getTracks()
    .forEach(track =>
      track.stop()
    );

  }

  if(animationId){

    cancelAnimationFrame(
      animationId
    );

  }

  meterFill.style.width =
  "0%";

  volumeText.textContent =
  "0%";

  noiseLevel.textContent =
  "--";

  qualityLevel.textContent =
  "--";

  latencyLevel.textContent =
  "--";

  deviceName.textContent =
  "Not Connected";

  micStatus.textContent =
  "Mic Test Stopped";

  document.querySelector(".dot")
  .style.background =
  "#facc15";

}

/* =========================
   VISUALIZER
========================= */

function visualize(){

  analyser.getByteTimeDomainData(
    dataArray
  );

  canvasCtx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  canvasCtx.lineWidth = 3;

  canvasCtx.strokeStyle =
  "#3b82f6";

  canvasCtx.beginPath();

  let sliceWidth =
  canvas.width /
  dataArray.length;

  let x = 0;

  let total = 0;

  for(let i=0;
      i<dataArray.length;
      i++){

    let v =
    dataArray[i] / 128.0;

    let y =
    v * canvas.height / 2;

    if(i === 0){

      canvasCtx.moveTo(x,y);

    }else{

      canvasCtx.lineTo(x,y);

    }

    x += sliceWidth;

    total +=
    Math.abs(
      dataArray[i] - 128
    );

  }

  canvasCtx.lineTo(
    canvas.width,
    canvas.height / 2
  );

  canvasCtx.stroke();

  /* =====================
     VOLUME LEVEL
  ===================== */

  let average =
  total / dataArray.length;

  let volume =
  Math.min(
    100,
    Math.round(average * 1.8)
  );

  meterFill.style.width =
  volume + "%";

  volumeText.textContent =
  volume + "%";

  /* =====================
     NOISE DETECTION
  ===================== */

  if(volume < 10){

    noiseLevel.textContent =
    "Low";

    qualityLevel.textContent =
    "Excellent";

  }

  else if(volume < 30){

    noiseLevel.textContent =
    "Medium";

    qualityLevel.textContent =
    "Good";

  }

  else{

    noiseLevel.textContent =
    "High";

    qualityLevel.textContent =
    "Noisy";

  }

  /* =====================
     LATENCY (real value from
     the browser's AudioContext,
     not simulated)
  ===================== */

  if(audioContext){

    const baseLatency =
    audioContext.baseLatency || 0;

    const outputLatency =
    audioContext.outputLatency || 0;

    const totalLatencyMs =
    Math.round(
      (baseLatency + outputLatency) * 1000
    );

    latencyLevel.textContent =
    totalLatencyMs > 0 ?
    totalLatencyMs + "ms" :
    "N/A";

  }

  animationId =
  requestAnimationFrame(
    visualize
  );

}

/* =========================
   DEVICE DETECTION
========================= */

async function detectDevice(){

  try{

    const devices =
    await navigator
    .mediaDevices
    .enumerateDevices();

    const audioInputs =
    devices.filter(device =>
      device.kind === "audioinput"
    );

    if(audioInputs.length > 0){

      deviceName.textContent =
      audioInputs[0].label ||
      "External Microphone";

    }

  }

  catch(error){

    deviceName.textContent =
    "Unknown Device";

  }

}

/* =========================
   BUTTON EVENTS
========================= */

startBtn.addEventListener(
"click",
startMicTest
);

stopBtn.addEventListener(
"click",
stopMicTest
);

/* =========================
   AUTO STOP ON TAB CLOSE
========================= */

window.addEventListener(
"beforeunload",
() => {

  if(mediaRecorder &&
     mediaRecorder.state !== "inactive"){

    mediaRecorder.stop();

  }

  if(stream){

    stream.getTracks()
    .forEach(track =>
      track.stop()
    );

  }

});

/* =========================
   RECORD / PLAYBACK / DOWNLOAD
   (added 2026-11-26)

   Records from the SAME stream
   as the live test with
   MediaRecorder, converts the
   clip to WAV in the browser,
   and offers playback + download.
   The audio never leaves the
   device — no uploads, no
   network calls.
========================= */

const MAX_RECORD_SECONDS = 60;

function formatRecordTime(totalSeconds){

  const minutes =
  Math.floor(totalSeconds / 60);

  const seconds =
  totalSeconds % 60;

  return String(minutes).padStart(2, "0") +
  ":" +
  String(seconds).padStart(2, "0");

}

function updateRecordTimer(){

  const elapsed =
  Math.floor(
    (Date.now() - recordStartTime) / 1000
  );

  recordTimer.textContent =
  formatRecordTime(elapsed);

  if(elapsed >= MAX_RECORD_SECONDS){

    recordAutoStopped = true;

    stopRecording();

  }

}

function startRecording(){

  if(!stream){

    if(recordStatus){

      recordStatus.textContent =
      "Start the mic test first, then press Record Voice.";

    }

    return;

  }

  if(!window.MediaRecorder){

    if(recordStatus){

      recordStatus.textContent =
      "Recording is not supported in this browser. The live test still works as normal.";

    }

    return;

  }

  try{

    recordedChunks = [];

    recordAutoStopped = false;

    mediaRecorder =
    new MediaRecorder(stream);

    mediaRecorder.ondataavailable =
    (event) => {

      if(event.data &&
         event.data.size > 0){

        recordedChunks.push(event.data);

      }

    };

    mediaRecorder.onstop =
    finishRecording;

    mediaRecorder.start();

    recordStartTime = Date.now();

    recordTimer.textContent = "00:00";

    recordTimer.hidden = false;

    recordTimerInterval =
    setInterval(updateRecordTimer, 250);

    playbackWrap.hidden = true;

    recordBtn.classList.add("recording");

    recordBtnText.textContent =
    "Stop Recording";

    recordBtn.setAttribute(
      "aria-label",
      "Stop recording"
    );

    if(recordStatus){

      recordStatus.textContent =
      "Recording… speak now. Press Stop Recording when you finish.";

    }

  }

  catch(error){

    console.error(error);

    if(recordStatus){

      recordStatus.textContent =
      "Recording could not start. Please try again.";

    }

  }

}

function stopRecording(){

  if(mediaRecorder &&
     mediaRecorder.state !== "inactive"){

    mediaRecorder.stop();

  }

}

async function finishRecording(){

  if(recordTimerInterval){

    clearInterval(recordTimerInterval);

    recordTimerInterval = null;

  }

  recordTimer.hidden = true;

  recordBtn.classList.remove("recording");

  recordBtnText.textContent =
  "Record Voice";

  recordBtn.setAttribute(
    "aria-label",
    "Record your voice"
  );

  const mimeType =
  (mediaRecorder && mediaRecorder.mimeType) ||
  "audio/webm";

  const recordedBlob =
  new Blob(recordedChunks, {type: mimeType});

  if(recordedBlob.size === 0){

    if(recordStatus){

      recordStatus.textContent =
      "No audio was captured. Please record again and speak into your microphone.";

    }

    return;

  }

  let downloadBlob = recordedBlob;

  let extension =
  mimeType.includes("mp4") ? "mp4" :
  mimeType.includes("ogg") ? "ogg" : "webm";

  try{

    const arrayBuffer =
    await recordedBlob.arrayBuffer();

    const audioBuffer =
    await audioContext
    .decodeAudioData(arrayBuffer);

    downloadBlob =
    audioBufferToWav(audioBuffer);

    extension = "wav";

  }

  catch(error){

    console.error(
      "WAV conversion failed, keeping original format",
      error
    );

  }

  if(recordingUrl){

    URL.revokeObjectURL(recordingUrl);

  }

  recordingUrl =
  URL.createObjectURL(downloadBlob);

  playbackAudio.src = recordingUrl;

  downloadBtn.href = recordingUrl;

  downloadBtn.download =
  "mic-test-recording." + extension;

  downloadBtn.textContent =
  "Download Recording (." + extension + ")";

  playbackWrap.hidden = false;

  if(recordStatus){

    recordStatus.textContent =
    recordAutoStopped ?
    "Recording stopped at 60 seconds (maximum length). Press play to listen, or download it below." :
    "Recording ready — press play to listen, or download it below.";

  }

  recordAutoStopped = false;

}

function audioBufferToWav(buffer){

  const sampleRate =
  buffer.sampleRate;

  const channelData =
  buffer.getChannelData(0);

  const numFrames =
  channelData.length;

  const dataSize =
  numFrames * 2;

  const wavBuffer =
  new ArrayBuffer(44 + dataSize);

  const view =
  new DataView(wavBuffer);

  const writeString =
  (offset, text) => {

    for(let i = 0;
        i < text.length;
        i++){

      view.setUint8(
        offset + i,
        text.charCodeAt(i)
      );

    }

  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;

  for(let i = 0; i < numFrames; i++){

    let sample =
    Math.max(-1, Math.min(1, channelData[i]));

    view.setInt16(
      offset,
      sample < 0 ?
      sample * 0x8000 :
      sample * 0x7FFF,
      true
    );

    offset += 2;

  }

  return new Blob(
    [wavBuffer],
    {type: "audio/wav"}
  );

}

if(recordBtn){

  recordBtn.addEventListener(
    "click",
    () => {

      if(mediaRecorder &&
         mediaRecorder.state === "recording"){

        stopRecording();

      }else{

        startRecording();

      }

    }
  );

}

if(downloadBtn){

  downloadBtn.addEventListener(
    "click",
    () => {

      if(recordStatus){

        recordStatus.textContent =
        "Your download has started — check your downloads folder.";

      }

    }
  );

}

/* =========================
   EXTRA TOOL FEATURES
   (added 2026-11-26)

   Speaker test, microphone
   select dropdown, "hear
   yourself" monitor, live
   spectrum bars and a result
   summary card with copy.
   Purely additive: reads the
   same values the live test
   already computes.
========================= */

const speakerBtn =
document.getElementById("speakerBtn");

const speakerStatus =
document.getElementById("speakerStatus");

const micSelect =
document.getElementById("micSelect");

const monitorBtn =
document.getElementById("monitorBtn");

const monitorBtnText =
document.getElementById("monitorBtnText");

const monitorStatus =
document.getElementById("monitorStatus");

const spectrumCanvas =
document.getElementById("spectrumCanvas");

const spectrumCtx =
spectrumCanvas ?
spectrumCanvas.getContext("2d") :
null;

const sumStatus =
document.getElementById("sumStatus");

const sumLevel =
document.getElementById("sumLevel");

const sumNoise =
document.getElementById("sumNoise");

const sumLatency =
document.getElementById("sumLatency");

const sumDevice =
document.getElementById("sumDevice");

const copyResultBtn =
document.getElementById("copyResultBtn");

const copyStatus =
document.getElementById("copyStatus");

let selectedDeviceId = "";
let speakerContext = null;
let speakerPlaying = false;
let monitorOn = false;
let monitorGain = null;
let monitorSource = null;
let spectrumData = null;
let copyResetTimer = null;

/* =========================
   SPEAKER TEST
   Plays a short gentle tone.
   Works without microphone
   permission.
========================= */

function playSpeakerTest(){

  if(speakerPlaying){

    return;

  }

  const AudioCtx =
  window.AudioContext ||
  window.webkitAudioContext;

  if(!AudioCtx){

    if(speakerStatus){

      speakerStatus.textContent =
      "Speaker test is not supported in this browser.";

    }

    return;

  }

  try{

    if(!speakerContext){

      speakerContext =
      new AudioCtx();

    }

    speakerContext.resume();

    const startTime =
    speakerContext.currentTime;

    const oscillator =
    speakerContext.createOscillator();

    const toneGain =
    speakerContext.createGain();

    oscillator.type = "sine";

    oscillator.frequency
    .setValueAtTime(440, startTime);

    oscillator.frequency
    .exponentialRampToValueAtTime(
      880,
      startTime + 1.2
    );

    toneGain.gain
    .setValueAtTime(0, startTime);

    toneGain.gain
    .linearRampToValueAtTime(
      0.15,
      startTime + 0.1
    );

    toneGain.gain
    .setValueAtTime(
      0.15,
      startTime + 1.0
    );

    toneGain.gain
    .linearRampToValueAtTime(
      0,
      startTime + 1.3
    );

    oscillator.connect(toneGain);

    toneGain.connect(
      speakerContext.destination
    );

    speakerPlaying = true;

    if(speakerBtn){

      speakerBtn.disabled = true;

    }

    if(speakerStatus){

      speakerStatus.textContent =
      "Playing test sound…";

    }

    oscillator.onended = () => {

      speakerPlaying = false;

      if(speakerBtn){

        speakerBtn.disabled = false;

      }

      if(speakerStatus){

        speakerStatus.textContent =
        "Done — if you heard the sound, your speakers or headphones work.";

      }

    };

    oscillator.start(startTime);

    oscillator.stop(startTime + 1.35);

  }

  catch(error){

    console.error(error);

    speakerPlaying = false;

    if(speakerBtn){

      speakerBtn.disabled = false;

    }

    if(speakerStatus){

      speakerStatus.textContent =
      "The test sound could not play. Please try again.";

    }

  }

}

if(speakerBtn){

  speakerBtn.addEventListener(
    "click",
    playSpeakerTest
  );

}

/* =========================
   MICROPHONE SELECT
   Lists the available
   microphones. Labels appear
   after microphone permission
   is granted; before that the
   list shows generic names.
========================= */

async function refreshMicDevices(){

  if(
    !micSelect ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.enumerateDevices
  ){

    return;

  }

  try{

    const devices =
    await navigator
    .mediaDevices
    .enumerateDevices();

    const audioInputs =
    devices.filter(device =>
      device.kind === "audioinput" &&
      device.deviceId
    );

    const seenIds = new Set();

    const uniqueInputs =
    audioInputs.filter(device => {

      if(seenIds.has(device.deviceId)){

        return false;

      }

      seenIds.add(device.deviceId);

      return true;

    });

    micSelect.innerHTML = "";

    const defaultOption =
    document.createElement("option");

    defaultOption.value = "";

    defaultOption.textContent =
    "Default microphone";

    micSelect.appendChild(defaultOption);

    uniqueInputs.forEach((device, index) => {

      const option =
      document.createElement("option");

      option.value = device.deviceId;

      option.textContent =
      device.label ||
      "Microphone " + (index + 1);

      micSelect.appendChild(option);

    });

    const stillAvailable =
    uniqueInputs.some(device =>
      device.deviceId === selectedDeviceId
    );

    if(stillAvailable){

      micSelect.value = selectedDeviceId;

      const chosen =
      uniqueInputs.find(device =>
        device.deviceId === selectedDeviceId
      );

      if(chosen && chosen.label){

        setTimeout(() => {

          deviceName.textContent =
          chosen.label;

        }, 350);

      }

    }else{

      selectedDeviceId = "";

      micSelect.value = "";

    }

  }

  catch(error){

    console.error(error);

  }

}

if(micSelect){

  micSelect.addEventListener(
    "change",
    () => {

      selectedDeviceId =
      micSelect.value;

      if(stream && stream.active){

        stopMicTest();

        startMicTest();

      }

    }
  );

}

if(
  navigator.mediaDevices &&
  navigator.mediaDevices.addEventListener
){

  navigator.mediaDevices
  .addEventListener(
    "devicechange",
    refreshMicDevices
  );

}

/* =========================
   RESULT SUMMARY CARD
   Shows the same values the
   live test already computes.
========================= */

function summaryMicStatus(){

  const status =
  micStatus.textContent;

  if(status === "Microphone Connected"){

    return "Working";

  }

  if(status === "Microphone Access Denied"){

    return "Access denied";

  }

  if(status === "Browser Not Supported"){

    return "Not supported";

  }

  if(status === "Mic Test Stopped"){

    return "Stopped";

  }

  return "Not started";

}

function updateSummaryCard(){

  if(!sumStatus){

    return;

  }

  sumStatus.textContent =
  summaryMicStatus();

  sumLevel.textContent =
  volumeText.textContent;

  sumNoise.textContent =
  noiseLevel.textContent;

  sumLatency.textContent =
  latencyLevel.textContent;

  sumDevice.textContent =
  deviceName.textContent;

}

function showCopied(){

  if(copyStatus){

    copyStatus.textContent =
    "Copied ✓";

  }

  if(copyResetTimer){

    clearTimeout(copyResetTimer);

  }

  copyResetTimer =
  setTimeout(() => {

    if(copyStatus){

      copyStatus.textContent = "";

    }

  }, 2500);

}

async function copyResult(){

  const resultText =
  "Mic Test Pro — my mic test result\n" +
  "Mic status: " + summaryMicStatus() + "\n" +
  "Input level: " + volumeText.textContent + "\n" +
  "Noise level: " + noiseLevel.textContent + "\n" +
  "Latency: " + latencyLevel.textContent + "\n" +
  "Device: " + deviceName.textContent + "\n" +
  "Tested free at testmics.com";

  try{

    await navigator.clipboard
    .writeText(resultText);

    showCopied();

    return;

  }

  catch(error){

    console.error(error);

  }

  const helper =
  document.createElement("textarea");

  helper.value = resultText;

  helper.style.position = "fixed";

  helper.style.opacity = "0";

  document.body.appendChild(helper);

  helper.select();

  let copied = false;

  try{

    copied =
    document.execCommand("copy");

  }

  catch(error){

    copied = false;

  }

  document.body.removeChild(helper);

  if(copied){

    showCopied();

  }else if(copyStatus){

    copyStatus.textContent =
    "Copy did not work in this browser.";

  }

}

if(copyResultBtn){

  copyResultBtn.addEventListener(
    "click",
    copyResult
  );

}

/* =========================
   SPECTRUM VISUALIZER
   Frequency bars (bass on the
   left, treble on the right)
   drawn from the existing
   analyser by its own loop.
========================= */

function sizeSpectrum(){

  if(!spectrumCanvas){

    return;

  }

  spectrumCanvas.width =
  spectrumCanvas.offsetWidth;

  spectrumCanvas.height =
  spectrumCanvas.offsetHeight;

}

function drawSpectrum(){

  requestAnimationFrame(drawSpectrum);

  if(!spectrumCanvas || !spectrumCtx){

    return;

  }

  const width = spectrumCanvas.width;

  const height = spectrumCanvas.height;

  if(width === 0 || height === 0){

    return;

  }

  spectrumCtx.clearRect(
    0,
    0,
    width,
    height
  );

  const bars = 48;

  const barWidth = width / bars;

  const active =
  analyser &&
  stream &&
  stream.active;

  let values = null;

  if(active){

    if(
      !spectrumData ||
      spectrumData.length !==
      analyser.frequencyBinCount
    ){

      spectrumData =
      new Uint8Array(
        analyser.frequencyBinCount
      );

    }

    analyser.getByteFrequencyData(
      spectrumData
    );

    values = spectrumData;

  }

  spectrumCtx.fillStyle = "#06b6d4";

  for(let i = 0; i < bars; i++){

    let level = 0;

    if(values){

      const usableBins =
      Math.floor(values.length * 0.7);

      const startBin =
      Math.floor(i * usableBins / bars);

      const endBin =
      Math.max(
        startBin + 1,
        Math.floor((i + 1) * usableBins / bars)
      );

      let sum = 0;

      for(let j = startBin; j < endBin; j++){

        sum += values[j];

      }

      level =
      sum / (endBin - startBin) / 255;

    }

    const barHeight =
    Math.max(2, level * height);

    spectrumCtx.fillRect(
      i * barWidth + 1,
      height - barHeight,
      barWidth - 2,
      barHeight
    );

  }

}

sizeSpectrum();

window.addEventListener(
  "resize",
  sizeSpectrum
);

requestAnimationFrame(drawSpectrum);

/* =========================
   HEAR YOURSELF (MONITOR)
   Routes the microphone to
   the speakers/headphones at
   half volume. Off by default.
   Use headphones — speakers
   cause echo and feedback.
========================= */

function disconnectMonitor(){

  if(monitorGain){

    try{

      if(monitorSource){

        monitorSource
        .disconnect(monitorGain);

      }

    }

    catch(error){

      console.error(error);

    }

    try{

      monitorGain.disconnect();

    }

    catch(error){

      console.error(error);

    }

    monitorGain = null;

  }

  monitorSource = null;

}

function applyMonitor(){

  const ready =
  microphone &&
  audioContext &&
  stream &&
  stream.active;

  if(monitorOn && ready){

    if(monitorSource !== microphone){

      disconnectMonitor();

      try{

        monitorGain =
        audioContext.createGain();

        monitorGain.gain.value = 0.5;

        microphone.connect(monitorGain);

        monitorGain.connect(
          audioContext.destination
        );

        monitorSource = microphone;

      }

      catch(error){

        console.error(error);

      }

    }

  }else if(!monitorOn){

    disconnectMonitor();

  }

}

if(monitorBtn){

  monitorBtn.addEventListener(
    "click",
    () => {

      monitorOn = !monitorOn;

      monitorBtn.setAttribute(
        "aria-pressed",
        monitorOn ? "true" : "false"
      );

      monitorBtn.classList
      .toggle("on", monitorOn);

      if(monitorBtnText){

        monitorBtnText.textContent =
        monitorOn ?
        "Hear Yourself: On" :
        "Hear Yourself: Off";

      }

      if(monitorStatus){

        if(monitorOn){

          monitorStatus.textContent =
          stream && stream.active ?
          "Monitor on — you should hear your own voice in your headphones." :
          "Start the mic test first, then turn on Hear Yourself.";

        }else{

          monitorStatus.textContent =
          "Monitor off.";

        }

      }

      applyMonitor();

    }
  );

}

/* =========================
   EXTRAS TICK
   Keeps the summary card in
   sync and re-applies the
   monitor after a restart.
========================= */

function extrasTick(){

  updateSummaryCard();

  applyMonitor();

}

updateSummaryCard();

refreshMicDevices();

setInterval(extrasTick, 500);
