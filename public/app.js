document.addEventListener('DOMContentLoaded', function() {
    // File Upload Handling
    const fileUpload = document.getElementById('fileUpload');
    const uploadLabel = document.querySelector('.upload-label');
    const submitBtn = document.getElementById('submitBtn');
    const messageAlert = document.getElementById('messageAlert');
    
    // Drag and Drop functionality
    const uploadArea = document.querySelector('.upload-area');
    
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
    
    // File selection handler
    fileUpload.addEventListener('change', handleFileSelection);
    
    function handleFileSelection() {
        if (fileUpload.files && fileUpload.files[0]) {
            const file = fileUpload.files[0];
            const validTypes = ['image/jpeg', 'image/png'];
            const maxSize = 5 * 1024 * 1024; // 5MB
            
            if (!validTypes.includes(file.type)) {
                showAlert('Please upload a valid JPG or PNG image.', 'danger');
                return;
            }
            
            if (file.size > maxSize) {
                showAlert('File size exceeds 5MB limit.', 'danger');
                return;
            }
            
            // Display file info
            uploadLabel.innerHTML = `
                <i class="fas fa-check-circle fa-3x mb-3 text-success"></i>
                <h5>${file.name}</h5>
                <p class="small text-muted">${(file.size / (1024 * 1024)).toFixed(2)} MB</p>
            `;
            
            submitBtn.disabled = false;
            showAlert('File selected successfully. Ready to submit!', 'success');
        }
    }
    
    // Form submission
    submitBtn.addEventListener('click', function() {
        if (!fileUpload.files[0]) {
            showAlert('Please select a file first.', 'warning');
            return;
        }
        
        // Simulate upload process
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Processing...';
        
        // Simulate API call
        setTimeout(() => {
            showAlert('Your tree planting has been verified! 10 GreenCoins added to your account.', 'success');
            submitBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i>Submitted';
            
            // Reset form after 5 seconds
            setTimeout(resetForm, 5000);
        }, 3000);
    });
    
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
        messageAlert.textContent = message;
        messageAlert.className = `alert alert-${type} mt-4`;
        messageAlert.classList.remove('d-none');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            messageAlert.classList.add('d-none');
        }, 5000);
    }
    
    // Scroll effect for navbar
    window.addEventListener('scroll', function() {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 50) {
            navbar.style.padding = '10px 0';
            navbar.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.1)';
        } else {
            navbar.style.padding = '20px 0';
            navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        }
    });
});



document.addEventListener('DOMContentLoaded', function() {
    // Toggle password visibility
    const togglePassword = document.querySelector('.toggle-password');
    const password = document.getElementById('password');
    
    if (togglePassword && password) {
        togglePassword.addEventListener('click', function() {
            const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
            password.setAttribute('type', type);
            this.querySelector('i').classList.toggle('fa-eye');
            this.querySelector('i').classList.toggle('fa-eye-slash');
        });
    }

    // Form validation
    const form = document.getElementById('loginForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Reset validation
            form.classList.remove('was-validated');
            
            // Check form validity
            if (!form.checkValidity()) {
                e.stopPropagation();
                form.classList.add('was-validated');
                return;
            }
            
            // If form is valid, proceed with login
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            // Here you would typically make an API call
            console.log('Login attempt with:', email, password);
            
            // Simulate API response (replace with actual API call)
            setTimeout(() => {
                // This is just for demonstration - in a real app, you'd handle the API response
                const errorElement = document.getElementById('loginError');
                errorElement.textContent = 'Invalid email or password. Please try again.';
                errorElement.classList.remove('d-none');
                
                // For demo purposes, we'll clear the error after 3 seconds
                setTimeout(() => {
                    errorElement.classList.add('d-none');
                }, 3000);
            }, 1000);
        });
    }
});
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      document.getElementById('loginError').textContent = data.message || 'Login failed';
      document.getElementById('loginError').classList.remove('d-none');
    } else {
      localStorage.setItem('token', data.token);
      alert('Login successful!');
      window.location.href = 'dashboard.html'; // Or redirect to another page
    }
  } catch (error) {
    console.error('Login error:', error);
    document.getElementById('loginError').textContent = 'Server error';
    document.getElementById('loginError').classList.remove('d-none');
  }
});
