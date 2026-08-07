
/* ========= IMPORT RAPIDE (v3_5_4 logique) ========= */
function quickSafeNum(v){
  const s = String(v === undefined || v === null ? '' : v).trim().replace(',', '.');
  if(!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function splitNonEmptyLines(text){
  return String(text || '').replace(/\r/g,'\n').split('\n').map(s=>String(s||'').trim()).filter(Boolean);
}

function quickEscapeHtml(value){
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderQuickImportPreview(box, result){
  if(!box) return;
  box.style.display = 'block';

  if(result.items.length){
    const item = result.items[0] || {};
    const category = item.categoryRaw || item.categoryLabel || item.categoryId || '—';
    box.innerHTML = [
      '<div class="ingredientQuickPreviewCard">',
        '<div class="ingredientQuickPreviewHead">Prévisualisation</div>',
        '<div class="ingredientQuickPreviewGrid">',
          '<div class="ingredientQuickPreviewMetric"><small>Nom</small><b>' + quickEscapeHtml(item.name || '—') + '</b></div>',
          '<div class="ingredientQuickPreviewMetric"><small>Kcal</small><b>' + (Number.isFinite(item.kcal) ? quickEscapeHtml(item.kcal) : '—') + '</b></div>',
          '<div class="ingredientQuickPreviewMetric"><small>P</small><b>' + (Number.isFinite(item.p) ? quickEscapeHtml(item.p) : '—') + '</b></div>',
          '<div class="ingredientQuickPreviewMetric"><small>G</small><b>' + (Number.isFinite(item.carbs) ? quickEscapeHtml(item.carbs) : '—') + '</b></div>',
          '<div class="ingredientQuickPreviewMetric"><small>L</small><b>' + (Number.isFinite(item.fat) ? quickEscapeHtml(item.fat) : '—') + '</b></div>',
          '<div class="ingredientQuickPreviewMetric"><small>Catégorie</small><b>' + quickEscapeHtml(category) + '</b></div>',
        '</div>',
        (!item.categoryKnown && item.categoryRaw ? '<div class="ingredientQuickPreviewNotice">Catégorie inconnue : ' + quickEscapeHtml(item.categoryRaw) + '. La fiche sera préremplie, puis une correction manuelle restera nécessaire.</div>' : ''),
      '</div>'
    ].join('');
    return;
  }

  if(result.errors.length){
    box.innerHTML = [
      '<div class="ingredientQuickPreviewCard ingredientQuickPreviewCard--error">',
        '<div class="ingredientQuickPreviewHead">Import invalide</div>',
        '<ul class="ingredientQuickPreviewList">',
          result.errors.map(e => '<li>Ligne ' + quickEscapeHtml(e.line) + ' : ' + quickEscapeHtml(e.message || 'Erreur') + '</li>').join(''),
        '</ul>',
      '</div>'
    ].join('');
    return;
  }

  box.innerHTML = '<div class="ingredientQuickPreviewCard"><div class="ingredientQuickPreviewHead">Prévisualisation</div><div class="ingredientQuickPreviewNotice">Aucun ingrédient détecté.</div></div>';
}

function normalizeQuickCategoryInput(raw){
  const input = String(raw || '').trim();
  if(!input) return { provided:false, raw:'', id:'', label:'', known:true };
  let norm = input.replace(/\s+/g, '_').toLowerCase();
  try{
    if(typeof normalizeCategory === 'function'){
      const hit = normalizeCategory(norm);
      if(hit && hit.id) return { provided:true, raw:input, id:String(hit.id), label:String(hit.label || hit.id), known:true };
      const alt = normalizeCategory(input);
      if(alt && alt.id) return { provided:true, raw:input, id:String(alt.id), label:String(alt.label || alt.id), known:true };
    }
  }catch(_){ }
  try{
    const list = Array.isArray(window.ING_CATEGORY_ITEMS) ? window.ING_CATEGORY_ITEMS : [];
    const found = list.find(c => String(c && c.id || '').toLowerCase() === norm || String(c && c.label || '').trim().toLowerCase() === String(input).trim().toLowerCase());
    if(found) return { provided:true, raw:input, id:String(found.id || ''), label:String(found.label || found.id || ''), known:true };
  }catch(_){ }
  return { provided:true, raw:input, id:norm, label:input, known:false };
}

function parseQuickLine(line){
  const raw = String(line || '').trim();
  if(!raw) return { ok:false, error:'Ligne vide.' };
  const parts = raw.split(';').map(s => String(s || '').trim()).filter(Boolean);
  if(parts.length < 5) return { ok:false, error:'Format attendu : nom; kcal:x; p:x; g:x; l:x; cat:optionnel' };
  const name = parts[0];
  if(!name) return { ok:false, error:'Nom manquant.' };

  const out = { name:name, kcal:NaN, p:NaN, carbs:NaN, fat:NaN, categoryId:'', categoryKnown:true, categoryRaw:'' };
  const seen = Object.create(null);

  for(let i=1;i<parts.length;i++){
    const token = parts[i];
    const idx = token.indexOf(':');
    if(idx <= 0) return { ok:false, error:'Chaque segment doit être au format clé:valeur.' };
    const key = token.slice(0, idx).trim().toLowerCase();
    const value = token.slice(idx + 1).trim();
    if(!value && key !== 'cat') return { ok:false, error:'Valeur manquante pour ' + key + '.' };
    if(seen[key]) return { ok:false, error:'Clé en double : ' + key + '.' };
    seen[key] = true;
    if(key === 'kcal') out.kcal = quickSafeNum(value);
    else if(key === 'p') out.p = quickSafeNum(value);
    else if(key === 'g') out.carbs = quickSafeNum(value);
    else if(key === 'l') out.fat = quickSafeNum(value);
    else if(key === 'cat'){
      const cat = normalizeQuickCategoryInput(value);
      out.categoryId = cat.id || '';
      out.categoryKnown = !!cat.known;
      out.categoryRaw = cat.raw || '';
      out.categoryLabel = cat.label || '';
    }else{
      return { ok:false, error:'Clé inconnue : ' + key + '.' };
    }
  }

  if(!Number.isFinite(out.kcal) || !Number.isFinite(out.p) || !Number.isFinite(out.carbs) || !Number.isFinite(out.fat)){
    return { ok:false, error:'Macros incomplètes : kcal, p, g et l sont obligatoires.' };
  }
  return { ok:true, item:out };
}

function parseQuickImportText(text){
  const lines = splitNonEmptyLines(text);
  const errors = [];
  const items = [];
  if(lines.length > 1){
    errors.push({ line:2, text:lines[1], message:'Import rapide ingrédient : une seule ligne est autorisée.' });
    return { items, errors, tooManyLines:true };
  }
  if(lines.length === 0) return { items, errors };
  const parsed = parseQuickLine(lines[0]);
  if(!parsed.ok){
    errors.push({ line:1, text:lines[0], message:parsed.error || 'Ligne invalide.' });
    return { items, errors };
  }
  items.push(parsed.item);
  return { items, errors };
}

const QUICK_IMPORT_TEMPLATE = "skyr nature; kcal:63; p:11; g:3.6; l:0.2; cat:produits_laitiers";

function applyQuickImportTemplate(){
  const box = document.getElementById('quickImportBox');
  const st = document.getElementById('quickImportStatus');
  if(!box) return;
  const hasContent = String(box.value || '').trim().length > 0;
  if(hasContent && !window.confirm("Remplacer le contenu actuel par l'exemple d'import ingrédient ?")) return;
  box.value = QUICK_IMPORT_TEMPLATE;
  previewQuick();
  if(st) st.textContent = "Exemple injecté. Un seul ingrédient par import rapide.";
  box.focus();
}

function previewQuick(){
  const t = document.getElementById('quickImportBox')?.value || '';
  const r = parseQuickImportText(t);
  const box = document.getElementById('quickImportPreview');
  const st = document.getElementById('quickImportStatus');
  if(box) renderQuickImportPreview(box, r);
  if(st){
    if(r.errors.length) st.textContent = r.errors[0].message;
    else if(r.items.length && !r.items[0].categoryKnown && r.items[0].categoryRaw) st.textContent = `Catégorie inconnue : ${r.items[0].categoryRaw}. Manual sera prérempli, puis correction manuelle demandée.`;
    else if(r.items.length) st.textContent = 'Import valide. Vérifie puis clique Ajouter.';
    else st.textContent = 'Colle une ligne au format attendu.';
  }
}

function addQuick(){
  const t = document.getElementById('quickImportBox')?.value || '';
  const r = parseQuickImportText(t);
  const st = document.getElementById('quickImportStatus');
  const box = document.getElementById('quickImportPreview');

  if(box) renderQuickImportPreview(box, r);

  if(r.errors.length || !r.items.length){
    if(st) st.textContent = r.errors.length ? r.errors[0].message : 'Aucun ingrédient détecté.';
    return;
  }

  window.dispatchEvent(new CustomEvent('nutri:import:items',{ detail:r.items.slice(0,1) }));

  const item = r.items[0];
  if(st){
    st.textContent = (!item.categoryKnown && item.categoryRaw)
      ? `Manual prérempli. Catégorie inconnue : ${item.categoryRaw}. Corrige la catégorie puis clique Enregistrer.`
      : 'Manual prérempli. Vérifie puis clique Enregistrer.';
  }
} 

document.getElementById('btnQuickTemplate')?.addEventListener('click',applyQuickImportTemplate);
document.getElementById('btnQuickPreview')?.addEventListener('click',previewQuick);
document.getElementById('btnQuickAdd')?.addEventListener('click',addQuick);
