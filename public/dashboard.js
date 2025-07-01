const modelURL = "https://teachablemachine.withgoogle.com/models/9tAcsvkyu/model.json";
const metadataURL = "https://teachablemachine.withgoogle.com/models/9tAcsvkyu/metadata.json";

let model, webcamStream;
let currentFacingMode = "environment";
let lastUploadTime = null;

const { createClient } = supabase;
const supabaseClient = createClient(
  "https://hzdslybfnjfpiarpyfza.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // REPLACE WITH YOUR KEY
);

window.onload = () => {
  checkAuth();
  loadUserProfile();
  loadModel();

  document.getElementById("uploadBtn").addEventListener("click", openCamera);
  document.getElementById("captureBtn").addEventListener("click", capturePhoto);
  document.getElementById("retryBtn").addEventListener("click", resetCamera);
  document.getElementById("submitBtn").addEventListener("click", uploadImage);
  document.getElementById("switchCameraBtn").addEventListener("click", switchCamera);
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "login.html";
  });
  document.getElementById("uploadProfileBtn").addEventListener("click", uploadProfilePhoto);
};

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
    document.getElementById("profilePhoto").src = user.profile_photo || "https://cdn-icons-png.flaticon.com/512/847/847969.png";
  } catch (err) {
    Swal.fire("Error", "Failed to load profile", "error");
  }
}

async function uploadProfilePhoto() {
  const fileInput = document.getElementById("photoUploadInput");
  const file = fileInput.files[0];
  if (!file) return Swal.fire("No file", "Select an image", "warning");

  const filename = `profile-${Date.now()}-${file.name}`;
  const { data, error } = await supabaseClient.storage.from("profile").upload(filename, file);
  if (error) return Swal.fire("Error", "Upload failed", "error");

  const { data: publicURLData } = supabaseClient.storage.from("profile").getPublicUrl(filename);
  const publicUrl = publicURLData.publicUrl;

  const res = await fetch("https://greencoin-backend.onrender.com/api/user/profile-photo", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ photoUrl: publicUrl })
  });

  if (res.ok) {
    Swal.fire("Success", "Photo updated", "success");
    document.getElementById("profilePhoto").src = publicUrl;
    fileInput.value = "";
  } else {
    Swal.fire("Error", "Backend update failed", "error");
  }
}

async function loadModel() {
  model = await tmImage.load(modelURL, metadataURL);
}

function openCamera() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: currentFacingMode } } })
    .then(stream => {
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
    })
    .catch(() => Swal.fire("Error", "Camera access denied", "error"));
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

  if (video.videoWidth === 0) return Swal.fire("Error", "Camera not ready", "warning");

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

async function predictImage(image) {
  try {
    const predictions = await model.predict(image);
    const top = predictions.sort((a, b) => b.probability - a.probability)[0];
    const isTree = top.className.toLowerCase() === "tree";
    const highConfidence = top.probability >= 0.99; // ✅ Only allow 99% or above
    const percent = (top.probability * 100).toFixed(2);

    document.getElementById("modelPrediction").innerText = `${top.className}: ${percent}%`;
    const bar = document.getElementById("confidenceBar");
    bar.style.width = `${percent}%`;
    bar.innerText = `${percent}%`;

    if (isTree && highConfidence) {
      document.getElementById("submitBtn").style.display = "inline-block";
      Swal.fire("✅ Tree Detected", "You can now upload", "success");
    } else {
      document.getElementById("submitBtn").style.display = "none";
      Swal.fire("❌ Not a Tree", "Confidence must be 99%+", "error");
    }
  } catch (err) {
    Swal.fire("Error", "AI failed", "error");
  }
}


function uploadImage() {
  const canvas = document.getElementById("canvas");
  if (document.getElementById("submitBtn").style.display === "none") return;
  if (lastUploadTime && (Date.now() - lastUploadTime < 5 * 60 * 1000)) {
    const wait = Math.ceil((5 * 60 * 1000 - (Date.now() - lastUploadTime)) / 60000);
    return Swal.fire("Cooldown", `Wait ${wait} min(s)`, "info");
  }

  canvas.toBlob(async (blob) => {
    const formData = new FormData();
    formData.append("photo", blob, "tree.jpg");
    try {
      const res = await fetch("https://greencoin-backend.onrender.com/api/tree/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      });
      if (!res.ok) return Swal.fire("Error", "Upload failed", "error");
      const data = await res.json();
      lastUploadTime = Date.now();
      startCooldown();
      Swal.fire("Success", `Uploaded! +${data.coinsAwarded || 0} coins`, "success");
      stopCamera();
      document.getElementById("camera-section").style.display = "none";
      loadUserProfile();
    } catch {
      Swal.fire("Error", "Network failed", "error");
    }
  });
}

function startCooldown() {
  const el = document.getElementById("cooldownInfo");
  const timer = document.getElementById("cooldownTimer");
  let timeLeft = 300;
  el.style.display = "block";
  const interval = setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timer.innerText = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    timeLeft--;
    if (timeLeft < 0) {
      clearInterval(interval);
      el.style.display = "none";
    }
  }, 1000);
}

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
