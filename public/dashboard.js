// ======================
// 1. AUTHENTICATION CHECK
// ======================
const token = localStorage.getItem('token');
if (!token) {
  window.location.href = 'login.html';
}

// ======================
// 2. GLOBAL STATE
// ======================
let model;
let currentStream;
let lastUploadTime = parseInt(localStorage.getItem('lastUploadTime')) || 0;

// ======================
// 3. MAIN INITIALIZATION
// ======================
document.addEventListener('DOMContentLoaded', async () => {
  console.log("[1] Dashboard initialized - checking elements...");
  
  // Debug: Verify critical elements exist
  if (!document.getElementById('userName') || 
      !document.getElementById('userEmail') || 
      !document.getElementById('coinBalance')) {
    console.error("[CRITICAL] Missing HTML elements!");
    Swal.fire("Error", "Required page elements are missing", "error");
    return;
  }

  try {
    console.log("[2] Loading profile data...");
    const profileData = await loadUserProfile();
    
    console.log("[3] Received profile data:", profileData);
    updateProfileUI(profileData);
    
    console.log("[4] Loading history...");
    await loadHistory();
    
    console.log("[5] Setting up event listeners...");
    setupEventListeners();
    
    console.log("[6] Checking cooldown...");
    checkCooldown();
    
  } catch (error) {
    console.error("[INIT ERROR]", error);
    Swal.fire({
      title: "Initialization Failed",
      text: error.message || "Could not load dashboard",
      icon: "error"
    });
  }
});

// ======================
// 4. PROFILE FUNCTIONS
// ======================
async function loadUserProfile() {
  try {
    console.log("[PROFILE] Fetching profile data...");
    const response = await fetch('https://greencoin-backend.onrender.com/api/user/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log("[PROFILE] Response status:", response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Server returned ${response.status}`);
    }

    const data = await response.json();
    console.log("[PROFILE] Data received:", data);
    return data;
    
  } catch (error) {
    console.error("[PROFILE ERROR]", error);
    throw new Error("Failed to load profile: " + error.message);
  }
}

function updateProfileUI(data) {
  console.log("[UI UPDATE] Updating profile UI with:", data);
  
  try {
    // Safely update each field
    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    const coinEl = document.getElementById('coinBalance');

    if (nameEl) nameEl.textContent = data.name || 'Green User';
    if (emailEl) emailEl.textContent = data.email || 'No email';
    if (coinEl) coinEl.textContent = data.coins ?? '0'; // Nullish coalescing
    
    console.log("[UI UPDATE] Elements updated successfully");
  } catch (uiError) {
    console.error("[UI UPDATE ERROR]", uiError);
    throw new Error("Failed to update UI elements");
  }
}

// ======================
// 5. HISTORY FUNCTIONS
// ======================
async function loadHistory() {
  try {
    console.log("[HISTORY] Fetching history...");
    const response = await fetch('https://greencoin-backend.onrender.com/api/tree/history', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`History request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log("[HISTORY] Data received:", data);
    renderHistory(data);
    
  } catch (error) {
    console.error("[HISTORY ERROR]", error);
    renderHistoryError();
  }
}

function renderHistory(items) {
  const container = document.getElementById('historyList');
  if (!container) {
    console.error("[HISTORY] Container not found!");
    return;
  }

  if (!items || items.length === 0) {
    container.innerHTML = '<div class="text-muted">No history yet</div>';
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="list-group-item animate__animated animate__fadeIn">
      <div class="d-flex justify-content-between">
        <div>
          <h6 class="mb-1">${item.type || 'Tree Upload'}</h6>
          <small class="text-muted">${new Date(item.timestamp).toLocaleString()}</small>
        </div>
        <div class="text-success">+${item.coinsEarned || 0} <i class="bi bi-coin"></i></div>
      </div>
    </div>
  `).join('');
}

function renderHistoryError() {
  const container = document.getElementById('historyList');
  if (container) {
    container.innerHTML = `
      <div class="alert alert-danger animate__animated animate__shakeX">
        <i class="bi bi-exclamation-triangle"></i> Failed to load history.
        <button onclick="window.location.reload()" class="btn btn-sm btn-outline-danger ms-2">
          Retry
        </button>
      </div>
    `;
  }
}

// ======================
// 6. CAMERA FUNCTIONS
// ======================
function setupEventListeners() {
  // Upload Button
  const uploadBtn = document.getElementById('uploadBtn');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      document.getElementById('camera-section').style.display = "block";
      startCamera();
    });
  }

  // Capture Button
  const captureBtn = document.getElementById('captureBtn');
  if (captureBtn) {
    captureBtn.addEventListener('click', captureAndUpload);
  }
}

async function startCamera() {
  try {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }

    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: "environment" }
    });
    document.getElementById('video').srcObject = stream;
    currentStream = stream;
  } catch (error) {
    console.error("[CAMERA ERROR]", error);
    Swal.fire({
      title: "Camera Access Required",
      text: "Please enable camera permissions to upload trees",
      icon: "warning"
    });
  }
}

// ======================
// 7. COOLDOWN MANAGEMENT
// ======================
function checkCooldown() {
  const now = Date.now();
  const cooldownPeriod = 5 * 60 * 1000; // 5 minutes
  const timeLeft = lastUploadTime + cooldownPeriod - now;

  if (timeLeft > 0) {
    document.getElementById('uploadBtn').disabled = true;
    document.getElementById('cooldownInfo').classList.remove('d-none');
    startCooldownTimer(timeLeft);
  }
}

function startCooldownTimer(ms) {
  const timerElement = document.getElementById('cooldownTimer');
  if (!timerElement) return;

  const endTime = Date.now() + ms;
  
  const updateTimer = () => {
    const remaining = endTime - Date.now();
    
    if (remaining <= 0) {
      document.getElementById('uploadBtn').disabled = false;
      document.getElementById('cooldownInfo').classList.add('d-none');
      return;
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    setTimeout(updateTimer, 1000);
  };

  updateTimer();
}

// ======================
// 8. CAPTURE AND UPLOAD
// ======================
async function captureAndUpload() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const predictionDiv = document.getElementById('modelPrediction');

  // Set canvas dimensions
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  // Capture frame
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Add timestamp
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.font = '16px Arial';
  ctx.fillText(new Date().toLocaleString(), 10, canvas.height - 10);

  // Show processing message
  predictionDiv.innerHTML = '<div class="spinner-border text-success"></div> Verifying...';

  try {
    // Verify with AI model
    if (!model) {
      throw new Error("Verification model not loaded");
    }

    const prediction = await model.predict(canvas);
    console.log("Prediction results:", prediction);
    
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

    // Upload verified image
    predictionDiv.innerHTML = `
      <div class="alert alert-success animate__animated animate__fadeIn">
        <i class="bi bi-check-circle"></i> Tree verified! Uploading...
      </div>
    `;

    await uploadImage(canvas);
    
  } catch (error) {
    console.error("[UPLOAD ERROR]", error);
    predictionDiv.innerHTML = `
      <div class="alert alert-danger animate__animated animate__shakeX">
        <i class="bi bi-exclamation-triangle"></i> ${error.message || 'Upload failed'}
      </div>
    `;
  }
}

async function uploadImage(canvas) {
  const swalInstance = Swal.fire({
    title: 'Uploading Tree',
    html: 'Please wait while we process your submission...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    // Convert canvas to blob
    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9);
    });

    if (!blob) {
      throw new Error("Failed to create image");
    }

    // Prepare form data
    const formData = new FormData();
    formData.append('photo', blob, 'tree-upload.jpg');

    // Send to server
    const response = await fetch('https://greencoin-backend.onrender.com/api/tree/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Upload failed');
    }

    // Update last upload time
    lastUploadTime = Date.now();
    localStorage.setItem('lastUploadTime', lastUploadTime.toString());

    await swalInstance.close();
    
    Swal.fire({
      title: 'Success!',
      text: 'Your tree has been uploaded and verified',
      icon: 'success'
    }).then(() => {
      window.location.reload();
    });
    
  } catch (error) {
    await swalInstance.close();
    throw error;
  }
}

// Make functions available for retry buttons
window.loadHistory = loadHistory;
window.loadUserProfile = loadUserProfile;
