// 1. Authentication Check with better token validation
function isValidToken(token) {
  if (!token) return false;
  try {
    // Simple JWT structure check (3 parts separated by dots)
    const parts = token.split('.');
    return parts.length === 3;
  } catch {
    return false;
  }
}

if (!isValidToken(localStorage.getItem('token'))) {
  window.location.href = 'login.html';
}

// 2. Global state variables
let model;
let currentStream;
let currentCameraIndex = 0;
let videoDevices = [];
let lastUploadTime = parseInt(localStorage.getItem('lastUploadTime')) || 0;
let cooldownInterval;

// 3. Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log("Initializing dashboard...");
  
  try {
    await Promise.all([
      loadModel(),
      loadUserProfile(),
      loadHistory()
    ]);
    
    checkCooldown();
    getVideoDevices();
    
    // Auto-open camera if hash is #upload
    if (window.location.hash === '#upload') {
      document.getElementById('uploadBtn').click();
      setTimeout(() => {
        document.getElementById('camera-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
    
    // Enable upload button after everything is loaded
    document.getElementById('uploadBtn').disabled = false;
  } catch (error) {
    console.error("Initialization error:", error);
    Swal.fire({
      title: "Initialization Error",
      text: "Failed to initialize dashboard. Please refresh the page.",
      icon: "error"
    });
  }
});

// 4. Load Teachable Machine model
async function loadModel() {
  try {
    const MODEL_URL = './model/';
    model = await tmImage.load(MODEL_URL + 'model.json', MODEL_URL + 'metadata.json');
    console.log('✅ Model loaded successfully');
    return true;
  } catch (err) {
    console.error('❌ Model load error:', err);
    Swal.fire({
      title: "Model Error", 
      text: "Could not load verification model. Some features may not work.",
      icon: "warning"
    });
    return false;
  }
}

// 5. Load user profile with enhanced error handling
async function loadUserProfile() {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }

  try {
    const response = await fetch('https://greencoin-backend.onrender.com/api/user/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // Handle specific HTTP errors
      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Profile data:", data);

    // Update DOM elements
    document.getElementById('userName').textContent = data.name || 'Green User';
    document.getElementById('userEmail').textContent = data.email || 'user@example.com';
    document.getElementById('coinBalance').textContent = data.coins ?? '0';
    
    return data;
  } catch (error) {
    console.error("❌ Profile load error:", error);
    
    // Show user-friendly error message
    const errorMessage = error.message.includes('Failed to fetch') 
      ? "Could not connect to server. Please check your internet connection."
      : "Failed to load profile data. Please try again later.";
    
    Swal.fire({
      title: "Profile Error",
      text: errorMessage,
      icon: "error"
    });
    
    // Fallback to default values
    document.getElementById('userName').textContent = 'Green User';
    document.getElementById('userEmail').textContent = 'user@example.com';
    document.getElementById('coinBalance').textContent = '0';
    
    throw error;
  }
}

// 6. Load upload history with better UI states
async function loadHistory() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const response = await fetch('https://greencoin-backend.onrender.com/api/tree/history', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    renderHistory(data);
    return data;
  } catch (error) {
    console.error("❌ History load error:", error);
    renderHistoryError();
    throw error;
  }
}

function renderHistory(data) {
  const historyList = document.getElementById('historyList');
  
  if (!data || data.length === 0) {
    historyList.innerHTML = '<div class="text-center py-3 text-muted">No upload history yet</div>';
    return;
  }

  historyList.innerHTML = data.map(item => {
    const date = new Date(item.timestamp);
    return `
      <div class="list-group-item mb-2 animate__animated animate__fadeIn">
        <div class="d-flex justify-content-between">
          <div>
            <h6 class="mb-1">Tree Upload</h6>
            <small class="text-muted">${date.toLocaleString()}</small>
          </div>
          <div class="text-success">+${item.coinsEarned} <i class="bi bi-coin"></i></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderHistoryError() {
  document.getElementById('historyList').innerHTML = `
    <div class="alert alert-danger text-center animate__animated animate__shakeX">
      Failed to load history. <button class="btn btn-link p-0" onclick="loadHistory()">Try again</button>
    </div>
  `;
}

// 7. Cooldown management functions
function checkCooldown() {
  const now = Date.now();
  const cooldownMs = 5 * 60 * 1000; // 5 minutes
  const timeSinceLastUpload = now - lastUploadTime;

  if (timeSinceLastUpload < cooldownMs) {
    const remainingMs = cooldownMs - timeSinceLastUpload;
    startCooldownTimer(remainingMs);
    document.getElementById('uploadBtn').disabled = true;
    document.getElementById('cooldownInfo').classList.remove('d-none');
  } else {
    document.getElementById('uploadBtn').disabled = false;
    document.getElementById('cooldownInfo').classList.add('d-none');
  }
}

function startCooldownTimer(ms) {
  clearInterval(cooldownInterval);

  function updateTimer() {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    document.getElementById('cooldownTimer').textContent = 
      `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

    if (ms <= 0) {
      clearInterval(cooldownInterval);
      document.getElementById('uploadBtn').disabled = false;
      document.getElementById('cooldownInfo').classList.add('d-none');
    } else {
      ms -= 1000;
    }
  }

  updateTimer();
  cooldownInterval = setInterval(updateTimer, 1000);
}

// 8. Camera handling functions
async function getVideoDevices() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      console.warn("enumerateDevices() not supported.");
      return;
    }
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices = devices.filter(d => d.kind === 'videoinput');
    console.log(`Found ${videoDevices.length} video devices`);
  } catch (error) {
    console.error("Error enumerating devices:", error);
  }
}

async function startCamera(deviceId = null) {
  // Stop any existing stream
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
  } catch (error) {
    console.error("Camera error:", error);
    
    let errorMessage;
    if (error.name === 'NotAllowedError') {
      errorMessage = "Camera access was denied. Please enable camera permissions.";
    } else if (error.name === 'NotFoundError') {
      errorMessage = "No camera found on this device.";
    } else {
      errorMessage = "Could not access the camera. Please try again.";
    }
    
    Swal.fire({
      title: "Camera Error",
      text: errorMessage,
      icon: "error"
    });
    
    document.getElementById("camera-section").style.display = "none";
  }
}

// 9. Event listeners
document.getElementById("uploadBtn").addEventListener("click", () => {
  document.getElementById("camera-section").style.display = "block";
  startCamera();
});

document.getElementById("switchCameraBtn").addEventListener("click", async () => {
  if (videoDevices.length < 2) {
    Swal.fire({
      title: "No Alternative Camera",
      text: "Only one camera was found on this device.",
      icon: "info"
    });
    return;
  }
  
  currentCameraIndex = (currentCameraIndex + 1) % videoDevices.length;
  await startCamera(videoDevices[currentCameraIndex].deviceId);
});

document.getElementById("captureBtn").addEventListener("click", captureAndUpload);

// 10. Main capture and upload function
async function captureAndUpload() {
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const predictionDiv = document.getElementById("modelPrediction");

  // Validate video is ready
  if (video.readyState < 2) {
    Swal.fire({
      title: "Camera Not Ready",
      text: "Please wait for the camera to initialize.",
      icon: "warning"
    });
    return;
  }

  // Set canvas dimensions and capture frame
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  
  // Add timestamp watermark
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "16px Arial";
  ctx.fillText(new Date().toLocaleString(), 10, canvas.height - 10);

  // Show loading state
  predictionDiv.innerHTML = '<div class="spinner-border text-success"></div> Processing image...';

  try {
    // Verify with Teachable Machine model
    if (!model) {
      throw new Error("Verification model not loaded");
    }
    
    const prediction = await model.predict(canvas);
    console.log("Prediction results:", prediction);
    
    // Check if image contains a tree with high confidence
    const isTree = prediction.some(p => 
      p.className.toLowerCase().includes("tree") && 
      p.probability > 0.7
    );

    if (!isTree) {
      predictionDiv.innerHTML = `
        <div class="alert alert-danger animate__animated animate__shakeX">
          <i class="bi bi-exclamation-triangle"></i> This doesn't appear to be a tree.
        </div>
      `;
      return;
    }

    // If verification passed, upload the image
    predictionDiv.innerHTML = `
      <div class="alert alert-success animate__animated animate__fadeIn">
        <i class="bi bi-check-circle"></i> Tree verified! Uploading...
      </div>
    `;

    await uploadTreeImage(canvas);
  } catch (error) {
    console.error("Capture/upload error:", error);
    predictionDiv.innerHTML = `
      <div class="alert alert-danger animate__animated animate__shakeX">
        <i class="bi bi-exclamation-triangle"></i> ${error.message || "Processing failed"}
      </div>
    `;
  }
}

async function uploadTreeImage(canvas) {
  const swal = Swal.fire({
    title: 'Uploading Tree',
    html: 'Please wait while we process your tree...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    // Convert canvas to blob
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9);
    });

    if (!blob) {
      throw new Error("Failed to create image");
    }

    // Prepare form data
    const formData = new FormData();
    formData.append("photo", blob, "tree.jpg");

    // Send to server
    const response = await fetch("https://greencoin-backend.onrender.com/api/tree/upload", {
      method: "POST",
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    });

    await swal.close();

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Upload failed");
    }

    // Update last upload time and refresh data
    lastUploadTime = Date.now();
    localStorage.setItem('lastUploadTime', lastUploadTime.toString());
    
    await Swal.fire({
      title: "✅ Success",
      text: "Tree uploaded successfully! Your coins have been updated.",
      icon: "success"
    });

    // Refresh the page to show updates
    window.location.reload();
  } catch (error) {
    await swal.close();
    await Swal.fire({
      title: "❌ Upload Failed",
      text: error.message || "Could not upload the tree. Please try again.",
      icon: "error"
    });
    throw error;
  }
}

// Make loadHistory available globally for retry button
window.loadHistory = loadHistory;
