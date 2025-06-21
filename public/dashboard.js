'use strict';

// Global Variables
const token = localStorage.getItem('token');
let model;
let currentStream;
let lastUploadTime = parseInt(localStorage.getItem('lastUploadTime')) || 0;
let cooldownInterval;

// 1. Authentication Check
if (!token) {
  window.location.href = 'login.html';
}

// 2. Main Initialization
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Init] Starting dashboard initialization...');
  
  try {
    // Load TensorFlow model first
    console.log('[Init] Loading AI model...');
    model = await tmImage.load('./model/model.json', './model/metadata.json');
    
    // Load all data in parallel
    console.log('[Init] Loading user data...');
    const [profile, history] = await Promise.all([
      loadUserProfile(),
      loadHistory()
    ]);
    
    // Update UI
    updateProfileUI(profile);
    updateHistoryUI(history);
    checkCooldown();
    setupEventListeners();
    
    // Enable upload button
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

// 3. Data Loading Functions
async function loadUserProfile() {
  try {
    console.log('[Profile] Fetching profile data...');
    const response = await fetch('https://greencoin-backend.onrender.com/api/user/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('[Profile] Data received:', data);
    return data;
  } catch (error) {
    console.error('[Profile Error]', error);
    return { // Fallback data
      name: 'Green User',
      email: 'user@example.com',
      coins: 0
    };
  }
}

async function loadHistory() {
  try {
    console.log('[History] Fetching history...');
    const response = await fetch('https://greencoin-backend.onrender.com/api/tree/history', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('[History] Data received:', data);
    return data;
  } catch (error) {
    console.error('[History Error]', error);
    return []; // Return empty array on error
  }
}

// 4. UI Update Functions
function updateProfileUI(data) {
  console.log('[UI] Updating profile UI with:', data);
  
  try {
    document.getElementById('userName').textContent = data.name || 'User';
    document.getElementById('userEmail').textContent = data.email || 'No email';
    document.getElementById('coinBalance').textContent = data.coins ?? '0';
  } catch (error) {
    console.error('[UI Error] Profile update failed:', error);
  }
}

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

// 5. Cooldown Functions
function checkCooldown() {
  const now = Date.now();
  const cooldownMs = 5 * 60 * 1000; // 5 minutes
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

// 6. Camera Functions
async function startCamera() {
  try {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }

    currentStream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' }
    });
    document.getElementById('video').srcObject = currentStream;
  } catch (error) {
    console.error('[Camera Error]', error);
    Swal.fire({
      title: 'Camera Error',
      text: 'Please enable camera permissions',
      icon: 'error'
    });
  }
}

// 7. Event Listeners
function setupEventListeners() {
  // Upload Button
  document.getElementById('uploadBtn').addEventListener('click', () => {
    document.getElementById('camera-section').style.display = 'block';
    startCamera();
  });

  // Capture Button
  document.getElementById('captureBtn').addEventListener('click', captureAndUpload);
}

// 8. Capture and Upload
async function captureAndUpload() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const predictionDiv = document.getElementById('modelPrediction');

  // Set canvas dimensions
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Add timestamp
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '16px Arial';
  ctx.fillText(new Date().toLocaleString(), 10, canvas.height - 10);

  // Verify with AI model
  predictionDiv.innerHTML = '<div class="spinner-border text-success"></div> Verifying...';
  
  try {
    const prediction = await model.predict(canvas);
    const isTree = prediction.some(p => 
      p.className.toLowerCase().includes('tree') && 
      p.probability > 0.7
    );

    if (!isTree) {
      predictionDiv.innerHTML = `
        <div class="alert alert-danger animate__animated animate__shakeX">
          <i class="bi bi-exclamation-triangle"></i> This doesn't appear to be a tree
        </div>
      `;
      return;
    }

    // Upload the image
    await uploadImage(canvas);
  } catch (error) {
    console.error('[Upload Error]', error);
    predictionDiv.innerHTML = `
      <div class="alert alert-danger animate__animated animate__shakeX">
        <i class="bi bi-exclamation-triangle"></i> ${error.message || 'Upload failed'}
      </div>
    `;
  }
}

async function uploadImage(canvas) {
  const swal = Swal.fire({
    title: 'Uploading...',
    html: 'Please wait while we process your tree',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9);
    });

    const formData = new FormData();
    formData.append('photo', blob, 'tree.jpg');

    const response = await fetch('https://greencoin-backend.onrender.com/api/tree/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    // Update last upload time
    lastUploadTime = Date.now();
    localStorage.setItem('lastUploadTime', lastUploadTime.toString());

    await swal.close();
    Swal.fire({
      title: 'Success!',
      text: 'Tree uploaded and verified',
      icon: 'success'
    }).then(() => window.location.reload());
  } catch (error) {
    await swal.close();
    throw error;
  }
}
