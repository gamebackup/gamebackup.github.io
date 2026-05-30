(function() {
  var logs = [];
  var orig = {};

  function capture(level) {
    orig[level] = console[level];
    console[level] = function() {
      var entry = { level: level, args: [], time: Date.now() };
      for (var i = 0; i < arguments.length; i++) {
        try {
          entry.args.push(
            typeof arguments[i] === 'object'
              ? JSON.stringify(arguments[i], null, 2)
              : String(arguments[i])
          );
        } catch (e) {
          entry.args.push('[unstringable]');
        }
      }
      logs.push(entry);
      if (logs.length > 500) logs.shift();
      orig[level].apply(console, arguments);
    };
  }
  capture('log');
  capture('warn');
  capture('error');
  capture('info');
  capture('debug');

  window.onerror = function(msg, url, line, col, err) {
    logs.push({
      level: 'error',
      args: ['Uncaught: ' + msg + ' (' + url + ':' + line + ':' + col + ')'],
      time: Date.now()
    });
  };
  window.addEventListener('error', function(e) {
    logs.push({
      level: 'error',
      args: ['Event: ' + (e.error ? e.error.message : e.message)],
      time: Date.now()
    });
  });
  window.addEventListener('unhandledrejection', function(e) {
    logs.push({
      level: 'error',
      args: ['Promise: ' + (e.reason ? e.reason.message || String(e.reason) : 'unknown')],
      time: Date.now()
    });
  });

  var btn = document.createElement('button');
  btn.textContent = '🐛';
  btn.style.cssText =
    'position:fixed;top:12px;right:12px;z-index:99999;width:36px;height:36px;' +
    'border-radius:50%;border:2px solid #fff;background:#1a1a2e;color:#fff;' +
    'font-size:18px;cursor:pointer;opacity:0.6;transition:opacity .2s;' +
    'display:flex;align-items:center;justify-content:center;line-height:1;' +
    'box-shadow:0 2px 8px rgba(0,0,0,.5);';
  btn.onmouseenter = function() { btn.style.opacity = '1'; };
  btn.onmouseleave = function() { btn.style.opacity = '0.6'; };

  var overlay = document.createElement('div');
  overlay.style.cssText =
    'display:none;position:fixed;top:0;left:0;width:100%;height:100%;' +
    'z-index:99998;background:rgba(0,0,0,.85);font-family:monospace;font-size:12px;color:#0f0;';

  var header = document.createElement('div');
  header.style.cssText =
    'display:flex;justify-content:space-between;align-items:center;' +
    'padding:8px 12px;background:#111;border-bottom:1px solid#333;';

  var title = document.createElement('span');
  title.textContent = 'Console Log';
  title.style.cssText = 'font-weight:bold;color:#0f0;';

  var clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear';
  clearBtn.style.cssText =
    'background:#333;color:#fff;border:1px solid#555;padding:2px 10px;' +
    'border-radius:3px;cursor:pointer;font-size:11px;';

  var closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText =
    'background:transparent;color:#fff;border:none;font-size:18px;' +
    'cursor:pointer;padding:0 4px;line-height:1;';

  var content = document.createElement('div');
  content.style.cssText =
    'overflow-y:auto;height:calc(100% - 36px);padding:8px 12px;' +
    'white-space:pre-wrap;word-break:break-all;';

  function render() {
    var html = '';
    for (var i = 0; i < logs.length; i++) {
      var e = logs[i];
      var color = e.level === 'error' ? '#f44'
                : e.level === 'warn' ? '#fa0'
                : e.level === 'info' ? '#48f'
                : '#0f0';
      html += '<span style="color:' + color + '">[' + e.level.toUpperCase() + ']</span> ';
      html += e.args.join(' ') + '\n';
    }
    content.innerHTML = html;
    content.scrollTop = content.scrollHeight;
  }

  clearBtn.onclick = function() { logs.length = 0; render(); };

  btn.onclick = function() {
    render();
    overlay.style.display = 'block';
  };

  closeBtn.onclick = function() { overlay.style.display = 'none'; };

  header.appendChild(title);
  header.appendChild(clearBtn);
  header.appendChild(closeBtn);
  overlay.appendChild(header);
  overlay.appendChild(content);
  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(btn);

  var origRender = render;
  render = function() {
    origRender();
  };

  setInterval(render, 1000);
})();
