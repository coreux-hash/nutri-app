const CACHE_NAME = 'nutriapp-pwa-v20260807';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache){ return cache.addAll(APP_SHELL); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys()
      .then(function(keys){
        return Promise.all(keys.map(function(key){
          if(key !== CACHE_NAME) return caches.delete(key);
          return Promise.resolve(false);
        }));
      })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  const request = event.request;
  const url = new URL(request.url);

  if(request.method !== 'GET' || url.origin !== self.location.origin){
    return;
  }

  if(request.mode === 'navigate'){
    event.respondWith(
      fetch(request)
        .then(function(response){
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put('./index.html', copy); });
          return response;
        })
        .catch(function(){ return caches.match('./index.html'); })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function(cached){
      const refresh = fetch(request).then(function(response){
        if(response && response.ok){
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(request, copy); });
        }
        return response;
      }).catch(function(){
        return cached;
      });

      return cached || refresh;
    })
  );
});
