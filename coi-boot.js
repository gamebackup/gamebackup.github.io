/*
 * coi-boot.js - arranges the reload(s) that cross-origin isolation needs.
 *
 * sw.js does the actual work: it stamps COOP/COEP onto same-origin responses,
 * which is what makes this site crossOriginIsolated and gives the 3DS emulator
 * SharedArrayBuffer. But a service worker cannot affect the navigation that
 * installed it, so a visit has to be reloaded once after the worker takes
 * control. That is all this file does.
 *
 * Two attempts, not one: right after a deploy the previous worker can still be
 * the one serving the first reload, so that reload arrives without the headers.
 * A second attempt then lands on the updated worker. After that it gives up
 * quietly and the 3DS tile falls back to opening in its own tab.
 */
(function () {
    if (typeof window === 'undefined') return;

    function readAttempts() {
        try { return parseInt(sessionStorage.getItem('coiReloads') || '0', 10) || 0; } catch (e) { return 0; }
    }
    function writeAttempts(n) {
        try {
            if (n > 0) sessionStorage.setItem('coiReloads', String(n));
            else sessionStorage.removeItem('coiReloads');
        } catch (e) {}
    }

    if (window.crossOriginIsolated) {
        writeAttempts(0);
        return;
    }
    if (!('serviceWorker' in navigator)) return;

    var attempts = readAttempts();
    if (attempts >= 2) {
        if (window.console) {
            console.warn('[coi] still not cross-origin isolated after ' + attempts +
                ' reloads; the 3DS tile will open in its own tab in this browser.');
        }
        return;
    }

    navigator.serviceWorker.ready.then(function () {
        if (window.crossOriginIsolated) { writeAttempts(0); return; }
        writeAttempts(attempts + 1);
        window.location.reload();
    }).catch(function (err) {
        if (window.console) console.warn('[coi] service worker unavailable', err);
    });
})();
