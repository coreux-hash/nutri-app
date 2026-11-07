/* NutriApp v17.2 — « Archiver dans un fichier » (option B).
   Sort une sélection d'ingrédients vers un paquet exchange.v1 téléchargé, puis les retire du stockage local.
   Garde-fous :
   - un ingrédient utilisé par une recette (rows[].ingredientId) ou un menu (lines[kind=ingredient].sourceId) n'est pas archivable ;
   - « Retirer » n'est possible qu'après le téléchargement de l'archive pour EXACTEMENT la même sélection ;
   - le retrait passe par NutriAppData.deleteIngredientsByIds (même chemin que la suppression unitaire) :
     seule la clé ingrédients est réécrite, recettes et menus ne sont pas touchés.
   Réimport : Échanges → « Importer un fichier » (ajout en copie, rien n'est écrasé). */
(function(){
  "use strict";
  const byId = (id) => document.getElementById(id);
  const asArray = (v) => Array.isArray(v) ? v : [];
  const clone = (v) => { try{ return JSON.parse(JSON.stringify(v)); }catch(_){ return v; } };
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const fold = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const KEYS = window.STORAGE_KEYS || {};
  const ING_KEY = KEYS.ingredients || "nutriapp.ingredients.v2";
  const REC_KEY = KEYS.recipes || "nutriapp.recipes.v2";
  const MENU_KEY = KEYS.menus || KEYS.meals || "nutriapp.meals.v2";

  function readKey(key){ try{ return JSON.parse(localStorage.getItem(key) || "[]"); }catch(_){ return []; } }
  function getIngredients(){
    try{ if(window.NutriAppData && typeof window.NutriAppData.getIngredients === "function") return asArray(window.NutriAppData.getIngredients()); }catch(_){}
    return asArray(readKey(ING_KEY));
  }
  function getRecipes(){
    try{ if(window.NutriStore && typeof window.NutriStore.getRecipes === "function") return asArray(window.NutriStore.getRecipes()); }catch(_){}
    return asArray(readKey(REC_KEY));
  }
  function getMenus(){ return asArray(readKey(MENU_KEY)); }

  function categoryLabel(item){
    const map = window.NutriIngredients && window.NutriIngredients.domain && window.NutriIngredients.domain.ING_CAT_LABEL_BY_ID;
    const id = String(item && item.categoryId || "");
    return (map && map[id]) || (item && item.categoryLabel && item.categoryLabel !== "—" ? item.categoryLabel : "") || id || "Sans catégorie";
  }
  function itemBytes(item){ try{ return JSON.stringify(item).length; }catch(_){ return 0; } }
  function formatSize(chars){
    if(chars >= 1024 * 1024) return (chars / (1024 * 1024)).toFixed(1).replace(".", ",") + " Mo";
    return Math.max(1, Math.round(chars / 1024)) + " Ko";
  }
  function storageChars(){
    // v18 — avec le stockage séparé des images, compter l'occupation réelle de localStorage (références, pas images).
    const store = window.NutriImageStore;
    if(store && typeof store.isActive === "function" && store.isActive()) return store.stats().lsChars;
    let total = 0;
    try{ for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); total += k.length + String(localStorage.getItem(k) || "").length; } }catch(_){}
    return total;
  }

  /* Usages : id d'ingrédient -> nombre de recettes / menus qui le référencent */
  function computeUsage(){
    const usage = new Map();
    const bump = (id, kind) => {
      id = String(id || "").trim(); if(!id) return;
      const u = usage.get(id) || { recipes:0, menus:0 };
      u[kind] += 1; usage.set(id, u);
    };
    getRecipes().forEach(r => {
      const seen = new Set();
      asArray(r && r.rows).forEach(row => { const id = String(row && row.ingredientId || ""); if(id && !seen.has(id)){ seen.add(id); bump(id, "recipes"); } });
    });
    getMenus().forEach(m => {
      const seen = new Set();
      asArray(m && m.lines).forEach(line => {
        if(line && line.kind === "ingredient"){ const id = String(line.sourceId || ""); if(id && !seen.has(id)){ seen.add(id); bump(id, "menus"); } }
      });
    });
    return usage;
  }
  function usageText(u){
    if(!u) return "";
    const parts = [];
    if(u.recipes) parts.push(u.recipes + " recette" + (u.recipes > 1 ? "s" : ""));
    if(u.menus) parts.push(u.menus + " menu" + (u.menus > 1 ? "s" : ""));
    return "Utilisé dans " + parts.join(" et ");
  }

  const overlay = byId("archiveOverlay");
  if(!overlay) return;
  const openBtn = byId("btnOpenArchive");
  const listEl = byId("archiveList");
  const searchEl = byId("archiveSearch");
  const catEl = byId("archiveCategory");
  const summaryEl = byId("archiveSummary");
  const storageEl = byId("archiveStorage");
  const downloadBtn = byId("btnArchiveDownload");
  const removeBtn = byId("btnArchiveRemove");
  const selectVisibleBtn = byId("btnArchiveSelectVisible");

  const state = { selected:new Set(), downloadedKey:"", usage:new Map(), items:[] };
  const selectionKey = () => Array.from(state.selected).sort().join("|");

  function refreshData(){
    state.items = getIngredients();
    state.usage = computeUsage();
    const ids = new Set(state.items.map(i => String(i && i.id)));
    Array.from(state.selected).forEach(id => { if(!ids.has(id) || state.usage.has(id)) state.selected.delete(id); });
  }
  function fillCategories(){
    if(!catEl) return;
    const current = catEl.value;
    const counts = new Map();
    state.items.forEach(i => { const id = String(i && i.categoryId || ""); counts.set(id, (counts.get(id) || 0) + 1); });
    const opts = Array.from(counts.entries())
      .map(([id, n]) => ({ id, label:categoryLabel({ categoryId:id }), n }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
    catEl.innerHTML = `<option value="">Toutes les catégories (${state.items.length})</option>` +
      opts.map(o => `<option value="${esc(o.id)}">${esc(o.label)} (${o.n})</option>`).join("");
    if(current && counts.has(current)) catEl.value = current;
  }
  function visibleItems(){
    const q = fold(searchEl && searchEl.value);
    const cat = catEl ? catEl.value : "";
    return state.items
      .filter(i => (!cat || String(i.categoryId || "") === cat) && (!q || fold(i.name).includes(q)))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "fr"));
  }
  function renderStorage(){
    if(!storageEl) return;
    const total = storageChars();
    const store = window.NutriImageStore;
    if(store && typeof store.isActive === "function" && store.isActive()){
      const st = store.stats();
      storageEl.innerHTML = `<b>Données de l’app : ≈ ${esc(formatSize(total))} sur ≈ 5 Mo</b><span>${state.items.length} ingrédient(s). Les images (${st.imageCount}, ≈ ${esc(formatSize(st.imageChars))}) sont rangées à part et ne comptent pas dans cette limite.</span>`;
      return;
    }
    const thumbs = state.items.reduce((s, i) => s + String(i && i.thumb || "").length, 0);
    storageEl.innerHTML = `<b>Données de l’app : ≈ ${esc(formatSize(total))}</b><span>dont images d’ingrédients ≈ ${esc(formatSize(thumbs))} · ${state.items.length} ingrédient(s). La limite du navigateur est d’environ 5 Mo (variable selon le navigateur).</span>`;
  }
  function renderList(){
    if(!listEl) return;
    const items = visibleItems();
    if(!items.length){ listEl.innerHTML = `<div class="archiveEmpty">Aucun ingrédient ne correspond.</div>`; return; }
    listEl.innerHTML = items.map(i => {
      const id = String(i.id);
      const u = state.usage.get(id);
      const locked = !!u;
      const checked = state.selected.has(id);
      const thumb = i.thumb ? `<img class="archiveThumb" src="${esc(i.thumb)}" alt=""/>` : `<span class="archiveThumb archiveThumb--empty" aria-hidden="true"></span>`;
      return `<label class="archiveRow${locked ? " is-locked" : ""}${checked ? " is-checked" : ""}" role="listitem">
        <input type="checkbox" data-archive-id="${esc(id)}" ${checked ? "checked" : ""} ${locked ? "disabled" : ""}/>
        ${thumb}
        <span class="archiveRowText"><b>${esc(i.name || "(sans nom)")}</b><small>${esc(categoryLabel(i))} · ${esc(formatSize(itemBytes(i)))}${locked ? " · " + esc(usageText(u)) : ""}</small></span>
      </label>`;
    }).join("");
  }
  function renderSummary(){
    const n = state.selected.size;
    const chosen = state.items.filter(i => state.selected.has(String(i.id)));
    const bytes = chosen.reduce((s, i) => s + itemBytes(i), 0);
    const ready = n > 0 && state.downloadedKey === selectionKey();
    if(summaryEl){
      summaryEl.textContent = n === 0
        ? "Coche les ingrédients à sortir de l’app."
        : (ready
          ? `Archive téléchargée pour ${n} ingrédient(s). Vérifie le fichier, puis retire-les de l’app (≈ ${formatSize(bytes)} libérés).`
          : `${n} ingrédient(s) sélectionné(s) · ≈ ${formatSize(bytes)} à libérer. Commence par télécharger l’archive.`);
    }
    if(downloadBtn) downloadBtn.disabled = n === 0;
    if(removeBtn){
      removeBtn.disabled = !ready;
      removeBtn.classList.toggle("green", ready);
      removeBtn.classList.toggle("gray", !ready);
    }
  }
  function renderAll(){ fillCategories(); renderStorage(); renderList(); renderSummary(); }

  function buildArchivePack(){
    const ids = Array.from(state.selected);
    const chosen = state.items.filter(i => ids.includes(String(i.id))).map(clone);
    const day = new Date().toISOString().slice(0, 10);
    const title = `Archive ingrédients ${day} (${chosen.length})`;
    let pack;
    if(window.NutriAppExchange && typeof window.NutriAppExchange.exportCardPack === "function"){
      pack = window.NutriAppExchange.exportCardPack(ids.map(id => ({ type:"ingredient", id })), {
        title,
        message:"Archive NutriApp : ingrédients sortis de l’app pour libérer de la place. Réimport : Échanges → Importer un fichier."
      });
    }
    if(!pack || !pack.payload || asArray(pack.payload.ingredients).length !== chosen.length){
      pack = {
        meta:{ app:"NutriApp", schema:"exchange.v1", kind:"card_pack", exportedAt:new Date().toISOString(), title, createdBy:"", message:"Archive NutriApp.", counts:{ ingredients:chosen.length, recipes:0, menus:0 } },
        primary:chosen.map(i => ({ type:"ingredient", id:String(i.id), name:String(i.name || "") })),
        payload:{ ingredients:chosen, recipes:[], menus:[] },
        dependencies:{ included:true, policy:"embed_required_cards", missing:[] },
        importPolicy:{ defaultMode:"add_copy", conflictKey:"type_name", neverOverwriteSilently:true }
      };
    }
    pack.meta.kind = "card_pack";
    pack.meta.archive = true;
    return { pack, filename:`nutriapp-archive-ingredients-${day}-${chosen.length}.json` };
  }
  function download(pack, filename){
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function onDownload(){
    refreshData();
    if(!state.selected.size){ renderAll(); return; }
    const { pack, filename } = buildArchivePack();
    const validator = window.NutriAppState && window.NutriAppState.validateExchangePack;
    const report = typeof validator === "function" ? validator(pack) : { ok:true, errors:[] };
    if(!report.ok){
      if(summaryEl) summaryEl.textContent = "Archive non conforme, rien n’a été téléchargé : " + asArray(report.errors).join(" · ");
      return;
    }
    download(pack, filename);
    state.downloadedKey = selectionKey();
    state.lastFile = filename;
    renderSummary();
  }

  function onRemove(){
    refreshData();
    const key = selectionKey();
    if(!state.selected.size || state.downloadedKey !== key){ state.downloadedKey = ""; renderAll(); return; }
    const n = state.selected.size;
    const ok = window.confirm(`Retirer ${n} ingrédient(s) de l’app ?\n\nIls restent dans le fichier « ${state.lastFile || "archive"} ». Vérifie qu’il est bien enregistré avant de confirmer.`);
    if(!ok){
      // v17.7 — jamais de retour silencieux : si le navigateur bloque les boîtes de dialogue,
      // confirm() renvoie false sans rien afficher et l'utilisateur ne voyait aucun effet.
      if(summaryEl) summaryEl.textContent = "Retrait annulé : rien n’a été retiré. Si aucune fenêtre de confirmation ne s’est ouverte, le navigateur bloque les boîtes de dialogue de cette page (recharge la page pour les réautoriser).";
      return;
    }
    if(!window.NutriAppData || typeof window.NutriAppData.deleteIngredientsByIds !== "function"){
      if(summaryEl) summaryEl.textContent = "Retrait impossible : la fonction de retrait est absente, probablement une ancienne version de l’app gardée en cache. Recharge la page (deux fois si besoin) puis réessaie. Rien n’a été modifié.";
      return;
    }
    const removeIds = Array.from(state.selected);
    const res = window.NutriAppData.deleteIngredientsByIds(removeIds);
    if(!res || !res.ok){
      if(summaryEl) summaryEl.textContent = "Retrait non appliqué. Rien n’a été modifié.";
      return;
    }
    // Même mise à jour d'écran que la suppression unitaire : retirer les cartes puis recalculer filtres/compteur.
    removeIds.forEach(id => {
      document.querySelectorAll("#ingGrid .card").forEach(card => { if(card.getAttribute("data-id") === id) card.remove(); });
    });
    try{
      if(window.NutriIngredients && window.NutriIngredients.ui && typeof window.NutriIngredients.ui.applyIngredientFilters === "function") window.NutriIngredients.ui.applyIngredientFilters();
    }catch(_){}
    state.selected.clear();
    state.downloadedKey = "";
    refreshData();
    renderAll();
    if(summaryEl) summaryEl.textContent = `${n} ingrédient(s) retiré(s) de l’app. Pour les récupérer : Échanges → « Importer un fichier ».`;
  }

  function open(){
    refreshData();
    if(searchEl) searchEl.value = "";
    if(catEl) catEl.value = "";
    renderAll();
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    try{ overlay.inert = false; }catch(_){}
    document.body.style.overflow = "hidden";
    try{ searchEl && searchEl.focus(); }catch(_){}
  }
  function close(){
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    try{ overlay.inert = true; }catch(_){}
    document.body.style.overflow = "";
    try{ openBtn && openBtn.focus(); }catch(_){}
  }

  openBtn && openBtn.addEventListener("click", (e) => { e.preventDefault(); open(); });
  byId("btnArchiveClose") && byId("btnArchiveClose").addEventListener("click", close);
  byId("btnArchiveBack") && byId("btnArchiveBack").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if(e.target === overlay) close(); });
  searchEl && searchEl.addEventListener("input", renderList);
  catEl && catEl.addEventListener("change", renderList);
  listEl && listEl.addEventListener("change", (e) => {
    const box = e.target;
    if(!(box instanceof HTMLInputElement) || !box.dataset.archiveId) return;
    const id = box.dataset.archiveId;
    if(box.checked && !state.usage.has(id)) state.selected.add(id); else state.selected.delete(id);
    const row = box.closest(".archiveRow"); if(row) row.classList.toggle("is-checked", box.checked);
    renderSummary();
  });
  selectVisibleBtn && selectVisibleBtn.addEventListener("click", () => {
    const vis = visibleItems().filter(i => !state.usage.has(String(i.id)));
    const allOn = vis.length > 0 && vis.every(i => state.selected.has(String(i.id)));
    vis.forEach(i => { if(allOn) state.selected.delete(String(i.id)); else state.selected.add(String(i.id)); });
    renderList(); renderSummary();
  });
  downloadBtn && downloadBtn.addEventListener("click", onDownload);
  removeBtn && removeBtn.addEventListener("click", onRemove);

  window.NutriArchive = { open, close, computeUsage, buildArchivePack:() => buildArchivePack().pack };
})();
