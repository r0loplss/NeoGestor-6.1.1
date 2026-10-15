/* NeoApoyos — runtime del tema cristal (se inyecta en cada herramienta). */
(function () {
    function ambient(mode) {
        if (mode === 'light') {
            return 'radial-gradient(1200px 820px at 12% -10%, rgba(47,203,241,.30), transparent 60%),' +
                   'radial-gradient(1000px 720px at 102% 6%, rgba(139,92,246,.22), transparent 62%),' +
                   'radial-gradient(900px 700px at 50% 118%, rgba(20,184,166,.20), transparent 60%),' +
                   'linear-gradient(180deg,#eef3fa,#e4ebf6)';
        }
        return 'radial-gradient(1200px 820px at 12% -10%, rgba(47,203,241,.20), transparent 60%),' +
               'radial-gradient(1100px 820px at 102% 6%, rgba(139,92,246,.18), transparent 62%),' +
               'radial-gradient(900px 720px at 50% 120%, rgba(20,184,166,.16), transparent 60%),' +
               'linear-gradient(180deg,#0a0e16,#070b12)';
    }
    function apply(t) {
        t = t || {};
        var mode = (t.mode === 'light') ? 'light' : 'dark';
        var root = document.documentElement;
        root.setAttribute('data-neo-theme', mode);
        root.style.setProperty('--neo-accent', t.accent || '#2fcbf1');
        root.style.setProperty('--neo-ambient', ambient(mode));
    }
    try {
        var ipc = require('electron').ipcRenderer;
        ipc.on('neo-theme', function (e, t) { apply(t); });
        ipc.send('neo-theme-request');
    } catch (e) {}
})();
