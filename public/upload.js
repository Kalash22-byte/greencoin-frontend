document.getElementById('treeForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const token = localStorage.getItem('token');
  if (!token) {
    alert('You must be logged in.');
    return (window.location.href = 'login.html');
  }

  const file = document.getElementById('treePhoto').files[0];
  if (!file) {
    return alert('Please select a photo.');
  }

  const formData = new FormData();
  formData.append('photo', file);
  formData.append('description', document.getElementById('description').value);

  // TEMP: just show preview success
  const message = document.getElementById('uploadMessage');
  message.innerHTML = `<div class="alert alert-info">Photo "${file.name}" is ready to upload. Backend coming soon.</div>`;
});


document.getElementById('treeForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const token = localStorage.getItem('token');
  if (!token) {
    alert('You must be logged in.');
    return (window.location.href = 'login.html');
  }

  const file = document.getElementById('treePhoto').files[0];
  const desc = document.getElementById('description').value;
  if (!file) {
    return alert('Please select a photo.');
  }

  const formData = new FormData();
  formData.append('photo', file);
  formData.append('description', desc);

  const res = await fetch('/api/tree/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await res.json();

  const message = document.getElementById('uploadMessage');
  if (res.ok) {
    message.innerHTML = `<div class="alert alert-success">✅ Photo uploaded successfully: <code>${data.filename}</code></div>`;
  } else {
    message.innerHTML = `<div class="alert alert-danger">❌ ${data.message || 'Upload failed'}</div>`;
  }
});
