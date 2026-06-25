(function () {
  'use strict';
  function cmp(a, b) {
    var pa = String(a || '')
      .trim()
      .split('.')
      .map(function (x) {
        return parseInt(x, 10) || 0;
      });
    var pb = String(b || '')
      .trim()
      .split('.')
      .map(function (x) {
        return parseInt(x, 10) || 0;
      });
    var len = Math.max(pa.length, pb.length);
    for (var i = 0; i < len; i++) {
      var na = pa[i] || 0;
      var nb = pb[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }
  window.__dinkSafeReload = function (reason) {
    try {
      var k = 'dinksyndicate_last_reload_ts';
      var now = Date.now();
      var last = parseInt(sessionStorage.getItem(k), 10) || 0;
      if (now - last < 4500) {
        console.warn('[Dink] Skipping duplicate reload:', reason || '');
        return;
      }
      sessionStorage.setItem(k, String(now));
    } catch (e) {
      /* ignore */
    }
    window.location.reload();
  };

  var meta = document.querySelector('meta[name="app-version"]');
  var VERSION = meta && meta.getAttribute('content') ? meta.getAttribute('content').trim() : null;
  var stored = localStorage.getItem('dinksyndicate_app_version');
  var RECOVERY = 'dinksyndicate_html_recovery_v1';
  var STALE_SHELL = 'dinksyndicate_stale_shell_recovery_v1';

  if (!meta || !VERSION) {
    if (!sessionStorage.getItem(RECOVERY)) {
      sessionStorage.setItem(RECOVERY, '1');
      var recoveryUrl = new URL(window.location.href);
      recoveryUrl.searchParams.set('_sw_bypass', String(Date.now()));
      window.location.replace(recoveryUrl.toString());
    }
    return;
  }

  if (stored == null || stored === '') {
    localStorage.setItem('dinksyndicate_app_version', VERSION);
    return;
  }

  if (stored === VERSION) {
    try {
      sessionStorage.removeItem(STALE_SHELL);
    } catch (e) {
      /* ignore */
    }
    return;
  }

  if (cmp(VERSION, stored) < 0) {
    if (!sessionStorage.getItem(STALE_SHELL)) {
      sessionStorage.setItem(STALE_SHELL, '1');
      var bypassUrl = new URL(window.location.href);
      bypassUrl.searchParams.set('_sw_bypass', String(Date.now()));
      window.location.replace(bypassUrl.toString());
    }
    return;
  }

  if (cmp(VERSION, stored) > 0) {
    localStorage.setItem('dinksyndicate_app_version', VERSION);
    if (!('caches' in window)) {
      window.__dinkSafeReload('upgrade-no-caches-api');
      return;
    }
    caches
      .keys()
      .then(function (names) {
        return Promise.all(
          names.map(function (n) {
            return caches.delete(n);
          })
        );
      })
      .then(function () {
        window.__dinkSafeReload('upgrade-after-cache-clear');
      })
      .catch(function () {
        window.__dinkSafeReload('upgrade-cache-clear-error');
      });
    return;
  }

  localStorage.setItem('dinksyndicate_app_version', VERSION);
})();

(function stripSwBypassFromUrl() {
  try {
    var u = new URL(window.location.href);
    if (!u.searchParams.has('_sw_bypass')) return;
    u.searchParams.delete('_sw_bypass');
    var clean = u.pathname + (u.search ? u.search : '') + u.hash;
    window.history.replaceState({}, '', clean);
  } catch (e) {
    /* ignore */
  }
})();
