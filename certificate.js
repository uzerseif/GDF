/* =========================================
   GDF'27 — certificate details page
   The URL carries only the certificate ID; the details are fetched again from Supabase.
   ========================================= */
(function () {
  var V = window.GDFVerify;
  var PLACEHOLDER = 'assets/certificate-placeholder.svg';
  var EMBLEM = 'images/emblem-gold.webp';

  /* key: [title, text] — English fallbacks; Arabic/Turkish live in translations.js (cert.err.<key>.t / .d) */
  var ERRORS = {
    missing:    ['Certificate ID missing', 'Return to the verification page and enter an ID.'],
    unavail:    ['Service unavailable', 'Certificate details are not available right now. Refresh the page and try again.'],
    notfound:   ['Certificate not found', 'This ID does not exist in the GDF’27 records.'],
    failed:     ['Unable to load certificate', 'Please try again later.'],
    unexpected: ['Unexpected error', 'Could not load certificate details.']
  };
  var STATUS_FALLBACK = {
    revoked: 'Revoked', expired: 'Expired', invalid: 'Invalid', unknown: 'Unknown', notvalid: 'Not valid'
  };

  var state = null; /* null while loading, then { cert, id } or { error } */

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function safeImage(value) {
    if (!value || typeof value !== 'string') return null;
    try {
      var u = new URL(value, location.href);
      return ['https:', 'http:'].indexOf(u.protocol) !== -1 ? u.href : null;
    } catch (e) { return null; }
  }

  function backLink(label, className) {
    var a = make('a', className, label);
    a.href = 'verify.html';
    return a;
  }

  function drawLoading(root) {
    var box = make('div', 'loading-state');
    box.setAttribute('role', 'status');
    var spinner = make('span', 'verify-spinner');
    spinner.setAttribute('aria-hidden', 'true');
    box.append(spinner, make('span', null, V.t('cert.loading', 'Retrieving certificate details...')));
    root.replaceChildren(box);
  }

  function drawError(root, key) {
    var box = make('div', 'page-message');
    box.setAttribute('role', 'alert');
    box.append(
      make('strong', null, V.t('cert.err.' + key + '.t', ERRORS[key][0])),
      make('p', null, V.t('cert.err.' + key + '.d', ERRORS[key][1])),
      backLink(V.t('cert.goVerify', 'Go to Verification'), 'cert-btn')
    );
    root.replaceChildren(box);
  }

  function statusText(c, valid) {
    if (valid) return '✓ ' + V.t('cert.status.valid', 'Verified & Authentic');
    var raw = String(c.status || '').trim().toLowerCase();
    if (!raw) return '! ' + V.t('cert.status.notvalid', STATUS_FALLBACK.notvalid);
    return '! ' + (STATUS_FALLBACK[raw] ? V.t('cert.status.' + raw, STATUS_FALLBACK[raw]) : c.status);
  }

  function addItem(list, label, value) {
    if (value == null || String(value).trim() === '') return; /* optional fields stay hidden when empty */
    var item = make('div', 'detail-item');
    var text = make('div', 'detail-value');
    text.textContent = String(value);
    text.setAttribute('dir', 'auto');
    item.append(make('span', 'detail-label', label), text);
    list.append(item);
  }

  function drawCertificate(root, c, id) {
    var valid = String(c.status || '').trim().toLowerCase() === 'valid';
    var original = safeImage(c.certificate_image);
    var card = make('section', 'detail-card');

    /* status + certificate number */
    var statusRow = make('div', 'detail-status');
    statusRow.append(make('span', 'status-pill' + (valid ? '' : ' invalid'), statusText(c, valid)));
    var number = make('span', 'cert-number', V.t('cert.id', 'Certificate ID') + ': ');
    var numberValue = make('bdi', null, c.certificate_id || id);
    numberValue.setAttribute('dir', 'ltr');
    number.append(numberValue);
    statusRow.append(number);

    /* recipient */
    var who = make('div', 'recipient');
    var emblem = make('img', 'recipient-emblem');
    emblem.src = EMBLEM; emblem.alt = ''; emblem.width = 64; emblem.height = 64;
    var name = make('h2', 'recipient-name', c.recipient_name || '—');
    name.setAttribute('dir', 'auto');
    who.append(emblem, make('p', 'recipient-label', V.t('cert.recipient', 'Recipient Name')), name);

    /* certificate image */
    var figure = make('figure', 'certificate-figure');
    var frame = make('div', 'certificate-frame');
    var img = make('img');
    img.src = original || PLACEHOLDER;
    img.alt = V.t('cert.imgAlt', "GDF'27 certificate for {name}", { name: c.recipient_name || '—' });
    var caption = make('figcaption', 'image-caption');
    var usingOriginal = !!original;
    function drawCaption() {
      caption.textContent = usingOriginal
        ? V.t('cert.caption.orig', 'Original certificate image')
        : V.t('cert.caption.temp', 'Temporary preview — the original image has not been uploaded yet.');
    }
    img.addEventListener('error', function () {
      if (usingOriginal) { usingOriginal = false; img.src = PLACEHOLDER; drawCaption(); }
    });
    drawCaption();
    frame.append(img);
    figure.append(frame, caption);

    /* details */
    var list = make('div', 'details-list');
    addItem(list, V.t('cert.conference', 'Conference'), c.conference_name || "GDF'27");
    addItem(list, V.t('cert.committee', 'Committee'), c.committee_name || c.course_name);
    addItem(list, V.t('cert.country', 'Representing'), c.represented_country);
    addItem(list, V.t('cert.type', 'Certificate Type'), c.certificate_type);
    addItem(list, V.t('cert.date', 'Issue Date'), V.formatDate(c.issue_date));
    addItem(list, V.t('cert.summary', 'Performance Summary'), c.performance_summary);

    var layout = make('div', 'cert-layout');
    layout.append(figure, list);

    /* actions */
    var actions = make('div', 'detail-actions');
    if (valid && original) {
      var open = make('a', 'cert-btn', V.t('cert.open', 'Open Certificate Image'));
      open.href = original; open.target = '_blank'; open.rel = 'noopener noreferrer';
      actions.append(open);
    }
    actions.append(backLink(V.t('cert.another', 'Verify Another Certificate'), 'cert-btn ghost'));

    card.append(statusRow, who, layout, actions);
    root.replaceChildren(card);
  }

  function draw() {
    var root = document.getElementById('certificateContent');
    if (!root) return;
    if (!state) drawLoading(root);
    else if (state.error) drawError(root, state.error);
    else drawCertificate(root, state.cert, state.id);
  }

  document.addEventListener('gdf:languagechange', draw);

  document.addEventListener('DOMContentLoaded', function () {
    var id = V.normalize(new URLSearchParams(location.search).get('id'));
    draw();
    if (!id) { state = { error: 'missing' }; draw(); return; }
    V.lookup(id).then(function (result) {
      state = result.error ? { error: result.error } : { cert: result.cert, id: id };
      draw();
    });
  });
})();
