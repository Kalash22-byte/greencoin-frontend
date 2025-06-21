// ✅ 1. Redirect if not logged in
if (!localStorage.getItem('token')) {
  window.location.href = 'login.html';
}

// ✅ 2. Teachable Machine model (local or hosted)
const MODEL_URL = './model/';
let model;

// ✅ 3. Upload cooldown variables
let lastUploadTime = localStorage.getItem('lastUploadTime') || 0;
let cooldownInterval;

// ✅ 4. Initialize everything
document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
  getVideoDevices();

  // Auto-open camera if hash is #upload
  if (window.location.hash === '#upload') {
    document.getElementById('uploadBtn').click();
    setTimeout(() => {
      document.getElementById('camera-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 500);
  }
});

// ✅ 5. Initialize dashboard
async function initDashboard() {
  await loadModel();
  checkCooldown();
  loadUserProfile();
  loadHistory();
}

// ✅ 6. Load Teachable Machine model
async function loadModel() {
  try {
    model = await tmImage.load(MODEL_URL + 'model.json', MODEL_URL + 'metadata.json');
    console.log('Model loaded successfully');
  } catch (err) {
    console.error('Model load error:', err);
    Swal.fire("Model Error", "Could not load verification model. Please try again later.", "error");
  }
}

// ✅ 7. Load user profile (UPDATED)
function loadUserProfile() {
  fetch('https://greencoin-backend.onrender.com/api/user/profile', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  })
  .then(res => res.json())
  .then(data => {
    console.log("✅ PROFILE DATA:", data);

    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    const coinEl = document.getElementById('coinBalance');

    if (!nameEl || !emailEl || !coinEl) {
      console.error("❌ One or more elements not found in HTML.");
      return;
    }

    nameEl.textContent = data.name || 'Green User';
    emailEl.textContent = data.email || 'example@green.com';
    coinEl.textContent = data.coins ?? '0'; // use ?? to allow 0
  })
  .catch(err => {
    console.error("❌ Error loading profile:", err);
    Swal.fire("Error", "Could not load user profile.", "error");
  });
}


// ✅ 8. Load upload history
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

    if (!data.length) {
      historyList.innerHTML = '<div class="text-center py-3 text-muted">No upload history yet</div>';
      return;
    }

    data.forEach(item => {
      const date = new Date(item.timestamp);
      const div = document.createElement('div');
      div.className = 'list-group-item mb-2';
      div.innerHTML = `
        <div class="d-flex justify-content-between">
          <div>
            <h6 class="mb-1">Tree Upload</h6>
            <small class="text-muted">${date.toLocaleString()}</small>
          </div>
          <div class="text-success">+${item.coinsEarned} <i class="bi bi-coin"></i></div>
        </div>
      `;
      historyList.appendChild(div);
    });
  })
  .catch(() => {
    document.getElementById('historyList').innerHTML = '<div class="text-danger text-center">Failed to load history</div>';
  });
}

// ✅ 9. Cooldown check (5 mins)
function checkCooldown() {
  const now = Date.now();
  const cooldown = 5 * 60 * 1000;
  const since = now - lastUploadTime;

  if (since < cooldown) {
    const left = cooldown - since;
    startCooldownTimer(left);
    document.getElementById('uploadBtn').disabled = true;
    document.getElementById('cooldownInfo')?.classList.remove('d-none');
  }
}

function startCooldownTimer(ms) {
  clearInterval(cooldownInterval);

  function update() {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    document.getElementById('cooldownTimer').textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    if (ms <= 0) {
      clearInterval(cooldownInterval);
      document.getElementById('uploadBtn').disabled = false;
      document.getElementById('cooldownInfo')?.classList.add('d-none');
    } else {
      ms -= 1000;
    }
  }

  update();
  cooldownInterval = setInterval(update, 1000);
}

// ✅ 10. Camera handling
let currentStream;
let currentCameraIndex = 0;
let videoDevices = [];

async function getVideoDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  videoDevices = devices.filter(d => d.kind === 'videoinput');
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

// ✅ 11. Capture, verify & upload
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

  const predictionDiv = document.getElementById("modelPrediction");
  predictionDiv.innerHTML = '<div class="spinner-border text-success"></div>';

  try {
    const prediction = await model.predict(canvas);
    const isTree = prediction.some(p => p.className.toLowerCase().includes("tree") && p.probability > 0.7);

    if (!isTree) {
      predictionDiv.innerHTML = '<div class="alert alert-danger">This doesn\'t appear to be a tree.</div>';
      return;
    }

    predictionDiv.innerHTML = '<div class="alert alert-success">Tree verified! Uploading...</div>';

    Swal.fire({ title: 'Uploading...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

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
        lastUploadTime = Date.now();
        localStorage.setItem('lastUploadTime', lastUploadTime);
        checkCooldown();
        Swal.fire("✅ Success", "Tree uploaded & coin added!", "success");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        Swal.fire("❌ Upload Failed", "Please try again.", "error");
      }
    }, 'image/jpeg');
  } catch (err) {
    console.error('Prediction error:', err);
    predictionDiv.innerHTML = '<div class="alert alert-warning">Model error. Please try again.</div>';
  }
});
