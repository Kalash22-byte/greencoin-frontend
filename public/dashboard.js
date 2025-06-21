// Check if user is logged in
if (!localStorage.getItem('token')) {
  window.location.href = 'login.html';
}

// Teachable Machine Model URL
const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/12waan13f/';

// Variables for upload cooldown
let lastUploadTime = localStorage.getItem('lastUploadTime') || 0;
let cooldownInterval;

// Initialize model
let model;

async function initModel() {
  try {
    const modelURL = MODEL_URL + 'model.json';
    const metadataURL = MODEL_URL + 'metadata.json';
    
    model = await tmImage.load(modelURL, metadataURL);
    console.log('Model loaded successfully');
  } catch (error) {
    console.error('Error loading model:', error);
    Swal.fire("Model Error", "Could not load verification model. Please try again later.", "error");
  }
}

// Initialize the dashboard
async function initDashboard() {
  await initModel();
  checkCooldown();
  loadUserProfile();
  loadHistory();
}

// Check upload cooldown
function checkCooldown() {
  const now = Date.now();
  const cooldownPeriod = 5 * 60 * 1000; // 5 minutes in milliseconds
  const timeSinceLastUpload = now - lastUploadTime;
  
  if (timeSinceLastUpload < cooldownPeriod) {
    const remainingTime = cooldownPeriod - timeSinceLastUpload;
    startCooldownTimer(remainingTime);
    document.getElementById('uploadBtn').disabled = true;
    document.getElementById('cooldownInfo').classList.remove('d-none');
  }
}

function startCooldownTimer(remainingTime) {
  clearInterval(cooldownInterval);
  
  function updateTimer() {
    const minutes = Math.floor(remainingTime / 60000);
    const seconds = Math.floor((remainingTime % 60000) / 1000);
    document.getElementById('cooldownTimer').textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    
    if (remainingTime <= 0) {
      clearInterval(cooldownInterval);
      document.getElementById('uploadBtn').disabled = false;
      document.getElementById('cooldownInfo').classList.add('d-none');
    } else {
      remainingTime -= 1000;
    }
  }
  
  updateTimer();
  cooldownInterval = setInterval(updateTimer, 1000);
}

// Fetch user data from API
function loadUserProfile() {
  fetch('https://greencoin-backend.onrender.com/api/user/profile', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  })
  .then(res => res.json())
  .then(data => {
    document.getElementById('userName').textContent = data.name;
    document.getElementById('userEmail').textContent = data.email;
    document.getElementById('coinBalance').textContent = data.coins;
  })
  .catch(() => {
    Swal.fire("Error", "Could not load user profile.", "error");
  });
}

// Load user history
function loadHistory() {
  fetch('https://greencoin-backend.onrender.com/api/tree/history', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  })
  .then(res => res.json())
  .then(data => {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';
    
    if (data.length === 0) {
      historyList.innerHTML = '<div class="text-center py-3 text-muted">No upload history yet</div>';
      return;
    }
    
    data.forEach(item => {
      const date = new Date(item.timestamp);
      const historyItem = document.createElement('div');
      historyItem.className = 'list-group-item history-item mb-2';
      historyItem.innerHTML = `
        <div class="d-flex justify-content-between">
          <div>
            <h6 class="mb-1">Tree Upload</h6>
            <small class="text-muted">${date.toLocaleString()}</small>
          </div>
          <div class="text-success">
            +${item.coinsEarned} <i class="bi bi-coin"></i>
          </div>
        </div>
      `;
      historyList.appendChild(historyItem);
    });
  })
  .catch(() => {
    document.getElementById('historyList').innerHTML = '<div class="text-center py-3 text-danger">Failed to load history</div>';
  });
}

// Camera controls
let currentStream;
let currentCameraIndex = 0;
let videoDevices = [];

async function getVideoDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  videoDevices = devices.filter(device => device.kind === 'videoinput');
}

async function startCamera(deviceId = null) {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }
  const constraints = {
    video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" },
    audio: false
  };
  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    document.getElementById("video").srcObject = currentStream;
  } catch (err) {
    Swal.fire("Camera Error", err.message, "error");
  }
}

document.getElementById("uploadBtn").addEventListener("click", () => {
  document.getElementById("camera-section").style.display = "block";
  startCamera();
});

document.getElementById("switchCameraBtn").addEventListener("click", async () => {
  currentCameraIndex = (currentCameraIndex + 1) % videoDevices.length;
  await startCamera(videoDevices[currentCameraIndex].deviceId);
});

document.getElementById("captureBtn").addEventListener("click", async () => {
  const canvas = document.getElementById("canvas");
  const video = document.getElementById("video");
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.font = "20px Arial";
  ctx.fillText(new Date().toLocaleString(), 10, canvas.height - 10);

  // Verify with Teachable Machine model
  const predictionDiv = document.getElementById("modelPrediction");
  predictionDiv.innerHTML = '<div class="spinner-border text-success" role="status"><span class="visually-hidden">Verifying...</span></div>';
  
  try {
    const prediction = await model.predict(canvas);
    const isTree = prediction.some(p => p.className.toLowerCase().includes('tree') && p.probability > 0.7);
    
    if (!isTree) {
      predictionDiv.innerHTML = '<div class="alert alert-danger">This doesn\'t appear to be a tree. Please try again.</div>';
      return;
    }
    
    predictionDiv.innerHTML = '<div class="alert alert-success">Tree verified! Uploading...</div>';
    
    Swal.fire({
      title: 'Uploading...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append("photo", blob, "tree.jpg");

      const res = await fetch("https://greencoin-backend.onrender.com/api/tree/upload", {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      Swal.close();

      if (res.ok) {
        // Set cooldown
        lastUploadTime = Date.now();
        localStorage.setItem('lastUploadTime', lastUploadTime);
        checkCooldown();
        
        Swal.fire("✅ Success", "Tree uploaded & coin added!", "success");
        setTimeout(() => {
          window.location.reload();
          loadHistory();
        }, 1500);
      } else {
        Swal.fire("❌ Upload Failed", "Please try again.", "error");
      }
    }, 'image/jpeg');
  } catch (error) {
    console.error('Prediction error:', error);
    predictionDiv.innerHTML = '<div class="alert alert-warning">Verification failed. Please try again.</div>';
  }
});

// Check for #upload in URL and auto-trigger upload section
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.hash === '#upload') {
    document.getElementById('uploadBtn').click();
    setTimeout(() => {
      document.getElementById('camera-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 500);
  }
  
  // Initialize dashboard
  initDashboard();
  getVideoDevices();
});
