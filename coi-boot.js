/*
 * coi-boot.js - arranges the one reload that cross-origin isolation needs.
 *
 * sw.js does the actual work: it stamps COOP/COEP onto same-origin responses,
 * which is what makes this site crossOriginIsolated and gives the 3DS emulator
 * SharedArrayBuffer. But a service worker cannot affect the navigation that
 * installed it, so the very first visit has to be reloaded once after the
 * worker takes control. That is all this file does.
 *
 * If isolation still is not there after that single reload (a browser without
 * service-worker support, or a worker that failed to activate) it gives up
 * quietly: the 3DS tile falls back to opening in its own tab.
 */
(function () {
    if (typeof window === 'undefined') return;

    if (window.crossOriginIsolated) {
        try { sessionStorage.removeItem('coiReloaded'); } catch (e) {}
        return;
    }
    if (!('serviceWorker' in navigator)) return;

    var alreadyReloaded = false;
    try { alreadyReloaded = sessionStorage.getItem('coiReloaded') === '1'; } catch (e) {}

    if (alreadyReloaded) {
        if (window.console) {
            console.warn('[coi] still not cross-origin isolated after one reload; ' +
                'the 3DS tile will open in its own tab until this browser supports it.');
        }
        return;
    }

    navigator.serviceWorker.ready.then(function () {
        if (window.crossOriginIsolated) return;
        try { sessionStorage.setItem('coiReloaded', '1'); } catch (e) {}
        window.location.reload();
    }).catch(function (err) {
        if (window.console) console.warn('[coi] service worker unavailable', err);
    });
})();
