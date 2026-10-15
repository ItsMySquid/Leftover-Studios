// Newsletter signup — posts the email to /api/subscribe and reflects
// state in the .form-status live region. Degrades gracefully when the
// site is served statically (GitHub Pages, file://) with no backend.
(function () {
  'use strict';

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var INSTAGRAM_URL = 'https://instagram.com/ItsMySquid';

  var form = document.querySelector('.newsletter-form');
  if (!form) return; // Not on the newsletter page — nothing to do.

  var input = form.querySelector('.form-input') || form.querySelector('#email');
  var button = form.querySelector('button[type="submit"]');
  var status = form.querySelector('.form-status');

  function setStatus(state, message, allowHtml) {
    if (!status) return;
    status.classList.remove('form-status--success', 'form-status--error', 'form-status--pending');
    if (state) status.classList.add('form-status--' + state);
    if (allowHtml) {
      status.innerHTML = message;
    } else {
      status.textContent = message;
    }
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var email = (input && input.value ? input.value : '').trim().toLowerCase();

    if (!EMAIL_RE.test(email)) {
      setStatus('error', 'That doesn\u2019t look like a valid email — check the address and try again.');
      if (input) input.focus();
      return;
    }

    if (button) button.disabled = true;
    setStatus('pending', 'Sending word to the fleet\u2026');

    fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    })
      .then(function (res) {
        return res.json().catch(function () { return { ok: false, error: 'Unexpected response from the server.' }; })
          .then(function (data) { return { status: res.status, data: data }; });
      })
      .then(function (result) {
        var data = result.data || {};
        if (data.ok) {
          if (data.already) {
            setStatus('success', 'You\u2019re already on the list — the fleet knows where to find you.');
          } else {
            setStatus('success', 'Welcome aboard — we\u2019ll send word from the skies.');
          }
          form.reset();
        } else {
          setStatus('error', data.error || 'Something went wrong on our end — please try again.');
        }
      })
      .catch(function () {
        // No backend reachable (file:// preview or static hosting like GitHub Pages).
        setStatus(
          'error',
          'The sign-up desk isn\u2019t reachable right now — this site is being served without its backend. ' +
          'In the meantime, follow us on <a href="' + INSTAGRAM_URL + '" target="_blank" rel="noopener">Instagram</a> for every update.',
          true
        );
      })
      .finally(function () {
        if (button) button.disabled = false;
      });
  });
})();
