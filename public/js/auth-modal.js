const API_URL = 'http://localhost:8277';
const loginBtn = document.getElementById('loginBtn');
const prototypeBtn = document.getElementById('prototypeBtn');
const modal = document.getElementById('authModal');
const closeBtn = document.querySelector('.close');
const tabs = document.querySelectorAll('.tab');
const forms = document.querySelectorAll('.form');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');

// Check if user is already logged in
function checkAuthentication() {
    const token = localStorage.getItem('token');
    return !!token;
}

// Prototype button click handler
prototypeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (checkAuthentication()) {
        window.location.href = 'chat-bot.html';
    } else {
        modal.classList.remove('hidden');
        showLoginTab();
    }
});

// Modal open/close handlers
loginBtn.onclick = () => {
    modal.classList.remove('hidden');
    showLoginTab();
};

closeBtn.onclick = () => modal.classList.add('hidden');

window.onclick = (e) => {
    if (e.target === modal) modal.classList.add('hidden');
};

// Tab switching
tabs.forEach(btn => {
    btn.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        forms.forEach(f => f.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
        clearErrors();
    });
});

function showLoginTab() {
    tabs.forEach(t => t.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));
    document.querySelector('[data-target="loginForm"]').classList.add('active');
    loginForm.classList.add('active');
    clearErrors();
}

function showRegisterTab() {
    tabs.forEach(t => t.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));
    document.querySelector('[data-target="registerForm"]').classList.add('active');
    registerForm.classList.add('active');
    clearErrors();
}

// Helper: show error visually
function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
    element.style.color = 'red';
}

function clearErrors() {
    loginError.textContent = '';
    loginError.style.display = 'none';
    registerError.textContent = '';
    registerError.style.display = 'none';
}

// Form submissions
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const username = loginForm.querySelector('input[name="username"]').value;
    const password = loginForm.querySelector('input[name="password"]').value;

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.user.username);
            window.location.href = 'chat-bot.html';
        } else {
            showError(loginError, data.error || 'Login failed');
            if (data.error === 'User not found') {
                setTimeout(() => {
                    showRegisterTab();
                }, 1500);
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        showError(loginError, 'Connection error. Please try again.');
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const username = registerForm.querySelector('input[name="username"]').value;
    const password = registerForm.querySelector('input[name="password"]').value;
    const confirmPassword = registerForm.querySelector('input[name="confirmPassword"]').value;

    if (password !== confirmPassword) {
        showError(registerError, 'Passwords do not match');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        console.log('Response:', response);
        const data = await response.json();
        console.log('Data:', data);

        if (response.ok) {
            registerForm.reset();
            showLoginTab();
            showError(loginError, 'Registration successful! Please log in.');
            loginError.style.color = '#4CAF50';
        } else {
            showError(registerError, data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showError(registerError, 'Connection error. Please try again.');
    }
});

// Check authentication status on page load
document.addEventListener('DOMContentLoaded', () => {
    if (checkAuthentication() && window.location.pathname.endsWith('index.html')) {
        loginBtn.textContent = 'Logged In';
        loginBtn.style.backgroundColor = '#4CAF50';
    }
});