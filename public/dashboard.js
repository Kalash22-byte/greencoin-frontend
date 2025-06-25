// dashboard.js (Final Clean Version)
const backendUrl = 'https://greencoin-backend.onrender.com';
const modelURL = 'https://teachablemachine.withgoogle.com/models/cfn939LYh/';

let model;
let currentStream;
let cooldownTime = 5 * 60;
let cooldownInterval;

const userNameEl = document.getElementById('userName');
const userEmailEl = document.getElementById('userEmail');
const coinBalanceEl = document.getElementById('coinBalance');
const historyListEl = document.getElementById('historyList');

const uploadBtn = document.getElementById('uploadBtn');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const imagePreview = document.getElementById('image-preview');
const predictionResults = document.getElementById('predictionResults');
const modelPrediction = document.getElementById('modelPrediction');
const captureBtn = document.getElementById('captureBtn');
const retryBtn = document.getElementById('retryBtn');
const submitBtn = document.getElementById('submitBtn');
const cooldownInfo = document.getElementById('cooldownInfo');
const cooldownTimer = document.getElementById('cooldownTimer');

async function loadUserProfile() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${backendUrl}/api/user/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    userNameEl.textContent = data.user.name;
    userEmailEl.textContent = data.user.email;
    coinBalanceEl.textContent = data.user.coins;
  } catch (err) {
    console.error('Profile fetch error:', err);
  }
}

async function loadUploadHistory() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${backendUrl}/api/tree/history`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    historyListEl.innerHTML = '';
    data.history.forEach(item => {
      const div = document.createElement('div');
      div.innerHTML = `<p><strong>${new Date(item.timestamp).toLocaleString()}</strong></p><img src="${item.imageUrl}" class="img-fluid rounded mb-2" width="200">`;
      historyListEl.appendChild(div);
    });
  } catch (err) {
    console.error('History fetch error:', err);
  }
}

function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      currentStream = stream;
      video.srcObject = stream;
      document.getElementById('camera-section').style.display = 'block';
    })
    .catch(err => {
      console.error('Camera error:', err);
      Swal.fire('Camera Error', err.message, 'error');
    });
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
}

function overlayTimestamp(ctx, width, height) {
  const timestamp = new Date().toLocaleString();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(10, height - 40, ctx.measureText(timestamp).width + 20, 30);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText(timestamp, 20, height - 20);
}

async function captureImage() {
  const width = video.videoWidth;
  const height = video.videoHeight;
  canvas.width = width;
  canvas.height = height;
  context.drawImage(video, 0, 0, width, height);
  overlayTimestamp(context, width, height);
  imagePreview.src = canvas.toDataURL('image/png');
  imagePreview.style.display = 'block';
  await runVerification();
  captureBtn.style.display = 'none';
  retryBtn.style.display = 'inline-block';
  submitBtn.style.display = 'inline-block';
}

async function runVerification() {
  const image = tf.browser.fromPixels(canvas);
  const prediction = await model.predict(image.expandDims(0));
  const labelIndex = prediction.argMax(-1).dataSync()[0];
  const confidence = prediction.max().dataSync()[0];
  const label = model.getClassLabels()[labelIndex];
  modelPrediction.innerHTML = `Label: ${label} <br> Confidence: ${(confidence * 100).toFixed(2)}%`;
  predictionResults.style.display = 'block';
}

function startCooldown() {
  let timeLeft = cooldownTime;
  cooldownInfo.style.display = 'block';
  cooldownInterval = setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    cooldownTimer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    if (--timeLeft < 0) {
      clearInterval(cooldownInterval);
      cooldownInfo.style.display = 'none';
    }
  }, 1000);
}

function uploadImage() {
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      Swal.fire('Success', 'Tree uploaded successfully!', 'success');
      stopCamera();
      document.getElementById('camera-section').style.display = 'none';
      loadUserProfile();
      loadUploadHistory();
      startCooldown();
    } catch (err) {
      Swal.fire('Upload Failed', err.message, 'error');
    }
  }, 'image/png');
}

async function initTeachableMachine() {
  model = await tmImage.load(modelURL + 'model.json', modelURL + 'metadata.json');
  console.log('✅ Model loaded');
}

uploadBtn.addEventListener('click', startCamera);
captureBtn.addEventListener('click', captureImage);
retryBtn.addEventListener('click', () => {
  imagePreview.style.display = 'none';
  captureBtn.style.display = 'inline-block';
  retryBtn.style.display = 'none';
  submitBtn.style.display = 'none';
  predictionResults.style.display = 'none';
});
submitBtn.addEventListener('click', uploadImage);

window.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile();
  await loadUploadHistory();
  await initTeachableMachine();
});
