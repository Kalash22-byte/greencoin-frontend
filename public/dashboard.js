// STRICT MODE FOR BETTER ERROR DETECTION
'use strict';

// 1. ENHANCED AUTH CHECK
const token = localStorage.getItem('token');
if (!token || token.length < 10) { // Basic token validation
  console.error('Invalid or missing token:', token);
  localStorage.removeItem('token');
  window.location.href = 'login.html';
}

// 2. DOM READY CHECKER
function domReady() {
  return new Promise(resolve => {
    if (document.readyState !== 'loading') {
      resolve();
    } else {
      document.addEventListener('DOMContentLoaded', resolve);
    }
  });
}

// 3. MAIN EXECUTION
(async function initDashboard() {
  console.group('Dashboard Initialization');
  
  try {
    // Wait for both DOM and critical elements
    await domReady();
    await verifyCriticalElements();
    
    // Load data
    const [profile, history] = await Promise.all([
      safeLoadProfile(),
      safeLoadHistory()
    ]);
    
    // Update UI
    updateProfileUI(profile);
    updateHistoryUI(history);
    
    // Initialize features
    setupEventListeners();
    checkCooldown();
    
    console.log('✅ Dashboard initialized successfully');
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    showErrorToast(error.message || 'Dashboard initialization failed');
  } finally {
    console.groupEnd();
  }
})();

// 4. ELEMENT VERIFICATION
function verifyCriticalElements() {
  const requiredElements = [
    'userName', 'userEmail', 'coinBalance', 
    'historyList', 'uploadBtn'
  ];
  
  const missing = requiredElements.filter(id => !document.getElementById(id));
  
  if (missing.length) {
    throw new Error(`Missing elements: ${missing.join(', ')}`);
  }
}

// 5. SAFE DATA LOADERS
async function safeLoadProfile() {
  try {
    console.log('Fetching profile...');
    const response = await fetch('https://greencoin-backend.onrender.com/api/user/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    console.log('Profile data:', data);
    return data;
  } catch (error) {
    console.error('Profile load failed:', error);
    return { // Fallback data
      name: 'Green User',
      email: 'user@example.com',
      coins: 0
    };
  }
}

async function safeLoadHistory() {
  try {
    console.log('Fetching history...');
    const response = await fetch('https://greencoin-backend.onrender.com/api/tree/history', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('History load failed:', error);
    return []; // Return empty array if fails
  }
}

// 6. UI UPDATERS WITH SAFETY CHECKS
function updateProfileUI(data) {
  try {
    // Double-check elements
    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    const coinEl = document.getElementById('coinBalance');
    
    if (!nameEl || !emailEl || !coinEl) {
      throw new Error('Profile elements missing');
    }
    
    // Update with fallbacks
    nameEl.textContent = data?.name || 'User';
    emailEl.textContent = data?.email || 'No email';
    coinEl.textContent = data?.coins ?? 0;
    
    console.log('Profile UI updated');
  } catch (error) {
    console.error('Failed to update profile UI:', error);
  }
}

function updateHistoryUI(items) {
  const container = document.getElementById('historyList');
  if (!container) return;
  
  try {
    container.innerHTML = items?.length ? items.map(item => `
      <div class="list-group-item">
        <div class="d-flex justify-content-between">
          <div>
            <h6>${item.type || 'Tree Upload'}</h6>
            <small>${new Date(item.timestamp).toLocaleString()}</small>
          </div>
          <span class="text-success">+${item.coinsEarned || 0} coins</span>
        </div>
      </div>
    `).join('') : '<div class="text-muted">No history yet</div>';
    
    console.log('History UI updated');
  } catch (error) {
    container.innerHTML = '<div class="text-danger">Failed to load history</div>';
    console.error('History render error:', error);
  }
}

// 7. ERROR HANDLING
function showErrorToast(message) {
  const toast = document.createElement('div');
  toast.className = 'position-fixed bottom-0 end-0 p-3';
  toast.innerHTML = `
    <div class="toast show" role="alert">
      <div class="toast-header bg-danger text-white">
        <strong class="me-auto">Error</strong>
        <button class="btn-close btn-close-white" onclick="this.closest('.toast').remove()"></button>
      </div>
      <div class="toast-body">${message}</div>
    </div>
  `;
  document.body.appendChild(toast);
}

// 8. EVENT LISTENERS
function setupEventListeners() {
  // Upload button
  document.getElementById('uploadBtn').addEventListener('click', () => {
    document.getElementById('camera-section').style.display = 'block';
    startCamera().catch(console.error);
  });
  
  // Add other event listeners here...
}

// 9. CAMERA FUNCTIONS
async function startCamera() {
  try {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }
    
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    
    const video = document.getElementById('video');
    if (video) {
      video.srcObject = currentStream;
    }
  } catch (error) {
    console.error('Camera error:', error);
    showErrorToast('Camera access denied');
  }
}
