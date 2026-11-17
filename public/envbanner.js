// Marks the test site (samasalt-mitra-staging.*) on every page, on screen and on paper, so a
// test poster or answer can never be mistaken for the real service. Does nothing on the live site.
(function () {
  if (!/-staging\./.test(location.hostname)) return;
  var b = document.createElement('div');
  b.setAttribute('role', 'note');
  b.textContent = 'TEST ENVIRONMENT · test data only · not for patients';
  b.style.cssText = 'background:#b3141a;color:#fff;font:600 13px/1.3 system-ui,sans-serif;letter-spacing:.04em;text-align:center;padding:6px 12px;-webkit-print-color-adjust:exact;print-color-adjust:exact';
  document.body.insertBefore(b, document.body.firstChild);
  document.title = '[TEST] ' + document.title;
})();
