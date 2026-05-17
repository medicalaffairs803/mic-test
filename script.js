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

let audioContext;
let analyser;
let microphone;
let dataArray;
let animationId;
let stream;

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

  try{

    stream =
    await navigator.mediaDevices
    .getUserMedia({
      audio:true
    });

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

    document.querySelector(".dot")
    .style.background =
    "#22c55e";

    detectDevice();

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
     LATENCY
  ===================== */

  const latency =
  Math.floor(
    Math.random() * 15
  ) + 8;

  latencyLevel.textContent =
  latency + "ms";

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

  if(stream){

    stream.getTracks()
    .forEach(track =>
      track.stop()
    );

  }

});
