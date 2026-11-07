/* NutriApp v18 — stockage des images hors localStorage (IndexedDB).
 *
 * Pourquoi : localStorage est limité à ~5 Mo par origine ; les vignettes (data URL) en occupaient l'essentiel.
 * Principe (transparent pour le reste de l'app) :
 *   - À l'écriture des clés ingrédients / recettes, chaque image « data:image/… » est rangée dans IndexedDB
 *     (identifiant dérivé du contenu → une photo partagée par plusieurs fiches n'est stockée qu'une fois) et
 *     remplacée dans localStorage par une référence « nutriimg:<id> ».
 *   - À la lecture, les références sont remplacées par les images (cache mémoire chargé au démarrage).
 *   - Les contrats de données, les exports (sauvegarde, paquets, archives) et les imports sont inchangés :
 *     ils voient toujours des data URL complètes.
 * Démarrage : les autres scripts sont déclarés en type="text/x-nutriapp" dans index.html ; ce module charge
 * d'abord les images (et migre les anciennes données), puis exécute ces scripts dans l'ordre. Les écouteurs
 * DOMContentLoaded / load posés pendant ce chargement sont rejoués après le dernier script, comme avant.
 * Repli : si IndexedDB est indisponible ou ne répond pas, l'app démarre comme avant (images dans localStorage).
 */
(function(root){
  'use strict';
  const PREFIX = 'nutriimg:';
  const MANAGED = {
    'nutriapp.ingredients.v2': ['thumb'],
    'nutriapp.recipes.v2': ['thumbDataUrl']
  };
  const DB_NAME = 'nutriapp-images';
  const DB_STORE = 'images';
  const BOOT_TIMEOUT_MS = 4000;

  /* ---------- fonctions pures (testées sous node) ---------- */
  function fnv(str, seed){
    let h = seed >>> 0;
    for(let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h.toString(36);
  }
  function imageId(dataUrl){
    const s = String(dataUrl);
    return 'i' + s.length.toString(36) + '_' + fnv(s, 2166136261) + fnv(s, 0x9747b28c);
  }
  const isImageData = (v) => typeof v === 'string' && v.slice(0, 11).toLowerCase() === 'data:image/';
  const isRef = (v) => typeof v === 'string' && v.indexOf(PREFIX) === 0;

  // Remplace les images par des références. Renvoie { text, images: Map(id → dataUrl) }.
  function stripText(key, text){
    const fields = MANAGED[key];
    const images = new Map();
    if(!fields || typeof text !== 'string' || text.indexOf('data:image/') < 0) return { text, images };
    let arr;
    try{ arr = JSON.parse(text); }catch(_){ return { text, images }; }
    if(!Array.isArray(arr)) return { text, images };
    let changed = false;
    for(const item of arr){
      if(!item || typeof item !== 'object') continue;
      for(const f of fields){
        if(isImageData(item[f])){
          const id = imageId(item[f]);
          images.set(id, item[f]);
          item[f] = PREFIX + id;
          changed = true;
        }
      }
    }
    return { text: changed ? JSON.stringify(arr) : text, images };
  }
  // Remplace les références par les images connues (les références inconnues sont conservées telles quelles).
  function hydrateText(key, text, lookup){
    const fields = MANAGED[key];
    if(!fields || typeof text !== 'string' || text.indexOf(PREFIX) < 0) return text;
    let arr;
    try{ arr = JSON.parse(text); }catch(_){ return text; }
    if(!Array.isArray(arr)) return text;
    let changed = false;
    for(const item of arr){
      if(!item || typeof item !== 'object') continue;
      for(const f of fields){
        if(isRef(item[f])){
          const v = lookup(item[f].slice(PREFIX.length));
          if(v){ item[f] = v; changed = true; }
        }
      }
    }
    return changed ? JSON.stringify(arr) : text;
  }
  function refsIn(text){
    const out = new Set();
    if(typeof text !== 'string') return out;
    const re = /"nutriimg:([A-Za-z0-9_]+)"/g;
    let m;
    while((m = re.exec(text))) out.add(m[1]);
    return out;
  }

  const pure = { PREFIX, MANAGED, imageId, stripText, hydrateText, refsIn };
  if(typeof module === 'object' && module.exports){ module.exports = pure; return; }

  /* ---------- navigateur ---------- */
  const doc = root.document;
  const ls = (() => { try{ return root.localStorage; }catch(_){ return null; } })();
  const proto = root.Storage && root.Storage.prototype;
  const origGet = proto && proto.getItem;
  const origSet = proto && proto.setItem;
  const cache = new Map();
  const memo = new Map();       // clé → { raw, full }
  let db = null;
  let active = false;
  let gcTimer = 0;

  function openDb(){
    return new Promise((resolve, reject) => {
      if(!root.indexedDB){ reject(new Error('IndexedDB indisponible')); return; }
      const req = root.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { const d = req.result; if(!d.objectStoreNames.contains(DB_STORE)) d.createObjectStore(DB_STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('ouverture IndexedDB impossible'));
      req.onblocked = () => reject(new Error('IndexedDB bloquée'));
    });
  }
  function txDone(tx){
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('transaction annulée'));
    });
  }
  function loadAll(){
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const keysReq = store.getAllKeys();
      const valsReq = store.getAll();
      tx.oncomplete = () => {
        const keys = keysReq.result || [], vals = valsReq.result || [];
        for(let i = 0; i < keys.length; i++) cache.set(String(keys[i]), vals[i]);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('lecture annulée'));
    });
  }
  function putAll(images){
    if(!images.size) return Promise.resolve();
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    images.forEach((v, k) => store.put(v, k));
    return txDone(tx);
  }
  function rawGet(key){ return origGet.call(ls, key); }

  function referencedIds(){
    const ids = new Set();
    Object.keys(MANAGED).forEach(k => refsIn(rawGet(k)).forEach(id => ids.add(id)));
    return ids;
  }
  function scheduleGc(){
    if(gcTimer) clearTimeout(gcTimer);
    gcTimer = setTimeout(() => {
      gcTimer = 0;
      try{
        const keep = referencedIds();
        const drop = [];
        cache.forEach((_, id) => { if(!keep.has(id)) drop.push(id); });
        if(!drop.length) return;
        const tx = db.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);
        drop.forEach(id => { store.delete(id); cache.delete(id); });
      }catch(e){ console.warn('NutriApp images : nettoyage non effectué.', e); }
    }, 2000);
  }

  function install(){
    proto.getItem = function(key){
      const raw = origGet.call(this, key);
      if(this !== ls || !active || raw == null || !MANAGED[key]) return raw;
      const m = memo.get(key);
      if(m && m.raw === raw) return m.full;
      const full = hydrateText(key, raw, id => cache.get(id));
      memo.set(key, { raw, full });
      return full;
    };
    proto.setItem = function(key, value){
      if(this !== ls || !active || !MANAGED[key]) return origSet.call(this, key, value);
      const { text, images } = stripText(key, String(value));
      origSet.call(this, key, text);           // lève QuotaExceededError comme avant si besoin
      if(images.size){
        const fresh = new Map();
        images.forEach((v, id) => { if(!cache.has(id)) fresh.set(id, v); cache.set(id, v); });
        putAll(fresh).catch(e => console.error('NutriApp images : enregistrement IndexedDB échoué.', e));
      }
      memo.delete(key);
      scheduleGc();
    };
  }

  // Migration des données existantes : images rangées dans IndexedDB AVANT de réécrire localStorage.
  async function migrate(){
    for(const key of Object.keys(MANAGED)){
      const raw = rawGet(key);
      if(!raw || raw.indexOf('data:image/') < 0) continue;
      const { text, images } = stripText(key, raw);
      if(!images.size) continue;
      await putAll(images);
      images.forEach((v, id) => cache.set(id, v));
      if(started) return;         // l'app a démarré sans ce module : ne pas réécrire ses données
      origSet.call(ls, key, text);
    }
  }

  function stats(){
    let lsChars = 0;
    try{ for(let i = 0; i < ls.length; i++){ const k = ls.key(i); lsChars += k.length + String(origGet.call(ls, k) || '').length; } }catch(_){}
    let imageChars = 0;
    cache.forEach(v => { imageChars += String(v).length; });
    return { active, lsChars, imageChars, imageCount: cache.size };
  }

  /* ---------- chargement différé des scripts de l'app ---------- */
  function runDeferredScripts(){
    const tags = Array.from(doc.querySelectorAll('script[type="text/x-nutriapp"]'));
    const dcl = [], load = [];
    const origDocAdd = doc.addEventListener;
    const origWinAdd = root.addEventListener;
    let loading = true;
    doc.addEventListener = function(type, fn, opts){
      if(loading && type === 'DOMContentLoaded'){ dcl.push(fn); return; }
      return origDocAdd.call(this, type, fn, opts);
    };
    root.addEventListener = function(type, fn, opts){
      if(loading && this === root && type === 'load'){ load.push(fn); return; }
      return origWinAdd.call(this, type, fn, opts);
    };
    const call = (fn, type, target) => { try{ typeof fn === 'function' ? fn.call(target, new Event(type)) : fn.handleEvent(new Event(type)); }catch(e){ console.error(e); } };
    const finish = () => {
      loading = false;
      doc.addEventListener = origDocAdd;
      root.addEventListener = origWinAdd;
      const fireDcl = () => { dcl.forEach(fn => call(fn, 'DOMContentLoaded', doc)); };
      const fireLoad = () => { load.forEach(fn => call(fn, 'load', root)); };
      const afterDcl = () => {
        fireDcl();
        if(doc.readyState === 'complete') fireLoad();
        else origWinAdd.call(root, 'load', fireLoad, { once:true });
      };
      if(doc.readyState === 'loading') origDocAdd.call(doc, 'DOMContentLoaded', afterDcl, { once:true });
      else afterDcl();
      root.NutriImageStore.ready = true;
    };
    let i = 0;
    const next = () => {
      if(i >= tags.length){ finish(); return; }
      const src = tags[i++].getAttribute('src');
      const s = doc.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = next;
      s.onerror = () => { console.error('NutriApp : script non chargé', src); next(); };
      doc.body.appendChild(s);
    };
    next();
  }

  root.NutriImageStore = { PREFIX, stats, isActive: () => active, ready: false, imageId };

  let started = false;
  // Les balises type="text/x-nutriapp" sont après ce script : attendre la fin de l'analyse du HTML
  // avant de les chercher (sinon, si IndexedDB répond très vite, une partie des scripts serait ignorée).
  const start = () => {
    if(started) return;
    started = true;
    if(doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', runDeferredScripts, { once:true });
    else runDeferredScripts();
  };
  const timer = setTimeout(() => { console.warn('NutriApp images : IndexedDB ne répond pas, démarrage sans.'); start(); }, BOOT_TIMEOUT_MS);

  (async () => {
    if(!ls || !proto) throw new Error('localStorage indisponible');
    db = await openDb();
    await loadAll();
    await migrate();
    if(started) return;           // délai dépassé : on ne bascule pas en cours de route
    install();
    active = true;
    scheduleGc();
  })().catch(e => {
    console.warn('NutriApp images : stockage séparé inactif, images conservées dans localStorage.', e);
  }).finally(() => { clearTimeout(timer); start(); });
})(typeof window !== 'undefined' ? window : globalThis);
