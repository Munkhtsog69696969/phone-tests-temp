// Self-driving page audit. Same code on Chrome, Android Chrome and iOS Safari.
// ES5 only, so a browser too old for the app can still say so.
(function () {
  var E = window.__E2E;
  if (!E || !E.cell) return;
  var S = window.__e2eState;
  var CELL = E.cell;
  var PROFILE = E.profile || {};
  var CAP = 40;
  var INTERACTIVE = 'a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=tab],[role=switch],[role=checkbox],[role=menuitem],[role=option]';
  var NON_TEXT_INPUT = /^(hidden|file|checkbox|radio|range|color|button|submit|reset|image)$/i;
  var finished = false;

  function width() { return PROFILE.width || document.documentElement.clientWidth; }
  function height() { return window.innerHeight; }

  function post(url, body, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () { var v = {}; try { v = JSON.parse(xhr.responseText); } catch (e) {} if (cb) cb(v); };
    xhr.onerror = function () { if (cb) cb({}); };
    xhr.send(JSON.stringify(body));
  }

  function describe(el) {
    var cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 5).join('.') : '';
    var text = (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title'))) || (el.textContent || '');
    text = String(text).replace(/\s+/g, ' ').trim().slice(0, 40);
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '') + (text ? ' "' + text + '"' : '');
  }
  function roundRect(r) {
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  }
  function style(el) { return window.getComputedStyle(el); }
  function isShown(r, cs) { return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; }
  function isSrOnly(r, cs) {
    return (r.width <= 2 && r.height <= 2) || (cs.position === 'absolute' && cs.clip !== 'auto' && cs.clip !== '' && r.width <= 2);
  }
  function insideSrOnly(el) {
    var node = el.parentElement;
    while (node && node !== document.body) {
      var nr = node.getBoundingClientRect();
      if (nr.width <= 2 && nr.height <= 2 && style(node).overflow !== 'visible') return true;
      node = node.parentElement;
    }
    return false;
  }
  function opacityChain(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      if (parseFloat(style(node).opacity) === 0) return 0;
      node = node.parentElement;
    }
    return 1;
  }
  function pointerNone(el) { return style(el).pointerEvents === 'none'; }
  function inHorizontalScroller(el) {
    var node = el.parentElement;
    while (node && node !== document.documentElement) {
      var ox = style(node).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && node.scrollWidth > node.clientWidth + 1) return true;
      node = node.parentElement;
    }
    return false;
  }
  function inDrawerLikeLayer(el) {
    var node = el;
    while (node && node !== document.documentElement) {
      var cs = style(node);
      if (cs.position === 'fixed' || (cs.transform && cs.transform !== 'none')) return true;
      node = node.parentElement;
    }
    return false;
  }
  function closest(el, selector) {
    var node = el;
    while (node && node.nodeType === 1) {
      if (node.matches ? node.matches(selector) : node.webkitMatchesSelector(selector)) return node;
      node = node.parentElement;
    }
    return null;
  }
  function hasOwnText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return true;
    return false;
  }
  function ownTextRect(el) {
    var right = -Infinity, left = Infinity, any = false;
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType !== 3 || !/\S/.test(n.nodeValue)) continue;
      var range = document.createRange();
      range.selectNodeContents(n);
      var r = range.getBoundingClientRect();
      if (r.width > 0) { any = true; right = Math.max(right, r.right); left = Math.min(left, r.left); }
    }
    return any ? { left: left, right: right } : null;
  }

  function addUnique(list, seen, key, item) {
    list.count = (list.count || 0) + 1;
    if (seen[key]) { seen[key].n = (seen[key].n || 1) + 1; return; }
    seen[key] = item;
    if (list.length < CAP) list.push(item);
  }
  function bucket() { var b = []; b.seen = {}; b.count = 0; return b; }
  function add(b, el, extra) {
    var key = describe(el);
    extra = extra || {};
    extra.d = key;
    addUnique(b, b.seen, key, extra);
  }
  function plain(b) { return { count: b.count, items: b.slice() }; }

  // Largest vertical scrollers, excluding the window.
  function verticalScrollers() {
    var out = [];
    var all = document.body ? document.body.getElementsByTagName('*') : [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.scrollHeight <= el.clientHeight + 1 || el.clientHeight < 80) continue;
      var oy = style(el).overflowY;
      if (oy !== 'auto' && oy !== 'scroll') continue;
      var r = el.getBoundingClientRect();
      // A scroller inside a closed drawer sits off screen and scrolls nothing the user can see.
      if (r.width > 0 && r.height > 0 && r.right > 0 && r.left < width() && r.bottom > 0 && r.top < height()) out.push(el);
    }
    return out;
  }

  // True when a point lies outside what an ancestor scroll box shows, so it is simply scrolled away.
  function scrolledAway(el, x, y) {
    var node = el.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      var cs = style(node);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        var b = node.getBoundingClientRect();
        if (x <= b.left || x >= b.right || y <= b.top || y >= b.bottom) return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  function audit(stage) {
    var w = width();
    var h = height();
    var root = document.documentElement;
    var body = document.body;
    var touch = window.matchMedia && window.matchMedia('(hover: none)').matches;
    var result = {
      stage: stage, path: location.pathname, ua: navigator.userAgent, dpr: window.devicePixelRatio,
      layoutWidth: root.clientWidth, innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      screenWidth: screen.width, screenHeight: screen.height, hoverNone: !!touch,
      mounted: !!(document.getElementById('root') && document.getElementById('root').children.length) || CELL.selftest,
      settled: !!S.settled, fontsOk: !!S.fontsOk, watchdog: stage === 'watchdog',
    };
    var pageWidth = Math.max(root.scrollWidth, body ? body.scrollWidth : 0);
    result.docOverflow = pageWidth > w + 1 ? { pageWidth: pageWidth, width: w } : null;

    var offEdge = bucket(), clipped = bucket(), truncated = bucket(), tapFail = bucket(), tapWarn = bucket();
    var smallInput = bucket(), behindNav = bucket(), obscured = bucket(), hoverHidden = bucket();
    var nav = document.querySelector('[data-tour="bottom-nav"]');
    var navRect = null;
    if (nav) { var nr = nav.getBoundingClientRect(); if (nr.height > 0 && style(nav).display !== 'none') navRect = nr; }

    var all = body ? body.getElementsByTagName('*') : [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'path' || tag === 'g' || el.ownerSVGElement) continue;
      var r = el.getBoundingClientRect();
      var cs = style(el);
      if (!isShown(r, cs) || isSrOnly(r, cs)) continue;
      var interactive = el.matches ? el.matches(INTERACTIVE) : false;
      var ownText = hasOwnText(el);
      if ((interactive || ownText) && insideSrOnly(el)) continue;
      var decorative = closest(el, '[aria-hidden="true"]') && !interactive;

      // Past the screen edge.
      if (!decorative && (r.right > w + 1 || r.left < -1)) {
        var isContent = ownText || interactive || tag === 'IMG' || tag === 'CANVAS' || tag === 'VIDEO' || tag === 'TABLE';
        var fullyOff = r.right <= 0 || r.left >= w;
        if (isContent && !inHorizontalScroller(el) && !(fullyOff && inDrawerLikeLayer(el))) {
          add(offEdge, el, { rect: roundRect(r) });
        }
      }

      // Clipped text, only for text that is on screen.
      if (ownText && r.right > 0 && r.left < w) {
        var ownClips = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
        var ellipsis = cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none');
        if (ownClips && (el.scrollWidth > el.clientWidth + 1 || (ellipsis && el.scrollHeight > el.clientHeight + 1))) {
          if (ellipsis) add(truncated, el, { full: el.scrollWidth, shown: el.clientWidth });
          else add(clipped, el, { full: el.scrollWidth, shown: el.clientWidth });
        } else if (!ownClips) {
          var box = ownTextRect(el);
          var node = el.parentElement, depth = 0;
          while (box && node && node !== body && depth < 10) {
            var ncs = style(node);
            if (ncs.overflowX === 'auto' || ncs.overflowX === 'scroll') break;
            if (ncs.overflowX === 'hidden' || ncs.overflowX === 'clip') {
              var nb = node.getBoundingClientRect();
              if (box.right > nb.right + 1 || box.left < nb.left - 1) add(clipped, el, { textRight: Math.round(box.right), boxRight: Math.round(nb.right) });
              break;
            }
            node = node.parentElement; depth++;
          }
        }
      }

      if (!interactive) continue;
      var isInput = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
      var inputType = (el.getAttribute('type') || 'text');

      // Fonts below 16px make iPhone Safari zoom in on focus. Transparent overlays still count.
      if ((tag === 'SELECT' || tag === 'TEXTAREA' || (tag === 'INPUT' && !NON_TEXT_INPUT.test(inputType))) && parseFloat(cs.fontSize) < 16) {
        add(smallInput, el, { font: parseFloat(cs.fontSize) });
      }

      var invisible = opacityChain(el) === 0;
      if (touch && invisible && !isInput && !pointerNone(el) && r.right > 0 && r.left < w) {
        add(hoverHidden, el, { rect: roundRect(r) });
      }
      if (invisible || (isInput && NON_TEXT_INPUT.test(inputType))) continue;

      // Tap size. Links inside running text are exempt.
      var inlineLink = tag === 'A' && cs.display === 'inline' && el.parentElement && hasOwnText(el.parentElement);
      var side = Math.min(r.width, r.height);
      if (!inlineLink && r.right > 0 && r.left < w) {
        if (side < 24) add(tapFail, el, { w: Math.round(r.width), h: Math.round(r.height) });
        else if (side < 44) add(tapWarn, el, { w: Math.round(r.width), h: Math.round(r.height) });
      }

      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var inNav = nav && nav.contains(el);

      // Stuck behind the bottom nav even after scrolling to the end.
      if (stage === 'end' && navRect && !inNav && r.bottom > navRect.top + 1 && r.top < navRect.bottom && cs.position !== 'fixed' && !inDrawerLikeLayer(el)) {
        add(behindNav, el, { bottom: Math.round(r.bottom), navTop: Math.round(navRect.top) });
      }

      // Covered by something else.
      if (cx >= 0 && cx < w && cy >= 0 && cy < h && !inNav && document.elementFromPoint && !scrolledAway(el, cx, cy)) {
        var top = document.elementFromPoint(cx, cy);
        if (top && top !== el && !el.contains(top) && !top.contains(el)) {
          var layer = top, isFrame = false, isOverlay = false;
          while (layer && layer !== body) {
            var lcs = style(layer);
            if (lcs.position === 'fixed') {
              var lr = layer.getBoundingClientRect();
              if (lr.width * lr.height > 0.6 * w * h) isOverlay = true;
              else if (nav && nav.contains(layer)) isFrame = true;
              else if (lr.top <= 1 && lr.height < 100) isFrame = stage !== 'top';
            }
            layer = layer.parentElement;
          }
          var ownLabel = closest(el, 'label') && closest(top, 'label') === closest(el, 'label');
          if (!isOverlay && !isFrame && !ownLabel) add(obscured, el, { by: describe(top).slice(0, 80) });
        }
      }
    }

    result.offEdge = plain(offEdge);
    result.clipped = plain(clipped);
    result.truncated = plain(truncated);
    result.tapFail = plain(tapFail);
    result.tapWarn = plain(tapWarn);
    result.smallInput = plain(smallInput);
    result.behindNav = plain(behindNav);
    result.obscured = plain(obscured);
    result.hoverHidden = plain(hoverHidden);

    // Window and a large inner scroller both scrolling.
    var windowScrolls = Math.max(root.scrollHeight, body ? body.scrollHeight : 0) > root.clientHeight + 1 && style(root).overflowY !== 'hidden';
    var inner = verticalScrollers().filter(function (s) {
      var sr = s.getBoundingClientRect();
      return sr.height > 0.5 * h;
    });
    result.doubleScroll = windowScrolls && inner.length ? {
      pageHeight: Math.max(root.scrollHeight, body ? body.scrollHeight : 0), viewport: root.clientHeight,
      inner: inner.slice(0, 3).map(describe),
    } : null;

    // Keyboard and zoom state.
    var vv = window.visualViewport;
    var active = document.activeElement;
    var keyboard = { scale: vv ? vv.scale : null, vvHeight: vv ? Math.round(vv.height) : null, vvTop: vv ? Math.round(vv.offsetTop) : null, inner: window.innerHeight };
    if (active && active !== body && active !== root) {
      var ar = active.getBoundingClientRect();
      keyboard.focused = describe(active);
      keyboard.focusedBottom = Math.round(ar.bottom);
      keyboard.fieldBelowView = vv ? ar.bottom > vv.offsetTop + vv.height + 1 : false;
    }
    keyboard.zoomed = !!(vv && vv.scale > 1.01);
    result.keyboard = keyboard;

    var text = body ? (body.innerText || '') : '';
    var badText = text.match(/(^|[\s:(])(undefined|NaN|Invalid Date)([\s,.)]|$)|\[object Object\]/g);
    result.badText = badText ? badText.slice(0, 8).map(function (s) { return s.trim(); }) : [];
    result.forbidHits = [];
    for (var f = 0; f < (CELL.forbid || []).length; f++) {
      var rule = CELL.forbid[f];
      var hit = rule.indexOf('sel:') === 0 ? !!document.querySelector(rule.slice(4)) : text.indexOf(rule) >= 0;
      if (hit) result.forbidHits.push(rule);
    }
    result.errors = S.errors.slice(0, 10);
    result.textSample = text.replace(/\s+/g, ' ').trim().slice(0, 160);
    result.elements = all.length;
    return result;
  }

  // Wait for fonts, including Mongolian letters that load from a separate subset.
  function fonts(cb) {
    if (CELL.selftest) { S.fontsOk = true; return cb(); }
    if (!document.fonts || !document.fonts.load) { S.fontsOk = false; return cb(); }
    var called = false;
    var finish = function (ok) { if (called) return; called = true; S.fontsOk = ok; cb(); };
    var once = function () {
      return Promise.all([
        document.fonts.load('16px Inter', 'Өө Үү'),
        document.fonts.load('600 16px Onest', 'Өө Үү'),
        document.fonts.load('24px "Material Symbols Outlined"', 'home'),
      ]).then(function (lists) { return lists.every(function (l) { return l.length > 0; }); });
    };
    setTimeout(function () { finish(false); }, 12000);
    once().then(function (ok) {
      if (ok) return true;
      return new Promise(function (r) { setTimeout(r, 1500); }).then(once);
    }).then(finish, function () { finish(false); });
  }

  function settle(minMs, cb) {
    var start = Date.now();
    var timer = setInterval(function () {
      var now = Date.now();
      var quiet = S.inflight <= 0 && now - S.lastChange > 700 && now - start > minMs;
      if (quiet) { clearInterval(timer); S.settled = true; cb(); }
      else if (now - start > 15000) { clearInterval(timer); S.settled = false; cb(); }
    }, 100);
  }

  function find(selector) {
    if (selector.indexOf('text:') === 0) {
      var wanted = selector.slice(5);
      var candidates = document.querySelectorAll('button,a,[role=button],[role=tab]');
      for (var i = 0; i < candidates.length; i++) if ((candidates[i].textContent || '').indexOf(wanted) >= 0) return candidates[i];
      return null;
    }
    return document.querySelector(selector);
  }

  function runScene(steps, cb) {
    S.scene = { steps: [], ok: true };
    var i = 0;
    var next = function () {
      if (i >= steps.length) return cb();
      var step = steps[i++];
      if (step.click) {
        var target = find(step.click);
        S.scene.steps.push({ click: step.click, found: !!target });
        if (!target) { S.scene.ok = false; return next(); }
        target.click();
        return settle(500, next);
      }
      if (step.realTap) {
        var field = find(step.realTap);
        S.scene.steps.push({ realTap: step.realTap, found: !!field });
        if (!field) { S.scene.ok = false; return next(); }
        var sendTap = function (offset) {
          var r = field.getBoundingClientRect();
          post('/__e2e/tap', {
            selector: step.realTap,
            rect: { x: r.left, y: r.top, w: r.width, h: r.height },
            dpr: window.devicePixelRatio, innerWidth: window.innerWidth, innerHeight: window.innerHeight,
            offset: offset || null,
          }, function (reply) {
            S.scene.tap = reply;
            setTimeout(next, 1500);
          });
        };
        return post('/__e2e/tap', { probe: true }, function (probe) {
          if (!probe.calibrate) return sendTap(null);
          // adb taps screen pixels, so learn where the page sits on the screen first.
          // The cover swallows this tap so it can't press anything.
          var cover = document.createElement('div');
          cover.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:transparent;touch-action:none';
          var touch = null;
          cover.addEventListener('touchstart', function (ev) {
            var t = ev.touches[0];
            touch = { x: t.clientX, y: t.clientY };
            ev.preventDefault();
          }, { passive: false });
          document.body.appendChild(cover);
          setTimeout(function () {
            post('/__e2e/tap', { calibrateTap: true }, function (at) {
              setTimeout(function () {
                document.body.removeChild(cover);
                S.scene.calibrated = !!(touch && at.px);
                if (!touch || !at.px) return sendTap(null);
                var dpr = window.devicePixelRatio;
                setTimeout(function () { sendTap({ x: at.px.x - touch.x * dpr, y: at.px.y - touch.y * dpr }); }, 300);
              }, 500);
            });
          }, 200);
        });
      }
      if (step.wait) return setTimeout(next, step.wait);
      next();
    };
    next();
  }

  function scrollAllToEnd() {
    var list = verticalScrollers();
    for (var i = 0; i < list.length; i++) list[i].scrollTop = list[i].scrollHeight;
    var root = document.documentElement;
    window.scrollTo(0, Math.max(root.scrollHeight, document.body.scrollHeight));
  }

  function report(stage, cb) {
    if (finished) return;
    var metrics;
    try { metrics = audit(stage); }
    catch (e) { metrics = { stage: stage, auditError: String(e && e.message), path: location.pathname, mounted: false }; }
    if (S.scene) metrics.scene = S.scene;
    post('/__e2e/result', { cellId: CELL.id, stage: stage, metrics: metrics }, function (reply) {
      if (reply.next) { finished = true; location.replace(reply.next); return; }
      if (cb) cb();
    });
  }

  function start() {
    if (CELL.css) {
      var st = document.createElement('style');
      st.textContent = CELL.css;
      document.head.appendChild(st);
    }
    setTimeout(function () { if (!finished && !S.reported) { S.reported = true; report('watchdog'); } }, 25000);
    fonts(function () {
      settle(1200, function () {
        var after = function () {
          settle(300, function () {
            S.reported = true;
            var stages = CELL.stages;
            var walk = function (i) {
              if (i >= stages.length) return;
              if (stages[i] === 'end') {
                scrollAllToEnd();
                return setTimeout(function () {
                  settle(300, function () { report('end', function () { walk(i + 1); }); });
                }, 300);
              }
              report(stages[i], function () { walk(i + 1); });
            };
            walk(0);
          });
        };
        if (CELL.scene) runScene(CELL.scene, after);
        else after();
      });
    });
  }

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
