/* =========================================
   GDF'27 — "Download PDF" for the certificate details page
   Builds an A4 sheet (works in English, Arabic and Turkish), captures it and saves it as a PDF.
   html2canvas + jsPDF are loaded only when the button is pressed.
   ========================================= */
(function () {
  var V = window.GDFVerify;
  var H2C_URLS = [
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
  ];
  var JSPDF_URLS = [
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
  ];
  var ASSETS = window.GDFPdfAssets || {};
  var SHEET_WIDTH = 794;   /* A4 at 96 dpi */

  /* Errors carry a short code (libs / image / render) that the page shows next to the message. */
  function fail(code, cause) {
    var e = new Error(code);
    e.code = code;
    e.cause = cause;
    return e;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { s.remove(); reject(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }

  /* tries each address in turn until the library is available */
  function loadLibrary(urls, isReady) {
    if (isReady()) return Promise.resolve();
    return urls.reduce(function (chain, url) {
      return chain.catch(function () {
        return loadScript(url).then(function () { if (!isReady()) throw new Error('Library missing after load'); });
      });
    }, Promise.reject());
  }

  function ensureLibraries() {
    return Promise.all([
      loadLibrary(H2C_URLS, function () { return !!window.html2canvas; }),
      loadLibrary(JSPDF_URLS, function () { return !!(window.jspdf && window.jspdf.jsPDF); })
    ]).catch(function (e) { throw fail('libs', e); });
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  /* Certificate photo: downloaded as a blob first, so the canvas can never be tainted by a cross-origin image. */
  function loadCertificateImage(url) {
    return fetch(url, { mode: 'cors', cache: 'reload' })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.blob(); })
      .then(function (blob) { return loadImage(URL.createObjectURL(blob)); })
      .then(function (img) { if (!img) throw new Error('Image could not be decoded'); return img; })
      .catch(function (e) { throw fail('image', e); });
  }

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function field(parent, label, value) {
    if (value == null || String(value).trim() === '') return;
    var item = make('div', 'pdf-field');
    var v = make('div', 'pdf-value', String(value));
    v.setAttribute('dir', 'auto');
    item.append(make('div', 'pdf-label', label), v);
    parent.append(item);
  }

  function buildSheet(c, id, image) {
    var valid = String(c.status || '').trim().toLowerCase() === 'valid';
    var sheet = make('div', 'pdf-sheet');
    sheet.setAttribute('dir', document.documentElement.dir || 'ltr');
    sheet.setAttribute('lang', document.documentElement.lang || 'en');

    /* header band */
    var head = make('div', 'pdf-head');
    var emblem = make('img');
    emblem.src = ASSETS.emblem; emblem.alt = '';
    var brand = make('div');
    brand.append(make('div', 'pdf-brand', "GDF'27"), make('div', 'pdf-brand-sub', 'Gaziantep Diplomacy Forum'));
    head.append(emblem, brand, make('div', 'pdf-doc', V.t('cert.eyebrow', 'Official Certificate Record')));

    /* body */
    var body = make('div', 'pdf-body');
    var statusText = valid ? '✓ ' + V.t('cert.status.valid', 'Verified & Authentic') : '! ' + (c.status || V.t('cert.status.notvalid', 'Not valid'));
    var intro = make('div', 'pdf-intro');
    intro.append(
      make('div', 'pdf-status' + (valid ? '' : ' invalid'), statusText),
      make('div', 'pdf-label', V.t('cert.recipient', 'Recipient Name'))
    );
    var name = make('div', 'pdf-name', c.recipient_name || '—');
    name.setAttribute('dir', 'auto');
    intro.append(name);

    var frame = make('div', 'pdf-frame');
    image.className = 'pdf-image';
    frame.append(image);

    var grid = make('div', 'pdf-grid');
    field(grid, V.t('cert.conference', 'Conference'), c.conference_name || "GDF'27");
    field(grid, V.t('cert.committee', 'Committee'), c.committee_name || c.course_name);
    field(grid, V.t('cert.country', 'Representing'), c.represented_country);
    field(grid, V.t('cert.type', 'Certificate Type'), c.certificate_type);
    field(grid, V.t('cert.date', 'Issue Date'), V.formatDate(c.issue_date));
    field(grid, V.t('cert.id', 'Certificate ID'), c.certificate_id || id);
    body.append(intro, frame, grid);

    /* footer */
    var link = new URL('certificate.html', location.href);
    link.searchParams.set('id', id);
    var foot = make('div', 'pdf-foot');
    var verify = make('div');
    verify.append(make('span', null, V.t('cert.pdf.verifyAt', 'Verify this certificate at:') + ' '));
    var url = make('bdi', null, link.href);
    url.setAttribute('dir', 'ltr');
    verify.append(url);
    var today = V.formatDate(new Date().toISOString().slice(0, 10));
    foot.append(verify, make('div', null, V.t('cert.pdf.generated', 'Generated on {date}', { date: today })));

    sheet.append(head, make('div', 'pdf-rule'), body, foot);
    return sheet;
  }

  function download(c, id, imageUrl) {
    var sheet = null;
    var cleanup = function () { if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet); };

    return ensureLibraries()
      .then(function () { return document.fonts && document.fonts.ready; })
      .then(function () { return imageUrl ? loadCertificateImage(imageUrl) : loadImage(ASSETS.placeholder); })
      .then(function (img) {
        if (!img) throw fail('image', new Error('Placeholder could not be loaded'));
        sheet = buildSheet(c, id, img);
        document.body.appendChild(sheet);
        return new Promise(function (resolve) { requestAnimationFrame(function () { resolve(); }); });
      })
      .then(function () {
        return window.html2canvas(sheet, { scale: 2, backgroundColor: '#ffffff', windowWidth: SHEET_WIDTH, logging: false });
      })
      .then(function (canvas) {
        var pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        pdf.setProperties({ title: "GDF'27 Certificate " + id, subject: 'Certificate', author: "GDF'27" });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297);
        pdf.save('GDF27-Certificate-' + id + '.pdf');
      })
      .then(cleanup, function (e) { cleanup(); throw typeof e.code === 'string' ? e : fail('render', e); });
  }

  window.GDFCertificatePDF = { download: download };
})();
