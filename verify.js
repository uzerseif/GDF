/* =========================================
   GDF'27 — certificate verification page
   Checks the ID, then opens certificate.html?id=...
   ========================================= */
(function () {
  var V = window.GDFVerify;
  var LIMIT = { attempts: 0, started: Date.now(), max: 10, windowMs: 60000 };

  /* key: [title, text] — English fallbacks; Arabic/Turkish live in translations.js (verify.msg.<key>.t / .d) */
  var MESSAGES = {
    required:   ['Certificate ID required', 'Please enter a certificate ID.'],
    toolong:    ['Invalid ID', 'The certificate ID is too long.'],
    rate:       ['Please wait', 'Too many attempts. Wait one minute and try again.'],
    unavail:    ['Service unavailable', 'Verification is not available right now. Refresh the page and try again.'],
    checking:   ['Checking official records', 'Please wait while we verify this certificate.'],
    notfound:   ['Certificate not found', 'This ID could not be found in the official GDF’27 records.'],
    failed:     ['Unable to verify', 'Please try again later.'],
    unexpected: ['Unexpected error', 'Please try again later.']
  };

  var busy = false;
  var shown = null; /* { key, kind } of the message on screen, so it can be re-translated */

  function el(id) { return document.getElementById(id); }

  function limited() {
    var now = Date.now();
    if (now - LIMIT.started >= LIMIT.windowMs) { LIMIT.attempts = 0; LIMIT.started = now; }
    return ++LIMIT.attempts > LIMIT.max;
  }

  function renderButton() {
    var label = el('verifyBtnLabel');
    if (label) label.textContent = busy ? V.t('verify.btn.loading', 'Verifying...') : V.t('verify.btn', 'Verify Certificate');
  }

  function renderMessage() {
    var area = el('resultArea');
    if (!area) return;
    if (!shown) { area.replaceChildren(); return; }

    var box = document.createElement('div');
    box.className = 'result-box ' + shown.kind;
    box.setAttribute('role', shown.kind === 'error' ? 'alert' : 'status');
    if (shown.kind === 'info') {
      var spinner = document.createElement('span');
      spinner.className = 'verify-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      box.append(spinner);
    }
    var copy = document.createElement('div');
    var title = document.createElement('h2');
    title.className = 'result-title';
    title.textContent = V.t('verify.msg.' + shown.key + '.t', MESSAGES[shown.key][0]);
    var text = document.createElement('p');
    text.className = 'result-message';
    text.textContent = V.t('verify.msg.' + shown.key + '.d', MESSAGES[shown.key][1]);
    copy.append(title, text);
    box.append(copy);
    area.replaceChildren(box);
  }

  function show(key, kind) {
    shown = { key: key, kind: kind };
    renderMessage();
  }

  function setBusy(value) {
    busy = value;
    var button = el('verifyBtn');
    if (button) button.disabled = value;
    renderButton();
  }

  function verify() {
    if (busy) return;
    var input = el('certInput');
    var id = V.normalize(input.value);
    input.value = id;

    if (!id) return show('required', 'error');
    if (id.length > 100) return show('toolong', 'error');
    if (limited()) return show('rate', 'error');

    setBusy(true);
    show('checking', 'info');
    V.lookup(id).then(function (result) {
      if (result.error) { show(result.error, 'error'); return; }
      var url = new URL('certificate.html', location.href);
      url.searchParams.set('id', id);
      location.assign(url.href);
    }).then(function () {
      setBusy(false);
    });
  }

  document.addEventListener('gdf:languagechange', function () {
    renderButton();
    renderMessage();
  });

  document.addEventListener('DOMContentLoaded', function () {
    var form = el('verifyForm');
    var input = el('certInput');
    if (!form || !input) return;

    renderButton();
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      verify();
    });

    var id = new URLSearchParams(location.search).get('id');
    if (id) {
      input.value = V.normalize(id);
      verify();
    }
  });
})();
