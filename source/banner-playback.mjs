// Embedded in each final ad and animated dashboard preview.
export const playbackScript = `
function startPlayback() {
  // A directly opened download is a local playback check.
  if (location.protocol === 'file:' && window.top === window) {
    ad.classList.add('manual-replay');
  }
  let inViewport = !('IntersectionObserver' in window);
  let assetsReady = false;

  function updatePlayback() {
    const visible = inViewport && !document.hidden;
    ad.classList.toggle('playback-paused', !visible);
    if (visible && assetsReady) ad.classList.add('playing');
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting && entry.intersectionRatio > 0;
      updatePlayback();
    });
    observer.observe(ad);
  }
  document.addEventListener('visibilitychange', updatePlayback);

  Promise.all(Array.from(ad.querySelectorAll('img'), image =>
    typeof image.decode === 'function' ? image.decode().catch(() => {}) : Promise.resolve()
  )).then(() => {
    assetsReady = true;
    updatePlayback();
  });
}
`;

export const initializePlayback = `
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startPlayback, {once: true});
} else {
  startPlayback();
}
`;
