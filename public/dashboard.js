// ✅ Fetch user data
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

// ✅ Camera control logic
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
      Swal.fire("✅ Success", "Tree uploaded & coin added!", "success");
      setTimeout(() => window.location.reload(), 1500);
    } else {
      Swal.fire("❌ Upload Failed", "Please try again.", "error");
    }
  }, 'image/jpeg');
});

getVideoDevices();

// Check for #upload in URL and auto-trigger upload section
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.hash === '#upload') {
    document.getElementById('uploadBtn').click();
    // Optional: scroll to camera
    setTimeout(() => {
      document.getElementById('camera-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 500);
  }
});
