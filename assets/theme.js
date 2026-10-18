/*
 * PATAB theme boot.
 * Runs before the stylesheet paints so a light-theme user never sees a dark flash.
 * Kept tiny, dependency-free and defensive: any storage error falls back to defaults.
 */
(function () {
  try {
    var raw = localStorage.getItem('patab:state:v1');
    var settings = raw ? (JSON.parse(raw) || {}).settings || {} : {};
    var theme = settings.theme;
    if (theme !== 'dark' && theme !== 'light') {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    var root = document.documentElement;
    root.dataset.theme = theme;
    if (['lime', 'aqua', 'coral', 'violet', 'gold'].indexOf(settings.accent) !== -1) {
      root.dataset.accent = settings.accent;
    }
    if (['aurora', 'grid', 'plain'].indexOf(settings.background) !== -1) {
      root.dataset.bg = settings.background;
    }
  } catch (error) {
    /* Defaults in the HTML are already usable. */
  }
})();
