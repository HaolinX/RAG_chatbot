document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    localStorage.setItem('token', data.token);
                    window.location.href = 'chat-bot.html';
                } else {
                    alert('Login failed: ' + data.message);
                }
            });
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const username = document.getElementById('username').value;
            const password1 = document.getElementById('password1').value;
            const password2 = document.getElementById('password2').value;

            if (password1 === password2) {
                fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password: password1 })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Registration successful. Please login.');
                    } else {
                        alert('Registration failed: ' + data.message);
                    }
                });
            } else {
                alert('Passwords do not match!');
            }
        });
    }
});

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}
