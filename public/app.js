document.addEventListener('DOMContentLoaded', function () {
  // File Upload Handling
  const fileUpload = document.getElementById('fileUpload');
  const uploadLabel = document.querySelector('.upload-label');
  const submitBtn = document.getElementById('submitBtn');
  const messageAlert = document.getElementById('messageAlert');
  const uploadArea = document.querySelector('.upload-area');

  // Drag and Drop
  if (uploadArea) {
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('border-success', 'bg-light');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('border-success', 'bg-light');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('border-success', 'bg-light');

      if (e.dataTransfer.files.length) {
        fileUpload.files = e.dataTransfer.files;
        handleFileSelection();
      }
    });
  }

  // File selection
  if (fileUpload) {
    fileUpload.addEventListener('change', handleFileSelection);
  }

  function handleFileSelection() {
    if (fileUpload.files && fileUpload.files[0]) {
      const file = fileUpload.files[0];
      const validTypes = ['image/jpeg', 'image/png'];
      const maxSize = 5 * 1024 * 1024;

      if (!validTypes.includes(file.type)) {
        showAlert('Please upload a valid JPG or PNG image.', 'danger');
        return;
      }

      if (file.size > maxSize) {
        showAlert('File size exceeds 5MB limit.', 'danger');
        return;
      }

      uploadLabel.innerHTML = `
        <i class="fas fa-check-circle fa-3x mb-3 text-success"></i>
        <h5>${file.name}</h5>
        <p class="small text-muted">${(file.size / (1024 * 1024)).toFixed(2)} MB</p>
      `;
      submitBtn.disabled = false;
      showAlert('File selected successfully. Ready to submit!', 'success');
    }
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      if (!fileUpload.files[0]) {
        showAlert('Please select a file first.', 'warning');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';

      setTimeout(() => {
        showAlert(
          'Your tree planting has been verified! 10 GreenCoins added to your account.',
          'success'
        );
        submitBtn.innerHTML =
          '<i class="fas fa-check-circle me-2"></i>Submitted';
        setTimeout(resetForm, 5000);
      }, 3000);
    });
  }

  function resetForm() {
    fileUpload.value = '';
    uploadLabel.innerHTML = `
      <i class="fas fa-images fa-3x mb-3 text-muted"></i>
      <h5>Drag & Drop or Click to Browse</h5>
      <p class="small text-muted">Supported formats: JPG, PNG (Max 5MB)</p>
    `;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i>Submit Verification';
  }

  function showAlert(message, type) {
    if (messageAlert) {
      messageAlert.textContent = message;
      messageAlert.className = `alert alert-${type} mt-4`;
      messageAlert.classList.remove('d-none');

      setTimeout(() => {
        messageAlert.classList.add('d-none');
      }, 5000);
    }
  }

  // Scroll navbar shrink
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 50) {
        navbar.style.padding = '10px 0';
        navbar.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.1)';
      } else {
        navbar.style.padding = '20px 0';
        navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
      }
    });
  }

  // Login Form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      try {
        const response = await fetch('https://greencoin-backend.onrender.com/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          document.getElementById('loginError').textContent =
            data.message || 'Login failed';
          document.getElementById('loginError').classList.remove('d-none');
        } else {
          localStorage.setItem('token', data.token);
          alert('Login successful!');
          window.location.href = 'dashboard.html';
        }
      } catch (err) {
        console.error('Login error:', err);
        document.getElementById('loginError').textContent = 'Server error';
        document.getElementById('loginError').classList.remove('d-none');
      }
    });
  }

  // Password toggle (if any)
  const togglePassword = document.querySelector('.toggle-password');
  const passwordInput = document.getElementById('password');
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', function () {
      const type =
        passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      this.querySelector('i').classList.toggle('fa-eye');
      this.querySelector('i').classList.toggle('fa-eye-slash');
    });
  }
});
