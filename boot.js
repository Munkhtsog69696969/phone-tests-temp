// Runs before any app code. Written in ES5 so it still reports on old browsers.
(function () {
  var E = window.__E2E;
  if (!E || !E.cell) return;
  try {
    localStorage.clear();
    sessionStorage.clear();
    for (var key in E.seed) if (E.seed.hasOwnProperty(key)) localStorage.setItem(key, E.seed[key]);
    if (E.profile && E.profile.theme) localStorage.setItem('khaansoft-theme', E.profile.theme);
  } catch (e) { /* the audit reports whatever follows from this */ }

  var S = window.__e2eState = { errors: [], inflight: 0, lastChange: Date.now(), bootAt: Date.now(), reported: false };

  window.addEventListener('error', function (ev) {
    var msg = ev.message || (ev.error && ev.error.message) || '';
    if (!msg || /ResizeObserver loop/.test(msg)) return;
    S.errors.push(msg.slice(0, 300));
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason;
    S.errors.push('unhandled: ' + String((r && r.message) || r).slice(0, 300));
  });

  var realFetch = window.fetch;
  if (realFetch) {
    window.fetch = function () {
      S.inflight++;
      var done = function () { S.inflight--; S.lastChange = Date.now(); };
      var p = realFetch.apply(this, arguments);
      p.then(done, done);
      return p;
    };
  }
  var realSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    S.inflight++;
    var settled = false;
    var done = function () { if (!settled) { settled = true; S.inflight--; S.lastChange = Date.now(); } };
    this.addEventListener('loadend', done);
    return realSend.apply(this, arguments);
  };

  function watch() {
    if (!window.MutationObserver) return;
    new MutationObserver(function () { S.lastChange = Date.now(); })
      .observe(document, { childList: true, subtree: true, characterData: true });
  }
  watch();
})();
