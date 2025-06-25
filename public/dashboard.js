const backendUrl = 'https://greencoin-backend.onrender.com';
const modelURL = 'https://teachablemachine.withgoogle.com/models/cfn939LYh/';

let model, stream;
let cooldownTime = 5 * 60;
let cooldownInterval;

const userNameEl = document.getElementById('userName');
const userEmailEl = document.getElementById('userEmail');
const coinBalanceEl = document.getElementById('coinBalance');
const uploadBtn = document.getElementById('uploadBtn');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const imagePreview = document.getElementById('image-preview');
const captureBtn = document.getElementById('captureBtn');
const retryBtn = document.getElementById('retryBtn');
const submitBtn = document.getElementById('submitBtn');
const predictionResults = document.getElementById('predictionResults');
const modelPrediction = document.getElementById('modelPrediction');
const cooldownInfo = document.getElementById('cooldownInfo');
const cooldownTimer = document.getElementById('cooldownTimer');
const cameraSection = document.getElementById('camera-section');
const historyListEl = document.getElementById('historyList');

async function loadUserProfile() {
  const token = localStorage.getItem('token');
  const res = await fetch(`${backendUrl}/api/user/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  userNameEl.textContent = data.user.name;
  userEmailEl.textContent = data.user.email;
  coinBalanceEl.textContent = data.user.coins;
}

async function loadUploadHistory() {
  const token = localStorage.getItem('token');
  const res = await fetch(`${backendUrl}/api/tree/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  historyListEl.innerHTML = '';
  data.history.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `<strong>${new Date(entry.timestamp).toLocaleString()}</strong><br><img src="${entry.imageUrl}" width="200" class="mt-2 rounded">`;
    historyListEl.appendChild(div);
  });
}

function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(s => {
      stream = s;
      video.srcObject = stream;
      cameraSection.style.display = 'block';
      retryBtn.style.display = 'none';
      submitBtn.style.display = 'none';
      imagePreview.style.display = 'none';
    })
    .catch(err => {
      console.error('Camera error:', err);
      Swal.fire('Camera Error', err.message, 'error');
    });
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  video.srcObject = null;
}

function overlayTimestamp(ctx, width, height) {
  const timestamp = new Date().toLocaleString();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(10, height - 40, 280, 30);
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
  imagePreview.src = canvas.toDataURL();
  imagePreview.style.display = 'block';
  retryBtn.style.display = 'inline-block';
  submitBtn.style.display = 'inline-block';
  captureBtn.style.display = 'none';
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

function startCooldown() {
  let timeLeft = cooldownTime;
  cooldownInfo.style.display = 'block';
  cooldownInterval = setInterval(() => {
    const min = Math.floor(timeLeft / 60);
    const sec = timeLeft % 60;
    cooldownTimer.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
    if (timeLeft-- <= 0) {
      clearInterval(cooldownInterval);
      cooldownInfo.style.display = 'none';
    }
  }, 1000);
}

async function uploadImage() {
  const token = localStorage.getItem('token');
  canvas.toBlob(async blob => {
    const formData = new FormData();
    formData.append('image', blob, 'tree.png');
    const res = await fetch(`${backendUrl}/api/tree/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    Swal.fire('Success', 'Tree uploaded successfully!', 'success');
    stopCamera();
    cameraSection.style.display = 'none';
    loadUserProfile();
    loadUploadHistory();
    startCooldown();
  }, 'image/png');
}

async function initModel() {
  model = await tmImage.load(modelURL + 'model.json', modelURL + 'metadata.json');
  console.log('✅ Teachable Machine model loaded');
}

// Event listeners
uploadBtn.addEventListener('click', startCamera);
captureBtn.addEventListener('click', captureImage);
retryBtn.addEventListener('click', () => {
  stopCamera();
  startCamera();
});
submitBtn.addEventListener('click', uploadImage);

window.addEventListener('DOMContentLoaded', async () => {
  await initModel();
  await loadUserProfile();
  await loadUploadHistory();
});
