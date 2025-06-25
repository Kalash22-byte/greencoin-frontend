// dashboard.js (Final Version - Fixed & Enhanced)

const backendUrl = 'https://greencoin-backend.onrender.com';
const modelURL = 'https://teachablemachine.withgoogle.com/models/cfn939LYh/';

let model;
let cooldownTime = 5 * 60; // 5 minutes
let cooldownInterval;
let currentStream;
let usingFrontCamera = true;

// DOM Elements
const userNameEl = document.getElementById('userName');
const userEmailEl = document.getElementById('userEmail');
const coinBalanceEl = document.getElementById('coinBalance');
const historyListEl = document.getElementById('historyList');
const uploadBtn = document.getElementById('uploadBtn');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const predictionResults = document.getElementById('predictionResults');
const modelPrediction = document.getElementById('modelPrediction');
const retryBtn = document.getElementById('retryBtn');
const captureBtn = document.getElementById('captureBtn');
const cameraSection = document.getElementById('camera-section');
const cooldownInfo = document.getElementById('cooldownInfo');
const cooldownTimer = document.getElementById('cooldownTimer');
const submitBtn = document.getElementById('submitBtn');
const imagePreview = canvas; // reuse canvas for preview

async function loadUserProfile() {
  const token = localStorage.getItem('token');
  if (!token) return Swal.fire('Unauthorized', 'Please log in again.', 'error');
  try {
    const res = await fetch(`${backendUrl}/api/user/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }
    const data = await res.json();
    userNameEl.textContent = data.user.name;
    userEmailEl.textContent = data.user.email;
    coinBalanceEl.textContent = data.user.coins;
  } catch (err) {
    console.error(err);
    Swal.fire('Error', err.message, 'error');
  }
}

async function loadUploadHistory() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${backendUrl}/api/tree/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }
    const data = await res.json();
    historyListEl.innerHTML = '';
    data.history.forEach(item => {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `<strong>${new Date(item.timestamp).toLocaleString()}</strong><br><img src="${item.imageUrl}" width="200" class="mt-2 rounded">`;
      historyListEl.appendChild(div);
    });
  } catch (err) {
    console.error('Failed to load history', err);
  }
}

function startCamera() {
  const constraints = {
    video: { facingMode: usingFrontCamera ? 'user' : 'environment' }
  };
  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      currentStream = stream;
      video.srcObject = stream;
      cameraSection.style.display = 'block';
      predictionResults.style.display = 'none';
      captureBtn.style.display = 'inline-block';
      retryBtn.style.display = 'none';
      submitBtn.style.display = 'none';
    })
    .catch(err => {
      console.error('Camera error:', err);
      Swal.fire('Camera Error', err.message, 'error');
    });
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  video.srcObject = null;
}

function overlayTimestamp(ctx, width, height) {
  const timestamp = new Date().toLocaleString();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(10, height - 40, ctx.measureText(timestamp).width + 20, 30);
  ctx.fillStyle = '#fff';
  ctx.font = '20px Poppins';
  ctx.fillText(timestamp, 20, height - 20);
}

async function captureImage() {
  const width = video.videoWidth;
  const height = video.videoHeight;
  canvas.width = width;
  canvas.height = height;
  context.drawImage(video, 0, 0, width, height);
  overlayTimestamp(context, width, height);
  captureBtn.style.display = 'none';
  retryBtn.style.display = 'inline-block';
  submitBtn.style.display = 'inline-block';
  await runVerification();
}

async function runVerification() {
  const image = tf.browser.fromPixels(canvas);
  const prediction = await model.predict(image.expandDims(0));
  const classIdx = prediction.argMax(-1).dataSync()[0];
  const confidence = prediction.max().dataSync()[0];
  const label = model.getClassLabels()[classIdx];
  modelPrediction.innerHTML = `<strong>Label:</strong> ${label}<br><strong>Confidence:</strong> ${(confidence * 100).toFixed(2)}%`;
  predictionResults.style.display = 'block';
  submitBtn.disabled = !(label.toLowerCase().includes('tree') && confidence > 0.85);
}

async function uploadImage() {
  const token = localStorage.getItem('token');
  canvas.toBlob(async blob => {
    const formData = new FormData();
    formData.append('image', blob, 'tree.png');
    try {
      const res = await fetch(`${backendUrl}/api/tree/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      const data = await res.json();
      Swal.fire('Success', 'Tree uploaded successfully!', 'success');
      stopCamera();
      cameraSection.style.display = 'none';
      startCooldown();
      loadUserProfile();
      loadUploadHistory();
    } catch (err) {
      console.error(err);
      Swal.fire('Upload Failed', err.message, 'error');
    }
  }, 'image/png');
}

function startCooldown() {
  let timeLeft = cooldownTime;
  cooldownInfo.style.display = 'block';
  const updateCooldown = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    cooldownTimer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    if (timeLeft-- <= 0) {
      clearInterval(cooldownInterval);
      cooldownInfo.style.display = 'none';
    }
  };
  updateCooldown();
  cooldownInterval = setInterval(updateCooldown, 1000);
}

async function initTeachableMachine() {
  const modelURLPath = modelURL + 'model.json';
  model = await tmImage.load(modelURLPath, modelURL + 'metadata.json');
  console.log('✅ Teachable Machine model loaded');
}

// Event Listeners
uploadBtn.addEventListener('click', startCamera);
captureBtn.addEventListener('click', captureImage);
retryBtn.addEventListener('click', () => {
  stopCamera();
  startCamera();
});
submitBtn.addEventListener('click', uploadImage);

window.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile();
  await loadUploadHistory();
  await initTeachableMachine();
});
