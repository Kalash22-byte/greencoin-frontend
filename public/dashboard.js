const modelURL = "https://teachablemachine.withgoogle.com/models/cfn939LYh/model.json";
const metadataURL = "https://teachablemachine.withgoogle.com/models/cfn939LYh/metadata.json";
let model, webcamStream;
let currentFacingMode = "environment"; // rear by default

window.onload = () => {
  loadUserProfile();
  loadUploadHistory();
  loadModel();
  updateCooldownUI();

  document.getElementById("uploadBtn").addEventListener("click", openCamera);
  document.getElementById("captureBtn").addEventListener("click", capturePhoto);
  document.getElementById("retryBtn").addEventListener("click", resetCamera);
  document.getElementById("submitBtn").addEventListener("click", uploadImage);
  document.getElementById("switchCameraBtn").addEventListener("click", switchCamera);
};

async function loadUserProfile() {
  const res = await fetch("https://greencoin-backend.onrender.com/api/user/profile", {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });
  if (!res.ok) return Swal.fire("Error", "Failed to load user data", "error");
  const { user } = await res.json();
  document.getElementById("userName").innerText = user.name;
  document.getElementById("userEmail").innerText = user.email;
  document.getElementById("coinBalance").innerText = user.coins;
}

async function loadUploadHistory() {
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
}

async function loadModel() {
  model = await tmImage.load(modelURL, metadataURL);
}

function openCamera() {
  if (isCooldownActive()) return;
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: currentFacingMode }
  }).then(stream => {
    webcamStream = stream;
    const video = document.getElementById("video");
    video.srcObject = stream;
    video.style.display = "block";
    document.getElementById("canvas").style.display = "none";
    document.getElementById("camera-section").style.display = "block";
    document.getElementById("captureBtn").style.display = "inline-block";
    document.getElementById("retryBtn").style.display = "none";
    document.getElementById("submitBtn").style.display = "none";
    document.getElementById("predictionResults").style.display = "none";
  }).catch(() => Swal.fire("Error", "Camera access denied", "error"));
}

function switchCamera() {
  if (webcamStream) {
    webcamStream.getTracks().forEach(track => track.stop());
  }
  currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
  openCamera();
}

function capturePhoto() {
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
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
  document.getElementById("modelPrediction").innerText = "Processing...";
  predictImage(canvas);
}

async function predictImage(image) {
  const predictions = await model.predict(image);
  const top = predictions.sort((a, b) => b.probability - a.probability)[0];
  document.getElementById("modelPrediction").innerText = `${top.className}: ${(top.probability * 100).toFixed(2)}%`;

  if (top.className.toLowerCase().includes("tree") && top.probability > 0.85) {
    document.getElementById("submitBtn").style.display = "inline-block";
  } else {
    Swal.fire("Try Again", "Tree not detected confidently.", "warning");
  }
}

function resetCamera() {
  document.getElementById("canvas").style.display = "none";
  document.getElementById("video").style.display = "block";
  document.getElementById("submitBtn").style.display = "none";
  document.getElementById("captureBtn").style.display = "inline-block";
  document.getElementById("retryBtn").style.display = "none";
  document.getElementById("predictionResults").style.display = "none";
}

function uploadImage() {
  const canvas = document.getElementById("canvas");
  canvas.toBlob(async blob => {
    const formData = new FormData();
    formData.append("photo", blob, "tree.jpg"); // ✅ matches backend

    const res = await fetch("https://greencoin-backend.onrender.com/api/tree/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: formData
    });

    if (!res.ok) return Swal.fire("Error", "Upload failed", "error");
    Swal.fire("Success", "Tree uploaded!", "success");
    stopCamera();
    document.getElementById("camera-section").style.display = "none";
    loadUploadHistory();
    startCooldown();
  });
}

function stopCamera() {
  if (webcamStream) {
    webcamStream.getTracks().forEach(track => track.stop());
  }
}

function startCooldown(minutes = 5) {
  const until = Date.now() + minutes * 60 * 1000;
  localStorage.setItem("cooldownUntil", until);
  updateCooldownUI();
  const interval = setInterval(() => {
    if (!updateCooldownUI()) clearInterval(interval);
  }, 1000);
}

function updateCooldownUI() {
  const until = parseInt(localStorage.getItem("cooldownUntil"), 10);
  const now = Date.now();
  if (until && now < until) {
    const rem = until - now;
    const min = Math.floor(rem / 60000);
    const sec = Math.floor((rem % 60000) / 1000);
    document.getElementById("cooldownInfo").style.display = "block";
    document.getElementById("cooldownTimer").innerText = `${min}:${sec.toString().padStart(2, "0")}`;
    document.getElementById("uploadBtn").disabled = true;
    return true;
  } else {
    document.getElementById("cooldownInfo").style.display = "none";
    document.getElementById("uploadBtn").disabled = false;
    return false;
  }
}

function isCooldownActive() {
  const until = parseInt(localStorage.getItem("cooldownUntil"), 10);
  if (Date.now() < until) {
    Swal.fire("Wait", "You must wait 5 minutes between uploads.", "info");
    return true;
  }
  return false;
}
