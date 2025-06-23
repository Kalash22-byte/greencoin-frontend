document.addEventListener('DOMContentLoaded', function() {
    // Initialize AOS animation library
    AOS.init({
        duration: 800,
        easing: 'ease-in-out',
        once: true
    });

    // Check for JWT and update UI accordingly
    const token = localStorage.getItem('jwtToken');
    if (token) {
        document.querySelectorAll('.register-link').forEach(el => {
            el.href = 'dashboard.html';
            el.innerHTML = '<i class="fas fa-user-circle me-2"></i>My Dashboard';
        });
    }

    // Initialize interactive map
    initMap();

    // Set up dynamic impact counter
    setupImpactCounter();

    // Set up tree growth visualization
    setupTreeVisualization();

    // Handle upload button click (check auth)
    document.querySelectorAll('.upload-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            if (!token) {
                e.preventDefault();
                const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
                loginModal.show();
            }
        });
    });

    // Scroll down indicator functionality
    document.querySelector('.scroll-down-indicator').addEventListener('click', function() {
        window.scrollBy({
            top: window.innerHeight - 100,
            behavior: 'smooth'
        });
    });

    // Parallax effect for hero section
    setupParallax();

    // Add smooth scroll to all links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId !== '#') {
                document.querySelector(targetId).scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Add hover effects to cards
    document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px)';
            this.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = '';
            this.style.boxShadow = '';
        });
    });
});

function initMap() {
    const map = L.map('planting-map').setView([20, 0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add some example planting locations
    const plantingLocations = [
        { lat: 51.505, lng: -0.09, title: 'London Community Garden' },
        { lat: 40.7128, lng: -74.0060, title: 'New York Park Initiative' },
        { lat: -33.8688, lng: 151.2093, title: 'Sydney Urban Forest' },
        { lat: 35.6762, lng: 139.6503, title: 'Tokyo Green Spaces' },
        { lat: -22.9068, lng: -43.1729, title: 'Rio Reforestation' }
    ];

    plantingLocations.forEach(location => {
        const marker = L.marker([location.lat, location.lng]).addTo(map);
        marker.bindPopup(`<b>${location.title}</b><br>500+ trees planted here`);
        
        // Add a pulsing effect to markers
        marker.on('add', function() {
            const icon = this.getElement();
            if (icon) {
                icon.style.animation = 'pulse 2s infinite';
            }
        });
    });
}

function setupImpactCounter() {
    const counters = [
        { element: document.getElementById('trees-planted'), target: 12453, suffix: '+' },
        { element: document.getElementById('active-users'), target: 5321, suffix: '+' },
        { element: document.getElementById('partners'), target: 58, suffix: '+' }
    ];

    counters.forEach(counter => {
        let current = 0;
        const increment = counter.target / 50;
        
        const updateCounter = () => {
            current += increment;
            if (current < counter.target) {
                counter.element.textContent = Math.floor(current) + counter.suffix;
                setTimeout(updateCounter, 30);
            } else {
                counter.element.textContent = counter.target + counter.suffix;
            }
        };
        
        updateCounter();
    });
}

function setupTreeVisualization() {
    const container = document.getElementById('tree-growth-animation');
    const progressFill = document.querySelector('.progress-fill');
    const progressPercentage = document.getElementById('progress-percentage');
    const milestones = document.querySelectorAll('.milestone');
    
    // Create trees
    for (let i = 0; i < 5; i++) {
        const tree = document.createElement('div');
        tree.className = 'tree';
        container.appendChild(tree);
    }
    
    // Simulate progress (in a real app, this would come from user data)
    let progress = 0;
    const trees = document.querySelectorAll('.tree');
    
    const simulateProgress = () => {
        if (progress < 100) {
            progress += 1;
            progressFill.style.width = `${progress}%`;
            progressPercentage.textContent = progress;
            
            // Update tree growth
            trees.forEach(tree => {
                tree.style.height = `${progress * 3}px`;
            });
            
            // Check milestones
            milestones.forEach(milestone => {
                const percent = parseInt(milestone.getAttribute('data-percent'));
                if (progress >= percent && !milestone.classList.contains('active')) {
                    milestone.classList.add('active');
                    
                    // Add celebration effect for milestones
                    if (progress === percent) {
                        const confetti = document.createElement('div');
                        confetti.className = 'milestone-confetti';
                        milestone.appendChild(confetti);
                        setTimeout(() => confetti.remove(), 2000);
                    }
                }
            });
            
            setTimeout(simulateProgress, 50);
        }
    };
    
    // Start simulation after a delay
    setTimeout(simulateProgress, 1000);
}

function setupParallax() {
    const parallaxBg = document.querySelector('.parallax-bg');
    
    if (parallaxBg) {
        window.addEventListener('scroll', function() {
            const scrollPosition = window.pageYOffset;
            parallaxBg.style.transform = `translateY(${scrollPosition * 0.5}px)`;
        });
    }
}

// Add CSS for milestone confetti
const style = document.createElement('style');
style.textContent = `
.milestone-confetti {
    position: absolute;
    width: 10px;
    height: 10px;
    background-color: var(--primary-green);
    border-radius: 50%;
    animation: confetti-fall 2s ease-out forwards;
}

@keyframes confetti-fall {
    0% {
        transform: translateY(0) rotate(0deg);
        opacity: 1;
    }
    100% {
        transform: translateY(100px) rotate(360deg);
        opacity: 0;
    }
}
`;
document.head.appendChild(style);
