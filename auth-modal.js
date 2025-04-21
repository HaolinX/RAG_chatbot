const loginBtn = document.getElementById('loginBtn');
const modal = document.getElementById('authModal');
const closeBtn = document.querySelector('.close');
const tabs = document.querySelectorAll('.tab');
const forms = document.querySelectorAll('.form');

// open modal when login button is click
loginBtn.onclick = () => modal.classList.remove('hidden');

// tab switching functionality
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    // remove active class from all tabs and forms
    tabs.forEach(t => t.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));

    // add active class to clicked tab and corresponding form
    btn.classList.add('active');
    document.getElementById(btn.dataset.target).classList.add('active');
  });
});

// close modal when close button is clicked
closeBtn.onclick = () => modal.classList.add('hidden');

// close modal when clicking outside content
window.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.add('hidden');
});