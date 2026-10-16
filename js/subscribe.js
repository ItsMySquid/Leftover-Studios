// Newsletter signup — posts the email to a Google Apps Script web app
// that appends it to a private Google Sheet, and reflects state in the
// .form-status live region. Works on static hosting (GitHub Pages).
(function () {
  'use strict';

  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbzJ5OZ1GRl693Z5m1eVDfcPIqfBSbL7Upr0r_RW8C_I0uOS1XQCrHyKYVYwwCTTJi1b/exec';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var INSTAGRAM_URL = 'https://www.instagram.com/overleft.studios/';
  var TIKTOK_URL = 'https://www.tiktok.com/@overleft.studios';

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

    // text/plain keeps this a CORS "simple request" — Apps Script web
    // apps don't answer preflight OPTIONS, so application/json fails.
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
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
        // Network failure — the Apps Script endpoint couldn't be reached at all.
        setStatus(
          'error',
          'The sign-up desk isn\u2019t reachable right now — please check your connection and try again. ' +
          'In the meantime, follow us on <a href="' + INSTAGRAM_URL + '" target="_blank" rel="noopener">Instagram</a> ' +
          'or <a href="' + TIKTOK_URL + '" target="_blank" rel="noopener">TikTok</a> for every update.',
          true
        );
      })
      .finally(function () {
        if (button) button.disabled = false;
      });
  });
})();
