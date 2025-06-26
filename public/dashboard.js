// ✅ Final dashboard.js for GreenCoin
const modelURL = "https://teachablemachine.withgoogle.com/models/cfn939LYh/model.json";
const metadataURL = "https://teachablemachine.withgoogle.com/models/cfn939LYh/metadata.json";
let model, webcamStream;
let currentFacingMode = "environment";

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

function checkAuth() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html";
  }
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
    Swal.fire("Error", "Failed to load user profile", "error");
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
    Swal.fire("Error", "Could not load upload history", "error");
  }
}

async function loadModel() {
  model = await tmImage.load(modelURL, metadataURL);
}

function openCamera() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode } }).then(stream => {
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
  if (webcamStream) webcamStream.getTracks().forEach(track => track.stop());
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
    document.getElementById("submitBtn").style.display = "none";
    Swal.fire("Not a Tree", "AI didn't detect a tree confidently.", "warning");
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
    formData.append("photo", blob, "tree.jpg");

    try {
      const res = await fetch("https://greencoin-backend.onrender.com/api/tree/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData
      });

      if (res.status === 429) {
        const data = await res.json();
        return Swal.fire("Cooldown Active", data.error || "Try again later", "info");
      }

      if (!res.ok) return Swal.fire("Error", "Upload failed", "error");

      const data = await res.json();
      Swal.fire("Uploaded!", "Tree detected and uploaded successfully", "success");
      stopCamera();
      document.getElementById("camera-section").style.display = "none";
      loadUserProfile();
      loadUploadHistory();
    } catch (err) {
      console.error("Upload error", err);
      Swal.fire("Error", "Upload failed", "error");
    }
  });
}

function stopCamera() {
  if (webcamStream) webcamStream.getTracks().forEach(track => track.stop());
}
