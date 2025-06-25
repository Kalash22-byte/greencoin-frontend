const backendUrl = 'https://greencoin-backend.onrender.com';
const modelURL = 'https://teachablemachine.withgoogle.com/models/cfn939LYh/';

let model, currentStream;
let cooldownInterval;
let usingFrontCamera = false;
const cooldownSeconds = 300;

// DOM Elements
const userNameEl = document.getElementById('userName');
const userEmailEl = document.getElementById('userEmail');
const coinBalanceEl = document.getElementById('coinBalance');
const historyListEl = document.getElementById('historyList');
const uploadBtn = document.getElementById('uploadBtn');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const captureBtn = document.getElementById('captureBtn');
const retryBtn = document.getElementById('retryBtn');
const submitBtn = document.getElementById('submitBtn');
const cameraSection = document.getElementById('camera-section');
const predictionResults = document.getElementById('predictionResults');
const modelPrediction = document.getElementById('modelPrediction');
const cooldownInfo = document.getElementById('cooldownInfo');
const cooldownTimer = document.getElementById('cooldownTimer');
const imagePreview = document.getElementById('image-preview');

// Load Profile
async function loadUserProfile() {
  try {
    const res = await fetch(`${backendUrl}/api/user/profile`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    userNameEl.textContent = data.user.name;
    userEmailEl.textContent = data.user.email;
    coinBalanceEl.textContent = data.user.coins;
  } catch (err) {
    console.error(err);
    Swal.fire('Error', 'Failed to load profile', 'error');
  }
}

// Load History
async function loadUploadHistory() {
  try {
    const res = await fetch(`${backendUrl}/api/tree/history`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    historyListEl.innerHTML = '';
    data.history.forEach(item => {
      const div = document.createElement('div');
      div.innerHTML = `<small>${new Date(item.timestamp).toLocaleString()}</small><br><img src="${item.imageUrl}" class="history-img" />`;
      historyListEl.appendChild(div);
    });
  } catch (err) {
    console.error(err);
  }
}

// Camera Functions
function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: usingFrontCamera ? 'user' : 'environment' } })
    .then(stream => {
      currentStream = stream;
      video.srcObject = stream;
      cameraSection.style.display = 'block';
      predictionResults.style.display = 'none';
      imagePreview.style.display = 'none';
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
  const ts = new Date().toLocaleString();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(10, height - 40, ctx.measureText(ts).width + 20, 30);
  ctx.fillStyle = '#fff';
  ctx.font = '20px Poppins';
  ctx.fillText(ts, 20, height - 20);
}

// AI Verification
async function runVerification() {
  const img = tf.browser.fromPixels(canvas);
  const prediction = await model.predict(img.expandDims(0));
  const classIdx = prediction.argMax(-1).dataSync()[0];
  const confidence = prediction.max().dataSync()[0];
  const label = model.getClassLabels()[classIdx];
  modelPrediction.innerHTML = `Label: <strong>${label}</strong><br>Confidence: <strong>${(confidence * 100).toFixed(1)}%</strong>`;
  predictionResults.style.display = 'block';

  return label.toLowerCase().includes('tree') && confidence > 0.85;
}

// Image Capture
async function captureImage() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  overlayTimestamp(ctx, canvas.width, canvas.height);
  imagePreview.innerHTML = `<img src="${canvas.toDataURL('image/png')}" class="img-fluid rounded mt-2"/>`;

  const isTree = await runVerification();
  submitBtn.disabled = !isTree;
  imagePreview.style.display = 'block';
}

// Upload Tree Image
function uploadImage() {
  canvas.toBlob(async blob => {
    const formData = new FormData();
    formData.append('image', blob, 'tree.png');
    try {
      const res = await fetch(`${backendUrl}/api/tree/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      Swal.fire('Uploaded!', 'Tree uploaded successfully.', 'success');
      stopCamera();
      cameraSection.style.display = 'none';
      startCooldown();
      await loadUserProfile();
      await loadUploadHistory();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message, 'error');
    }
  }, 'image/png');
}

// Cooldown Timer
function startCooldown() {
  let timeLeft = cooldownSeconds;
  cooldownInfo.style.display = 'block';
  cooldownInterval = setInterval(() => {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    cooldownTimer.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    if (timeLeft-- <= 0) {
      clearInterval(cooldownInterval);
      cooldownInfo.style.display = 'none';
    }
  }, 1000);
}

// Load AI Model
async function initTeachableMachine() {
  model = await tmImage.load(modelURL + 'model.json', modelURL + 'metadata.json');
  console.log('✅ Teachable Machine model loaded');
}

// Event Listeners
uploadBtn.addEventListener('click', startCamera);
captureBtn.addEventListener('click', captureImage);
retryBtn.addEventListener('click', () => { stopCamera(); startCamera(); });
submitBtn.addEventListener('click', uploadImage);

// Init
window.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile();
  await loadUploadHistory();
  await initTeachableMachine();
});
