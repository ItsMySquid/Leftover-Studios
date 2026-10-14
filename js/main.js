const toggle = document.querySelector('.nav-toggle');
const menu = document.querySelector('.nav-menu');

toggle.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
});

document.querySelectorAll('#year').forEach((el) => {
  el.textContent = new Date().getFullYear();
});
