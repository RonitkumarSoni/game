// PWA registration and an explicit update action; an active race is never reloaded silently.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
      const offerUpdate = () => {
        if (!registration.waiting || !navigator.serviceWorker.controller || document.getElementById('game-update')) return;
        const button = document.createElement('button');
        button.id = 'game-update';
        button.type = 'button';
        button.textContent = 'UPDATE READY · RELOAD GAME';
        button.setAttribute('aria-label', 'Reload to install the latest game update');
        button.addEventListener('click', () => registration.waiting?.postMessage('SKIP_WAITING'));
        document.body.appendChild(button);
      };
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
      if (registration.waiting) offerUpdate();
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed') offerUpdate();
        });
      });
      await registration.update();
    } catch (error) {
      console.warn('[pwa] Offline support unavailable', error);
    }
  });
}
