/* Phase 4.1 — Features / Recipes / Import + OCR helpers */
(function(){
/* =========================
   Recipe rows
========================= */
function makeOption(value, label){
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  return opt;
}

function refreshIngredientsCache(){
  // reload ingredients from storage at the moment of action (so the modal always sees the latest)
  try{
    const arr = getRuntimeIngredients();
    ingredients = Array.isArray(arr) ? arr.slice() : [];
  }catch(e){
    ingredients = ingredients || [];
  }
  try{
    if (window.IngredientSearchEngine && typeof window.IngredientSearchEngine.invalidate === "function"){
      window.IngredientSearchEngine.invalidate();
    } else if (typeof IngredientSearchEngine !== "undefined" && IngredientSearchEngine && typeof IngredientSearchEngine.invalidate === "function"){
      IngredientSearchEngine.invalidate();
    }
  }catch(_e){}
}
function buildIngSelectOptions(catId){
  const list = ingredients
    .filter(i => !catId || i.categoryId === catId)
    .slice()
    .sort((a,b)=>String(a.name).localeCompare(String(b.name), "fr"));
  return list;
}


/* Prototype rows/compute removed in CLEAN_BASE v2 (RecipeEditor is the single owner) */

/* =========================
   OCR Recette (transféré de patched_V3_5_4)
   - garde les mêmes IDs (btnRecipeOcrIngs, recipeOcrIngsFile, etc.)
   - s’appuie sur les fonctions de ce prototype (addRecipeRow, setRecipeStatus, etc.)
========================= */
let _ocrWorker = null;

function isFileProtocol(){
  return String(location?.protocol || "").toLowerCase() === "file:";
}

/* Chargeur à la demande, exposé pour le module OCR partagé (01-ocr-shared-patch.js), qui ne le voyait
   pas à l'intérieur de ce module : sans script tesseract en <head>, l'OCR renvoyait toujours un texte vide. */
window.ensureTesseractLoaded = ensureTesseractLoaded;
async function ensureTesseractLoaded(){
  if (window.Tesseract && (window.Tesseract.createWorker || window.Tesseract.recognize)) return true;

  const tryScript = (src) => new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });

  // CDNs fallback (comme patched)
  const sources = [
    "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
    "https://unpkg.com/tesseract.js@5/dist/tesseract.min.js",
    "https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js",
    "https://unpkg.com/tesseract.js@4/dist/tesseract.min.js",
  ];

  for (const src of sources){
    const ok = await tryScript(src);
    if (ok && window.Tesseract) return true;
  }
  return false;
}

async function getOcrWorker(statusCb){
  if (_ocrWorker) return _ocrWorker;
  const T = window.Tesseract;
  if (!T || typeof T.createWorker !== 'function') return null;

  try{ statusCb && statusCb("OCR: initialisation…"); }catch(e){}

  // Tesseract v5+: préférer createWorker('fra') pour éviter les warnings
  try{
    _ocrWorker = await T.createWorker('fra');
    return _ocrWorker;
  }catch(modernErr){
    try{
      const worker = await T.createWorker();
      if (typeof worker.loadLanguage === 'function') await worker.loadLanguage('fra');
      if (typeof worker.initialize === 'function') await worker.initialize('fra');
      _ocrWorker = worker;
      return _ocrWorker;
    }catch(legacyErr){
      console.error(legacyErr);
      try{ statusCb && statusCb("OCR: échec init langue."); }catch(_){}
      try{ if(_ocrWorker && typeof _ocrWorker.terminate === 'function') await _ocrWorker.terminate(); }catch(_){}
      _ocrWorker = null;
      return null;
    }
  }
}

async function ocrRecognizeFileToText(file, onProgress){
  if (!file) return "";
  if (isFileProtocol()){
    try{ onProgress && onProgress("OCR en file:// : peut échouer. Préfère http://localhost (mini serveur local)."); }catch(e){}
  }
  const ok = await ensureTesseractLoaded();
  if (!ok) return "";
  const worker = await getOcrWorker((msg)=>{ try{ onProgress && onProgress(msg); }catch(e){} });
  if (!worker) return "";

  try{ onProgress && onProgress("OCR: lecture…"); }catch(e){}
  const { data } = await worker.recognize(file);
  return String((data && data.text) || "");
}

function normalizeOcrText(text){
  return String(text||"")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSpaces(s){ return String(s||"").replace(/\s+/g," ").trim(); }

function recipeSafeNum(v){
  const s = String(v === undefined || v === null ? '' : v).trim().replace(',', '.');
  if(!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function recipeNormalizeUnit(u){
  const s = normalizeSpaces(u).toLowerCase();
  const map = {
    g:'g', gr:'g', gramme:'g', grammes:'g',
    kg:'kg', kilo:'kg', kilos:'kg', kilogramme:'kg', kilogrammes:'kg',
    mg:'mg',
    ml:'ml', cl:'cl', l:'l', litre:'l', litres:'l',
    cs:'tbsp', cas:'tbsp',
    cc:'tsp', cac:'tsp',
    piece:'piece', pieces:'piece', unite:'piece', unites:'piece', u:'piece', oeuf:'piece', oeufs:'piece'
  };
  return map[s] || s;
}

function stripRecipePrefix(raw){
  let s = normalizeSpaces(raw);
  while(s && (s[0] === '-' || s[0] === '*' || s[0] === '•')) s = normalizeSpaces(s.slice(1));
  let i = 0;
  while(i < s.length && s[i] >= '0' && s[i] <= '9') i++;
  if(i > 0 && i < s.length && (s[i] === ')' || s[i] === '.' || s[i] === '-')) s = normalizeSpaces(s.slice(i + 1));
  return s;
}

function parseRecipeLine(line){
  let raw = stripRecipePrefix(line);
  if(!raw) return null;

  const colonIdx = raw.indexOf(':');
  if(colonIdx > 0){
    const left = normalizeSpaces(raw.slice(0, colonIdx));
    const right = normalizeSpaces(raw.slice(colonIdx + 1));
    if(left && right && right[0] >= '0' && right[0] <= '9') raw = normalizeSpaces(right + ' ' + left);
  }

  const tokens = raw.split(' ').filter(Boolean);
  if(!tokens.length) return null;

  const qty = recipeSafeNum(tokens[0]);
  if(!Number.isFinite(qty)) return { label: raw, qtyG: "", unit: "" };

  let unit = '';
  let nameTokens = tokens.slice(1);
  if(tokens.length > 1){
    const maybeUnit = recipeNormalizeUnit(tokens[1]);
    if(["g","kg","mg","ml","cl","l","tbsp","tsp","piece"].includes(maybeUnit)){
      unit = maybeUnit;
      nameTokens = tokens.slice(2);
    }
  }

  const label = normalizeSpaces(nameTokens.join(' ')) || raw;
  let qtyG = "";
  if(unit === 'g') qtyG = qty;
  else if(unit === 'kg') qtyG = qty * 1000;
  else if(unit === 'mg') qtyG = qty / 1000;

  return { label, qtyG, unit: (unit && qtyG !== "" ? 'g' : unit) };
}

function parseRecipeQuickImportText(text){
  const lines = String(text || '').replace(/\r/g,'\n').split('\n');
  const out = [];
  for(const ln of lines){
    const line = normalizeSpaces(ln);
    if(!line) continue;
    const parsed = parseRecipeLine(line);
    if(parsed && parsed.label) out.push(parsed);
  }
  return out;
}

/* =========================
   Ingredient Search Index V1
   - matching tolérant mais déterministe pour import recette
   - sans dépendance externe
========================= */
function idxSafeString(v){ return v == null ? "" : String(v); }
function idxSafeLower(v){ return idxSafeString(v).toLowerCase(); }
function idxUniqueStrings(arr){
  const out = [];
  const seen = new Set();
  (Array.isArray(arr) ? arr : []).forEach(v => {
    const s = idxSafeString(v).trim();
    if(!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  });
  return out;
}
function idxStripDiacritics(s){
  try{ return idxSafeString(s).normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  catch(_e){ return idxSafeString(s); }
}
function idxCollapseSpaces(s){ return idxSafeString(s).trim().replace(/\s+/g, " "); }
function idxIsStopWordToken(tok){
  return tok === "de" || tok === "des" || tok === "du" || tok === "d" ||
         tok === "le" || tok === "la" || tok === "les" ||
         tok === "au" || tok === "aux" || tok === "and" || tok === "the";
}
function idxSingularizeToken(tok){
  let t = idxSafeString(tok).trim();
  if(!t) return "";
  if(t === "oeufs" || t === "œufs") return "oeuf";
  if(t === "eggs") return "egg";
  if(t.length >= 5 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}
function normalizeIngredientLookupText(input){
  let s = idxSafeString(input);
  if(!s) return "";
  s = idxSafeLower(s);
  s = idxStripDiacritics(s);
  s = s.replace(/[’']/g, " ");
  s = s.replace(/[-_/]/g, " ");
  s = s.replace(/[(),.:;+*\[\]{}!?|\\"]/g, " ");
  s = s.replace(/%/g, " ");
  s = s.replace(/&/g, " and ");
  s = s.replace(/œ/g, "oe");
  s = idxCollapseSpaces(s);
  if(!s) return "";
  const rawTokens = s.split(" ");
  const cleanTokens = [];
  for(const tok0 of rawTokens){
    const tok = idxCollapseSpaces(idxSingularizeToken(tok0));
    if(!tok || idxIsStopWordToken(tok)) continue;
    cleanTokens.push(tok);
  }
  return idxCollapseSpaces(cleanTokens.join(" "));
}
function tokenizeNormalizedLookup(normalizedText){
  const s = idxCollapseSpaces(normalizedText);
  return s ? idxUniqueStrings(s.split(" ").map(t => t.trim()).filter(Boolean)) : [];
}
function buildDefaultIngredientAliases(ing){
  const name = idxSafeString(ing?.name).trim();
  const normalizedName = normalizeIngredientLookupText(name);
  const aliases = [];
  if(normalizedName) aliases.push(normalizedName);
  const n = normalizedName;
  if(n === "oeuf" || n === "oeuf entier"){ aliases.push("oeuf", "egg"); }
  if(n === "skyr nature" || n === "skyr"){ aliases.push("skyr", "skyr nature"); }
  if(n === "flocon avoine" || n === "flocons avoine"){ aliases.push("avoine", "flocon avoine", "flocons avoine", "oat", "oats"); }
  if(n === "huile olive" || n === "huile d olive"){ aliases.push("huile olive", "olive oil"); }
  if(n === "miel"){ aliases.push("honey"); }
  if(n === "riz basmati"){ aliases.push("riz", "riz basmati"); }
  if(Array.isArray(ing?.aliases)){
    ing.aliases.forEach(a => aliases.push(normalizeIngredientLookupText(a)));
  }
  return idxUniqueStrings(aliases.map(normalizeIngredientLookupText).filter(Boolean));
}
function buildIngredientSearchIndex(ingredients){
  const list = Array.isArray(ingredients) ? ingredients : [];
  const entries = [];
  const byId = Object.create(null);
  list.forEach((ing, idx) => {
    if(!ing || ing.id == null) return;
    const rawName = idxSafeString(ing.name).trim();
    const normalizedName = normalizeIngredientLookupText(rawName);
    const tokens = tokenizeNormalizedLookup(normalizedName);
    const aliases = buildDefaultIngredientAliases(ing);
    const entry = {
      ingredientId: idxSafeString(ing.id),
      rawName,
      normalizedName,
      tokens,
      aliases,
      categoryId: idxSafeString(ing.categoryId || ""),
      profile: idxSafeString(ing.profile || ""),
      indexPos: idx
    };
    entries.push(entry);
    byId[entry.ingredientId] = entry;
  });
  return { version:1, size:entries.length, entries, byId, builtAt:Date.now() };
}
function countCommonTokens(aTokens, bTokens){
  const bSet = new Set(Array.isArray(bTokens) ? bTokens : []);
  let count = 0;
  (Array.isArray(aTokens) ? aTokens : []).forEach(t => { if(bSet.has(t)) count++; });
  return count;
}
function scoreIngredientCandidate(normalizedInput, inputTokens, entry, options){
  const opts = options || {};
  const preferCategoryId = idxSafeString(opts.preferCategoryId || "");
  const input = idxCollapseSpaces(normalizedInput);
  if(!input || !entry) return 0;
  if(input === entry.normalizedName) return 100;
  if(Array.isArray(entry.aliases) && entry.aliases.includes(input)) return 95;
  const entryTokens = Array.isArray(entry.tokens) ? entry.tokens : [];
  const common = countCommonTokens(inputTokens, entryTokens);
  const inputCount = inputTokens.length;
  const entryCount = entryTokens.length;
  if(inputCount > 0 && entryCount > 0){
    const inputCoverage = common / inputCount;
    const entryCoverage = common / entryCount;
    if(common > 0 && entryCoverage === 1 && inputCoverage >= 0.66){
      let score = 90;
      if(inputTokens[0] && entryTokens[0] && inputTokens[0] === entryTokens[0]) score += 2;
      if(preferCategoryId && entry.categoryId && preferCategoryId === entry.categoryId) score += 1;
      return score;
    }
    if(common >= 2 && inputCoverage >= 0.66 && entryCoverage >= 0.66){
      let score = 84;
      if(inputTokens[0] && entryTokens[0] && inputTokens[0] === entryTokens[0]) score += 3;
      if(preferCategoryId && entry.categoryId && preferCategoryId === entry.categoryId) score += 2;
      return score;
    }
    if(common >= 1 && (inputCoverage >= 0.75 || entryCoverage >= 0.75)){
      let score = 76;
      if(inputTokens[0] && entryTokens[0] && inputTokens[0] === entryTokens[0]) score += 2;
      if(preferCategoryId && entry.categoryId && preferCategoryId === entry.categoryId) score += 2;
      return score;
    }
  }
  if(input.length >= 4){
    if(entry.normalizedName.includes(input) || input.includes(entry.normalizedName)){
      let score = 68;
      if(preferCategoryId && entry.categoryId && preferCategoryId === entry.categoryId) score += 2;
      return score;
    }
    if(Array.isArray(entry.aliases)){
      for(const a of entry.aliases){
        if(a.length >= 4 && (a.includes(input) || input.includes(a))){
          let score = 66;
          if(preferCategoryId && entry.categoryId && preferCategoryId === entry.categoryId) score += 2;
          return score;
        }
      }
    }
  }
  return 0;
}
function findBestIngredientMatch(rawText, index, options){
  const idx = index && Array.isArray(index.entries) ? index : buildIngredientSearchIndex([]);
  const normalizedInput = normalizeIngredientLookupText(rawText);
  const inputTokens = tokenizeNormalizedLookup(normalizedInput);
  if(!normalizedInput){
    return { status:"none", normalizedInput:"", ingredientId:"", ingredientName:"", score:0, candidates:[] };
  }
  const scored = [];
  idx.entries.forEach(entry => {
    const score = scoreIngredientCandidate(normalizedInput, inputTokens, entry, options);
    if(score <= 0) return;
    scored.push({
      ingredientId: entry.ingredientId,
      ingredientName: entry.rawName,
      categoryId: entry.categoryId,
      score
    });
  });
  scored.sort((a,b) => (b.score - a.score) || idxSafeLower(a.ingredientName).localeCompare(idxSafeLower(b.ingredientName)));
  const top = scored[0] || null;
  const second = scored[1] || null;
  if(!top){
    return { status:"none", normalizedInput, ingredientId:"", ingredientName:"", score:0, candidates:[] };
  }
  if(second){
    const diff = top.score - second.score;
    if(top.score < 95 && diff <= 3){
      return { status:"ambiguous", normalizedInput, ingredientId:"", ingredientName:"", score:top.score, candidates: scored.slice(0,5) };
    }
  }
  if(top.score >= 90){
    return { status:"exact", normalizedInput, ingredientId:top.ingredientId, ingredientName:top.ingredientName, score:top.score, candidates: scored.slice(0,3) };
  }
  if(top.score >= 75){
    return { status:"probable", normalizedInput, ingredientId:top.ingredientId, ingredientName:top.ingredientName, score:top.score, candidates: scored.slice(0,3) };
  }
  return { status:"none", normalizedInput, ingredientId:"", ingredientName:"", score:top.score, candidates: scored.slice(0,5) };
}
const IngredientSearchEngine = (() => {
  let _cacheKey = "";
  let _cacheIndex = null;
  function computeIngredientsCacheKey(ingredients){
    const list = Array.isArray(ingredients) ? ingredients : [];
    return list.map(ing => {
      const id = idxSafeString(ing?.id);
      const name = idxSafeString(ing?.name);
      const cat = idxSafeString(ing?.categoryId);
      return id + "|" + name + "|" + cat;
    }).join("§");
  }
  function getIndex(ingredients){
    const list = Array.isArray(ingredients) ? ingredients : [];
    const key = computeIngredientsCacheKey(list);
    if(_cacheIndex && _cacheKey === key) return _cacheIndex;
    _cacheKey = key;
    _cacheIndex = buildIngredientSearchIndex(list);
    return _cacheIndex;
  }
  function invalidate(){
    _cacheKey = "";
    _cacheIndex = null;
  }
  function match(rawText, ingredients, options){
    const index = getIndex(ingredients);
    return findBestIngredientMatch(rawText, index, options);
  }
  return {
    normalizeIngredientLookupText,
    buildIngredientSearchIndex,
    findBestIngredientMatch,
    getIndex,
    invalidate,
    match
  };
})();


function escapeHtml(s){ return String(s||"").replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function round1(x){
  const n = Number(x);
  if (!Number.isFinite(n)) return "";
  return Math.round(n*10)/10;
}

function renderRecipeQuickPreview(items, targetId="recipeOcrIngsPreview", statusId="recipeOcrStatus"){
  const box = byId(targetId);
  const st  = byId(statusId);
  if (!box) return;
  if (!items || items.length === 0){
    box.style.display = "none";
    if (st) st.textContent = "Aucune ligne détectée.";
    return;
  }
  box.style.display = "";
  let unresolvedCount = 0;
  const rows = items.map((it, i) => {
    const q = (it.qtyG !== "" && Number.isFinite(it.qtyG)) ? `${round1(it.qtyG)} g` : "—";
    const resolved = resolveIngredientReferenceByText(it.label || "", { preferCategoryId: String(it.categoryId || "") });
    const isResolved = !!(resolved && resolved.ingredientId);
    if(!isResolved) unresolvedCount++;
    const suffix = isResolved
      ? ` <span style="opacity:.72">→ ${escapeHtml(resolved.ingredientName || it.label || "")}</span>`
      : ` <span style="opacity:.72;color:#b45309">(à compléter)</span>`;
    return `<div style="display:flex;gap:.5rem"><span style="min-width:2.2rem;opacity:.7">${i+1}.</span><span style="min-width:6rem">${q}</span><span>${escapeHtml(it.label||"")}${suffix}</span></div>`;
  }).join("");
  box.innerHTML = rows;
  if (st) st.textContent = unresolvedCount > 0
    ? `${items.length} ligne(s) détectée(s), dont ${unresolvedCount} à compléter.`
    : `${items.length} ligne(s) détectée(s).`;
}

function scheduleRecipeDraftSave(){ /* prototype: no-op */ }

function switchRecipeCreateMode(mode){
  const modal = byId("recipeCreateModal");
  if (!modal) return;
  const btn = modal.querySelector('.createSeg button[data-mode="' + String(mode || 'manual') + '"]');
  if (btn) btn.click();
}

function applyRecipeItemsToTable(items){
  try{ refreshIngredientsCache(); }catch(e){}
  if (!items || items.length === 0){
    setRecipeStatusSafe("Aucune ligne détectée.", "warn");
    const qs = byId("recipeQuickStatus"); if(qs) qs.textContent = "Aucune ligne détectée.";
    return;
  }

  let unresolved = 0;
  for (const it of items){
    // Tentative de résolution directe (label -> ingrédient) ; fallback = rien sélectionné
    const resolved = resolveIngredientIdByLabel(it.label || "");
    if (!resolved) unresolved++;
    try{ RecipeEditor.addRow({ ingredientId: (resolved||""), ingredientName: (it.label || ""), qty: (it.qtyG ?? "") }); }catch(_){ }
    // si ingrédient non résolu, on laisse vide (l’utilisateur choisira)
  }

  scheduleRecipeDraftSave();
  switchRecipeCreateMode("manual");

  const baseMsg = `Ingrédient${items.length>1?"s":""} ajouté${items.length>1?"s":""} aux lignes (non sauvegardé${items.length>1?"s":""}). Clique Enregistrer.`;
  const warnMsg = unresolved > 0
    ? `${baseMsg} ${unresolved} ligne${unresolved>1?"s":""} à compléter manuellement.`
    : baseMsg;

  setRecipeStatusSafe(warnMsg, unresolved > 0 ? "warn" : "ok");
  const qs = byId("recipeQuickStatus"); if(qs) qs.textContent = warnMsg;
  const os = byId("recipeOcrStatus"); if(os) os.textContent = warnMsg;

  setTimeout(()=>{
    byId("recipeName")?.focus();
  }, 0);
}

function resolveIngredientIdByLabel(label){
  const resolved = resolveIngredientReferenceByText(label, {});
  return resolved && resolved.ingredientId ? String(resolved.ingredientId) : "";
}

async function runRecipeOcr(kind){
  const st = byId("recipeOcrStatus");
  const fileInput = (kind === "ings") ? byId("recipeOcrIngsFile") : byId("recipeOcrPrepFile");
  const textArea  = (kind === "ings") ? byId("recipeOcrIngsText") : byId("recipeOcrPrepText");
  const file = fileInput?.files?.[0];
  if (!file){ if (st) st.textContent = "Choisis une image avant de scanner."; return; }

  if (st) st.textContent = "OCR en cours…";
  try{
    const ocrFn = (typeof window.ocrRecognizeFileToText === 'function') ? window.ocrRecognizeFileToText : ocrRecognizeFileToText;
    const txt = await ocrFn(file, (m)=>{ if (st) st.textContent = m; });
    const clean = normalizeOcrText(txt);
    if (textArea) textArea.value = clean;
    if (st) st.textContent = clean ? "OCR terminé." : "OCR terminé mais aucun texte détecté.";
  }catch(e){
    console.error(e);
    if (st) st.textContent = "OCR échoué (erreur).";
  }
}

function parseOcrIngredientsTextarea(){
  const t = byId("recipeOcrIngsText")?.value || "";
  return parseRecipeQuickImportText(t);
}



const RECIPE_QUICK_IMPORT_TEMPLATE = [
  "200 g flocons d'avoine",
  "250 g skyr nature",
  "2 oeufs",
  "10 g miel",
  "15 ml huile d'olive"
].join("\n");

function applyRecipeQuickImportTemplate(){
  const box = byId("recipeQuickImportBox");
  const st = byId("recipeQuickStatus");
  if (!box) return;
  const hasContent = String(box.value || "").trim().length > 0;
  if (hasContent && !window.confirm("Remplacer le contenu actuel par le template d'import recette ?")) return;
  box.value = RECIPE_QUICK_IMPORT_TEMPLATE;
  renderRecipeQuickPreview(parseRecipeQuickImportText(box.value), "recipeQuickPreview", "recipeQuickStatus");
  if (st) st.textContent = "Template recette injecté. Adapte les lignes puis clique Ajouter aux lignes.";
  box.focus();
}


function recipeSaveAndCloseFromCurrentState(){
  try{
    if(window.RecipeEditorModal && typeof window.RecipeEditorModal.save === "function"){
      return !!window.RecipeEditorModal.save();
    }
  }catch(_e){}
  try{
    if(window.RecipeEditor && typeof window.RecipeEditor.save === "function"){
      return !!window.RecipeEditor.save();
    }
  }catch(_e){}
  const btn = byId("cmRecipeManualSave");
  if(btn){
    btn.click();
    return true;
  }
  return false;
}

function applyRecipeOcrToCurrentDraft(){
  const parsed = parseOcrIngredientsTextarea();
  renderRecipeQuickPreview(parsed, "recipeOcrIngsPreview", "recipeOcrStatus");
  applyRecipeItemsToTable(parsed);

  const txt = byId("recipeOcrPrepText")?.value || "";
  const prep = byId("cmRecipePrep");
  if(prep) prep.value = txt;
  scheduleRecipeDraftSave();

  if (byId("recipeOcrStatus")){
    const hasIngs = Array.isArray(parsed) && parsed.length > 0;
    const hasPrep = String(txt || "").trim().length > 0;
    byId("recipeOcrStatus").textContent = (hasIngs || hasPrep)
      ? "Brouillon recette mis à jour. Clique Enregistrer pour fermer."
      : "Aucune donnée OCR à enregistrer.";
  }
}

function applyRecipeQuickImportToCurrentDraft(){
  const text = byId("recipeQuickImportBox")?.value || "";
  const parsed = parseRecipeQuickImportText(text);
  renderRecipeQuickPreview(parsed, "recipeQuickPreview", "recipeQuickStatus");
  applyRecipeItemsToTable(parsed);
  if (byId("recipeQuickStatus")){
    byId("recipeQuickStatus").textContent = parsed.length
      ? "Lignes importées dans le brouillon. Clique Enregistrer pour fermer."
      : "Aucune ligne détectée.";
  }
}

function wireRecipeQuickImportListeners(){
  byId("btnRecipeQuickTemplate")?.addEventListener("click", () => {
    applyRecipeQuickImportTemplate();
  });
  byId("btnRecipeQuickPreview")?.addEventListener("click", () => {
    const text = byId("recipeQuickImportBox")?.value || "";
    renderRecipeQuickPreview(parseRecipeQuickImportText(text), "recipeQuickPreview", "recipeQuickStatus");
  });
  byId("btnRecipeQuickApply")?.addEventListener("click", () => {
    applyRecipeQuickImportToCurrentDraft();
  });
  byId("btnRecipeQuickSave")?.addEventListener("click", () => {
    applyRecipeQuickImportToCurrentDraft();
    recipeSaveAndCloseFromCurrentState();
  });
  byId("recipeQuickImportBox")?.addEventListener("keydown", (e) => {
    const isEnter = (e.key === "Enter");
    const isMod = (e.ctrlKey || e.metaKey);
    if (isEnter && isMod){
      e.preventDefault();
      const text = byId("recipeQuickImportBox")?.value || "";
      renderRecipeQuickPreview(parseRecipeQuickImportText(text), "recipeQuickPreview", "recipeQuickStatus");
    }
  });
}

function focusRecipeScanEditor(kind){
  const scanPanel = byId("recipePanelScan");
  const editors = {
    ings: byId("recipeScanEditorIngs"),
    prep: byId("recipeScanEditorPrep")
  };
  Object.entries(editors).forEach(([key, el]) => {
    if (!el) return;
    el.classList.toggle("is-active", key === kind);
  });
  const target = editors[kind];
  if (scanPanel && !scanPanel.classList.contains("hiddenPanel") && target){
    setTimeout(() => {
      try{ target.scrollIntoView({ block:"nearest", inline:"nearest", behavior:"smooth" }); }catch(_e){}
    }, 60);
  }
}

function wireRecipeOcrListeners(){
  function bindRecipeScanTrigger(buttonId, fileId, kind){
    const btn = byId(buttonId);
    const input = byId(fileId);
    if (!btn || !input) return;
    btn.addEventListener("click", () => {
      focusRecipeScanEditor(kind);
      const hasFile = !!(input.files && input.files[0]);
      if (hasFile) runRecipeOcr(kind);
      else input.click();
    });
  }

  bindRecipeScanTrigger("btnRecipeOcrHeroScan", "recipeOcrIngsFile", "ings");
  bindRecipeScanTrigger("btnRecipeOcrIngs", "recipeOcrIngsFile", "ings");
  bindRecipeScanTrigger("btnRecipeOcrPrep", "recipeOcrPrepFile", "prep");
  byId("recipeOcrIngsFile")?.addEventListener("change", () => {
    focusRecipeScanEditor("ings");
    runRecipeOcr("ings");
  });
  byId("recipeOcrPrepFile")?.addEventListener("change", () => {
    focusRecipeScanEditor("prep");
    runRecipeOcr("prep");
  });

  byId("btnRecipeOcrIngsPreview")?.addEventListener("click", () => {
    focusRecipeScanEditor("ings");
    const parsed = parseOcrIngredientsTextarea();
    renderRecipeQuickPreview(parsed, "recipeOcrIngsPreview", "recipeOcrStatus");
  });
  byId("btnRecipeOcrIngsApply")?.addEventListener("click", () => {
    focusRecipeScanEditor("ings");
    const parsed = parseOcrIngredientsTextarea();
    renderRecipeQuickPreview(parsed, "recipeOcrIngsPreview", "recipeOcrStatus");
    applyRecipeItemsToTable(parsed);
  });
  byId("btnRecipeOcrClear")?.addEventListener("click", () => {
    focusRecipeScanEditor("ings");
    const box = byId("recipeOcrIngsText");
    const preview = byId("recipeOcrIngsPreview");
    if (box) box.value = "";
    if (preview){
      preview.innerHTML = "";
      preview.style.display = "none";
    }
    if (byId("recipeOcrStatus")) byId("recipeOcrStatus").textContent = "Éditeur ingrédients vidé.";
  });

  byId("btnRecipeOcrPrepApply")?.addEventListener("click", () => {
    focusRecipeScanEditor("prep");
    const txt = byId("recipeOcrPrepText")?.value || "";
    const prep = byId("cmRecipePrep");
    if (prep) prep.value = txt;
    scheduleRecipeDraftSave();
    if (byId("recipeOcrStatus")) byId("recipeOcrStatus").textContent = txt ? "Préparation remplacée (non sauvegardée). Clique Enregistrer." : "Préparation vide.";
  });
  byId("btnRecipeOcrPrepClear")?.addEventListener("click", () => {
    focusRecipeScanEditor("prep");
    const box = byId("recipeOcrPrepText");
    if (box) box.value = "";
    if (byId("recipeOcrStatus")) byId("recipeOcrStatus").textContent = "Éditeur préparation vidé.";
  });
  byId("btnRecipeOcrSave")?.addEventListener("click", () => {
    applyRecipeOcrToCurrentDraft();
    recipeSaveAndCloseFromCurrentState();
  });
}
window.wireRecipeQuickImportListeners = wireRecipeQuickImportListeners;
window.wireRecipeOcrListeners = wireRecipeOcrListeners;

})();
