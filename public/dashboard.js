// ====================== CONFIGURATION ======================
const modelURL = "https://teachablemachine.withgoogle.com/models/jVXRskySZ/model.json";
const metadataURL = "https://teachablemachine.withgoogle.com/models/jVXRskySZ/metadata.json";
let model, webcamStream;
let currentFacingMode = "environment";
let lastUploadTime = null;

// ====================== INITIALIZATION ======================
window.onload = () => {
  checkAuth();
  loadUserProfile();
  loadUploadHistory();
  loadModel();

  document.getElementById("uploadBtn").addEventListener("click", openCamera);
  document.getElementById("captureBtn").addEventListener("click", capturePhoto);
  document.getElementById("retryBtn").addEventListener("click", resetCamera);
  document.getElementById("submitBtn").addEventListener("click", uploadImage);
  document.getElementById("switchCameraBtn").addEventListener("click", switchCamera);
};

// ====================== AUTH & USER DATA ======================
function checkAuth() {
  const token = localStorage.getItem("token");
  if (!token) window.location.href = "login.html";
}

async function loadUserProfile() {
  try {
    const res = await fetch("https://greencoin-backend.onrender.com/api/user/profile", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const { user } = await res.json();
    document.getElementById("userName").innerText = user.name;
    document.getElementById("userEmail").innerText = user.email;
    document.getElementById("coinBalance").innerText = user.coins;
  } catch (err) {
    Swal.fire("Error", "Failed to load profile", "error");
  }
}

async function loadUploadHistory() {
  try {
    const res = await fetch("https://greencoin-backend.onrender.com/api/tree/history", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const data = await res.json();
    const history = data.history || [];
    document.getElementById("historyList").innerHTML = history.map(item => `
      <div class="mb-2">
        <img src="${item.imageUrl}" style="max-height:150px;border-radius:8px;"><br>
        <small>${new Date(item.timestamp).toLocaleString()}</small>
      </div>
    `).join("");
  } catch {
    Swal.fire("Error", "Failed to load history", "error");
  }
}

// ====================== AI MODEL ======================
async function loadModel() {
  model = await tmImage.load(modelURL, metadataURL);
  console.log("[AI] Model loaded");
}

// ====================== CAMERA CONTROLS ======================
function openCamera() {
  console.log("[Camera] Requesting access...");
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: currentFacingMode } },
    audio: false
  }).then(stream => {
    webcamStream = stream;
    const video = document.getElementById("video");
    video.srcObject = stream;

    video.onloadedmetadata = () => {
      video.play();
      video.style.display = "block";
      document.getElementById("canvas").style.display = "none";
      document.getElementById("camera-section").style.display = "block";
      document.getElementById("captureBtn").style.display = "inline-block";
      document.getElementById("retryBtn").style.display = "none";
      document.getElementById("submitBtn").style.display = "none";
      document.getElementById("predictionResults").style.display = "none";
    };
  }).catch(err => {
    console.error("[Camera] Error:", err);
    Swal.fire("Error", "Camera access denied or not supported", "error");
  });
}

function switchCamera() {
  if (webcamStream) webcamStream.getTracks().forEach(track => track.stop());
  currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
  openCamera();
}

function capturePhoto() {
  console.log("[Capture] Attempting photo...");
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  if (video.videoWidth === 0 || video.videoHeight === 0) {
    Swal.fire("Error", "Camera not ready. Try again in a second.", "warning");
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const timestamp = new Date().toLocaleString();
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(10, canvas.height - 40, 300, 30);
  ctx.fillStyle = "#fff";
  ctx.font = "18px Poppins";
  ctx.fillText(timestamp, 15, canvas.height - 20);

  video.style.display = "none";
  canvas.style.display = "block";
  document.getElementById("captureBtn").style.display = "none";
  document.getElementById("retryBtn").style.display = "inline-block";
  document.getElementById("predictionResults").style.display = "block";
  document.getElementById("modelPrediction").innerText = "Analyzing...";

  predictImage(canvas);
}

// ====================== TREE DETECTION LOGIC ======================
async function predictImage(image) {
  try {
    const predictions = await model.predict(image);
    const topPrediction = predictions.sort((a, b) => b.probability - a.probability)[0];
    const isTree = topPrediction.className.toLowerCase() === "tree";
    const highConfidence = topPrediction.probability > 0.95;

    const confidence = (topPrediction.probability * 100).toFixed(2);
    document.getElementById("modelPrediction").innerText =
      `${topPrediction.className === "tree" ? "🌳 Tree" : "❌ Not a Tree"}: ${confidence}%`;

    const confidenceBar = document.getElementById("confidenceBar");
    confidenceBar.style.width = `${confidence}%`;
    confidenceBar.innerText = `${confidence}%`;

    if (isTree && highConfidence) {
      document.getElementById("submitBtn").style.display = "inline-block";
      Swal.fire("✅ Tree Detected!", "You can now upload this image.", "success");
    } else {
      document.getElementById("submitBtn").style.display = "none";
      Swal.fire("❌ Not a Tree", "AI did not detect a tree with high confidence.", "error");
    }
  } catch (err) {
    console.error("[AI] Prediction error:", err);
    Swal.fire("Error", "AI analysis failed", "error");
  }
}

// ====================== UPLOAD WITH COOLDOWN ======================
function uploadImage() {
  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn.style.display === "none") {
    Swal.fire("Error", "Cannot upload: No tree detected.", "error");
    return;
  }

  if (lastUploadTime && (Date.now() - lastUploadTime < 5 * 60 * 1000)) {
    const remainingMinutes = Math.ceil((5 * 60 * 1000 - (Date.now() - lastUploadTime)) / 60000);
    return Swal.fire("Cooldown", `Please wait ${remainingMinutes} minute(s) before uploading again.`, "info");
  }

  const canvas = document.getElementById("canvas");
  canvas.toBlob(async (blob) => {
    const formData = new FormData();
    formData.append("photo", blob, "tree.jpg");

    try {
      const res = await fetch("https://greencoin-backend.onrender.com/api/tree/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      });

      if (res.status === 429) {
        const data = await res.json();
        return Swal.fire("Cooldown", data.error || "Try again later.", "info");
      }

      if (!res.ok) throw new Error("Upload failed.");

      lastUploadTime = Date.now();
      startCooldown();
      const data = await res.json();
      Swal.fire("Success!", `Tree uploaded! +${data.coinsAwarded || 0} coins`, "success");
      stopCamera();
      document.getElementById("camera-section").style.display = "none";
      loadUserProfile();
      loadUploadHistory();
    } catch (err) {
      Swal.fire("Error", "Upload failed", "error");
    }
  });
}

// ====================== COOLDOWN TIMER ======================
function startCooldown() {
  const cooldownEl = document.getElementById("cooldownInfo");
  const timerEl = document.getElementById("cooldownTimer");
  let timeLeft = 300; // 5 minutes

  cooldownEl.style.display = "block";

  const interval = setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerEl.innerText = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    timeLeft--;

    if (timeLeft < 0) {
      clearInterval(interval);
      cooldownEl.style.display = "none";
    }
  }, 1000);
}

// ====================== UTILITY FUNCTIONS ======================
function resetCamera() {
  document.getElementById("canvas").style.display = "none";
  document.getElementById("video").style.display = "block";
  document.getElementById("submitBtn").style.display = "none";
  document.getElementById("captureBtn").style.display = "inline-block";
  document.getElementById("retryBtn").style.display = "none";
  document.getElementById("predictionResults").style.display = "none";
}

function stopCamera() {
  if (webcamStream) webcamStream.getTracks().forEach(track => track.stop());
}
