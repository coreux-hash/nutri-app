(function(){
  const app = window.NutriApp = Object.assign({}, window.NutriApp || {});
  app.core = Object.assign({}, app.core || {});
  app.domain = Object.assign({}, app.domain || {});
  app.ui = Object.assign({}, app.ui || {});
  app.features = Object.assign({}, app.features || {});
  app.compat = Object.assign({}, app.compat || {});
  app.boundaries = Object.assign({
    version: "phase4.1",
    layers: ["core", "domain", "ui", "features"],
    policy: {
      core: "Fondations DOM, storage et API transverses. Ne dépend pas de UI/feature.",
      domain: "Règles métier et catégories. Dépend au plus de core/storage.",
      ui: "Composants et orchestration d'interface. Pas de logique métier lourde.",
      features: "Flux produit (ingrédients, recettes, OCR, import). Dépend de core/domain/ui."
    }
  }, app.boundaries || {});
})();

/* PWA shell: manifest and service worker only exist in a secure web context.
   Keeping them out of file:// prevents opaque-origin CORS errors in Chromium. */
(function(){
  const isHttpContext = location.protocol === 'http:' || location.protocol === 'https:';
  if(!isHttpContext) return;

  if(!document.querySelector('link[rel="manifest"]')){
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = './manifest.webmanifest';
    document.head.appendChild(manifestLink);
  }

  if('serviceWorker' in navigator){
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('./sw.js').catch(function(error){
        console.warn('NutriApp: service worker non enregistré.', error);
      });
    }, { once:true });
  }
})();
