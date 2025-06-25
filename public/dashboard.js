'use strict';

// Global Variables
const token = localStorage.getItem('token');
let model;
let currentStream;
let lastUploadTime = parseInt(localStorage.getItem('lastUploadTime')) || 0;
let cooldownInterval;

// Redirect if not authenticated
if (!token) {
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Init] Starting dashboard initialization...');

  try {
    model = await tmImage.load(
      'https://teachablemachine.withgoogle.com/models/cfn939LYh/model.json',
      'https://teachablemachine.withgoogle.com/models/cfn939LYh/metadata.json'
    );
    console.log('[Init] AI model loaded:', model.modelName || 'CustomMobileNet');

    const [profile, history] = await Promise.all([
      loadUserProfile(),
      loadHistory()
    ]);

    updateProfileUI(profile);
    updateHistoryUI(history);
    checkCooldown();
    setupEventListeners();

    document.getElementById('uploadBtn').disabled = false;
    console.log('[Init] Dashboard ready');
  } catch (error) {
    console.error('[Init Error]', error);
    Swal.fire({
      title: 'Initialization Error',
      text: error.message || 'Failed to load dashboard',
      icon: 'error'
    });
  }
});

// Fetch user profile
async function loadUserProfile() {
  try {
    const res = await fetch('https://greencoin-backend.onrender.com/api/user/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.user;
  } catch (error) {
    console.error('[Profile Error]', error);
    return { name: 'Green User', email: 'user@example.com', coins: 0 };
  }
}

// Fetch history
async function loadHistory() {
  try {
    const res = await fetch('https://greencoin-backend.onrender.com/api/tree/history', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.history || [];
  } catch (error) {
    console.error('[History Error]', error);
    return [];
  }
}

// Update profile UI
function updateProfileUI(data) {
  document.getElementById('userName').textContent = data.name || 'User';
  document.getElementById('userEmail').textContent = data.email || 'Email';
  document.getElementById('coinBalance').textContent = data.coins ?? '0';
}

// Update history UI
function updateHistoryUI(items) {
  const container = document.getElementById('historyList');
  if (!container) return;

  try {
    container.innerHTML = items.length ? items.map(item => `
      <div class="list-group-item animate__animated animate__fadeIn">
        <div class="d-flex justify-content-between">
          <div>
            <h6 class="mb-1">${item.type || 'Tree Upload'}</h6>
            <small class="text-muted">${new Date(item.timestamp).toLocaleString()}</small>
          </div>
          <div class="text-success">+${item.coinsEarned || 0} <i class="bi bi-coin"></i></div>
        </div>
      </div>
    `).join('') : '<div class="text-center py-3 text-muted">No history yet</div>';
  } catch (error) {
    console.error('[UI Error] History update failed:', error);
    container.innerHTML = '<div class="alert alert-danger">Failed to load history</div>';
  }
}

// Cooldown Logic
function checkCooldown() {
  const now = Date.now();
  const cooldownMs = 5 * 60 * 1000;
  const remaining = lastUploadTime + cooldownMs - now;

  if (remaining > 0) {
    document.getElementById('uploadBtn').disabled = true;
    document.getElementById('cooldownInfo').classList.remove('d-none');
    startCooldownTimer(remaining);
  }
}

function startCooldownTimer(ms) {
  clearInterval(cooldownInterval);
  const timerElement = document.getElementById('cooldownTimer');
  if (!timerElement) return;

  const update = () => {
    const seconds = Math.round(ms / 1000);
    if (seconds <= 0) {
      clearInterval(cooldownInterval);
      document.getElementById('uploadBtn').disabled = false;
      document.getElementById('cooldownInfo').classList.add('d-none');
      return;
    }

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerElement.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    ms -= 1000;
  };

  update();
  cooldownInterval = setInterval(update, 1000);
}

// Camera Setup
async function startCamera() {
  try {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }

    currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    document.getElementById('video').srcObject = currentStream;
  } catch (error) {
    console.error('[Camera Error]', error);
    Swal.fire({ title: 'Camera Error', text: 'Please enable camera access', icon: 'error' });
  }
}

// Button Event Handlers
function setupEventListeners() {
  document.getElementById('uploadBtn').addEventListener('click', () => {
    document.getElementById('camera-section').style.display = 'block';
    startCamera();
  });

  document.getElementById('captureBtn').addEventListener('click', captureAndUpload);
}

// AI + Upload
async function captureAndUpload() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const predictionDiv = document.getElementById('modelPrediction');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '16px Arial';
  ctx.fillText(new Date().toLocaleString(), 10, canvas.height - 10);

  predictionDiv.innerHTML = '<div class="spinner-border text-success"></div> Verifying...';

  try {
    const predictions = await model.predict(canvas);
    console.log('[AI] Prediction results:', predictions);

    predictionDiv.innerHTML = predictions.map(p => `
      <div>${p.className}: ${(p.probability * 100).toFixed(1)}%</div>
    `).join('');

    const isTree = predictions.some(p =>
      p.className.trim().toLowerCase() === 'tree' && p.probability > 0.7
    );

    if (!isTree) {
      predictionDiv.innerHTML += `
        <div class="alert alert-danger mt-2 animate__animated animate__shakeX">
          <i class="bi bi-exclamation-triangle"></i> Tree not detected — upload blocked
        </div>
      `;
      console.warn('[AI] Tree not detected — Upload blocked');
      return;
    }

    await uploadImage(canvas);
  } catch (error) {
    console.error('[Prediction Error]', error);
    predictionDiv.innerHTML = `
      <div class="alert alert-danger animate__animated animate__shakeX">
        <i class="bi bi-exclamation-triangle"></i> ${error.message || 'Prediction failed'}
      </div>
    `;
  }
}

// Upload Tree Photo
async function uploadImage(canvas) {
  const swal = Swal.fire({
    title: 'Uploading...',
    html: 'Processing your tree image...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));

    const formData = new FormData();
    formData.append('photo', blob, 'tree.jpg');

    const response = await fetch('https://greencoin-backend.onrender.com/api/tree/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!response.ok) throw new Error(await response.text());

    lastUploadTime = Date.now();
    localStorage.setItem('lastUploadTime', lastUploadTime.toString());

    await swal.close();
    Swal.fire({ title: 'Success!', text: 'Tree uploaded and verified ✅', icon: 'success' })
      .then(() => window.location.reload());
  } catch (error) {
    await swal.close();
    console.error('[Upload Error]', error);
    Swal.fire({ title: 'Upload Failed', text: error.message || 'Unknown error', icon: 'error' });
  }
}
