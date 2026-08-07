(function(){
  const page = document.getElementById('pageMenus');
  if (!page) return;

  const MENU_STORAGE_KEY = (typeof STORAGE_KEYS === 'object' && STORAGE_KEYS && (STORAGE_KEYS.menus || STORAGE_KEYS.meals))
    || (typeof STORAGE === 'object' && STORAGE && (STORAGE.menus || STORAGE.meals))
    || 'nutriapp.meals.v2';

  const views = {
    library: page.querySelector('[data-menu-view="library"]'),
    editor: page.querySelector('[data-menu-view="editor"]')
  };
  const searchInput = document.getElementById('menuSearchInput');
  const toneButtons = Array.from(page.querySelectorAll('.menuTone'));
  const searchEmpty = document.getElementById('menusSearchEmpty');
  const libraryGrid = document.getElementById('menusLibraryGrid');
  const draftCard = document.getElementById('menuDraftCard');
  const mealName = document.getElementById('mealName');
  const mealCategory = document.getElementById('mealCategory');
  const mealTags = document.getElementById('mealTags');
  const mealNote = document.getElementById('mealNote');
  const mealPrep = document.getElementById('mealPrep');
  const menuCount = document.getElementById('menuCount');
  const editorStatus = document.getElementById('menuEditorStatus');
  const summary = document.getElementById('mealResults');
  const lanes = Array.from(page.querySelectorAll('.menuLane'));
  const sceneTabs = Array.from(page.querySelectorAll('[data-menu-lane]'));
  const template = document.getElementById('menuLineItemTemplate');
  const draftTitle = document.getElementById('menuDraftTitle');
  const draftMeta = document.getElementById('menuDraftMeta');
  const draftDescription = document.getElementById('menuDraftDescription');
  const draftMealRail = document.getElementById('menuDraftMealRail');
  const draftPreviewList = document.getElementById('menuDraftPreviewList');
  const draftMeals = document.getElementById('menuDraftMeals');
  const draftRecipes = document.getElementById('menuDraftRecipes');
  const draftIngredients = document.getElementById('menuDraftIngredients');
  const draftNotes = document.getElementById('menuDraftNotes');
  const sourceSearch = document.getElementById('menuSourceSearch');
  const sourceResults = document.getElementById('menuSourceResults');
  const sourceKindButtons = Array.from(page.querySelectorAll('[data-menu-source-kind]'));
  const noteRow = document.getElementById('menuSourceNoteRow');
  const quickNoteText = document.getElementById('menuQuickNoteText');
  const summaryMeals = document.getElementById('mealSummaryMeals');
  const summaryRecipes = document.getElementById('mealSummaryRecipes');
  const summaryIngredients = document.getElementById('mealSummaryIngredients');
  const summaryNotes = document.getElementById('mealSummaryNotes');
  const summaryNote = document.getElementById('mealSummaryNote');

  let activeView = 'library';
  let activeLane = 'breakfast';
  let activeSourceKind = 'recipe';
  let currentMenuId = '';

  const laneMap = { breakfast: 'Matin', lunch: 'Midi', dinner: 'Soir', snack: 'Snack' };

  function escapeHtml(v){
    return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }
  function slug(v){ return String(v || '').trim().toLowerCase(); }
  function uid(prefix){ return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`; }
  function readMenus(){
    try{
      const raw = JSON.parse(localStorage.getItem(MENU_STORAGE_KEY) || '[]');
      return Array.isArray(raw) ? raw.map(normalizeMenu).filter(Boolean) : [];
    }catch(_){ return []; }
  }
  function writeMenus(list){
    try{ localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list : [])); }catch(_){ }
  }
  function recipeSource(){
    try{
      if (window.NutriStore && typeof window.NutriStore.getRecipes === 'function') return window.NutriStore.getRecipes();
      if (typeof window.getRecipes === 'function') return window.getRecipes();
      if (Array.isArray(window.recipes)) return window.recipes;
    }catch(_){ }
    return [];
  }
  function ingredientSource(){
    try{
      if (window.NutriStore && typeof window.NutriStore.getIngredients === 'function') return window.NutriStore.getIngredients();
      if (typeof window.getIngredients === 'function') return window.getIngredients();
      if (Array.isArray(window.ingredients)) return window.ingredients;
    }catch(_){ }
    return [];
  }
  function ingredientCategoryLabel(catId){
    try{
      if (window.IngredientCategoryDomain && typeof window.IngredientCategoryDomain.labelForCategoryId === 'function') {
        return window.IngredientCategoryDomain.labelForCategoryId(catId) || 'Autre';
      }
    }catch(_){ }
    return String(catId || 'Autre');
  }
  function findRecipe(id){ return recipeSource().find(r => String(r?.id) === String(id || '')) || null; }
  function findIngredient(id){ return ingredientSource().find(r => String(r?.id) === String(id || '')) || null; }

  function normalizeLine(raw, fallbackLane){
    if (!raw) return null;
    if (typeof raw === 'string') {
      return { id: uid('line'), lane: fallbackLane || 'breakfast', kind: 'note', sourceId: '', name: String(raw), meta: 'Note libre', linked: false };
    }
    const kindRaw = slug(raw.kind || raw.type || raw.sourceType || 'note');
    const kind = ['recipe','ingredient','note'].includes(kindRaw) ? kindRaw : (kindRaw === 'recette' ? 'recipe' : (kindRaw === 'ingrédient' || kindRaw === 'ingredient' ? 'ingredient' : 'note'));
    return {
      id: String(raw.id || uid('line')),
      lane: String(raw.lane || fallbackLane || 'breakfast'),
      kind,
      sourceId: String(raw.sourceId || raw.recipeId || raw.ingredientId || ''),
      name: String(raw.name || raw.title || raw.label || '').trim() || 'Sans titre',
      meta: String(raw.meta || raw.note || '').trim(),
      linked: kind !== 'note'
    };
  }

  function normalizeMenu(raw){
    if (!raw || typeof raw !== 'object') return null;
    const lines = [];
    if (Array.isArray(raw.lines)) {
      raw.lines.forEach(line => { const n = normalizeLine(line, line?.lane || 'breakfast'); if (n) lines.push(n); });
    } else {
      ['breakfast','lunch','dinner','snack'].forEach(lane => {
        const bucket = raw?.lanes?.[lane] || raw?.[lane] || [];
        if (Array.isArray(bucket)) bucket.forEach(line => { const n = normalizeLine(line, lane); if (n) lines.push(n); });
        else if (typeof bucket === 'string' && bucket.trim()) bucket.split('|').map(s => s.trim()).filter(Boolean).forEach(label => {
          lines.push({ id: uid('line'), lane, kind: 'note', sourceId: '', name: label, meta: 'Import simple', linked: false });
        });
      });
    }
    return {
      id: String(raw.id || uid('menu')),
      title: String(raw.title || raw.name || raw.menuTitle || raw.mealName || 'Menu').trim() || 'Menu',
      category: String(raw.category || raw.menuCategory || raw.mealCategory || '').trim(),
      tags: String(raw.tags || raw.menuTags || raw.mealTags || '').trim(),
      objective: String(raw.objective || raw.note || raw.menuNote || raw.mealNote || '').trim(),
      prep: String(raw.prep || raw.mealPrep || '').trim(),
      lines,
      createdAt: String(raw.createdAt || new Date().toISOString()),
      updatedAt: String(raw.updatedAt || new Date().toISOString()),
      origin: String(raw.origin || 'saved')
    };
  }

  function menuStats(lines){
    const stats = { meals: 0, recipes: 0, ingredients: 0, notes: 0, linked: 0 };
    const activeMeals = new Set();
    (lines || []).forEach(line => {
      if (!line) return;
      activeMeals.add(line.lane);
      if (line.kind === 'recipe') { stats.recipes += 1; stats.linked += 1; }
      else if (line.kind === 'ingredient') { stats.ingredients += 1; stats.linked += 1; }
      else { stats.notes += 1; }
    });
    stats.meals = activeMeals.size;
    return stats;
  }

  function setView(next){
    activeView = next;
    Object.entries(views).forEach(([name, node]) => {
      if (!node) return;
      node.classList.toggle('is-active', name === next);
    });
    if (next === 'editor') {
      window.requestAnimationFrame(() => mealName?.focus());
    }
  }

  function syncLane(next){
    activeLane = next;
    sceneTabs.forEach(btn => {
      const on = btn.dataset.menuLane === next;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    lanes.forEach(lane => lane.classList.toggle('is-active', lane.dataset.lane === next));
    renderSourceResults();
  }

  function laneItemsContainer(laneName){
    return page.querySelector(`.menuLane[data-lane="${laneName}"] .menuLaneItems`);
  }

  function clearLaneItems(){
    lanes.forEach(lane => {
      const body = lane.querySelector('.menuLaneItems');
      if (body) body.innerHTML = '';
    });
  }

  function updateLaneCounts(){
    lanes.forEach(lane => {
      const count = lane.querySelectorAll('.menuLineItem').length;
      const badge = lane.querySelector('.menuLaneCount');
      if (badge) badge.textContent = String(count);
    });
  }

  function hydrateLineFromLibrary(line){
    if (!line || !line.sourceId || line.kind === 'note') return line;
    if (line.kind === 'recipe') {
      const recipe = findRecipe(line.sourceId);
      if (!recipe) return { ...line, meta: 'Recette liée absente de la bibliothèque', linked: false };
      const meta = [recipe.categoryId || '', `${Array.isArray(recipe.rows) ? recipe.rows.length : 0} ligne(s)`, `${recipe.parts || 1} portion(s)`].filter(Boolean).join(' · ');
      return { ...line, name: recipe.name || line.name, meta: `Recette liée · ${meta}`, linked: true };
    }
    const ingredient = findIngredient(line.sourceId);
    if (!ingredient) return { ...line, meta: 'Ingrédient lié absent de la bibliothèque', linked: false };
    const units = Array.isArray(ingredient.allowedUnits) && ingredient.allowedUnits.length ? ingredient.allowedUnits.join(', ') : 'g';
    return { ...line, name: ingredient.name || line.name, meta: `Ingrédient lié · ${ingredientCategoryLabel(ingredient.categoryId)} · ${units}`, linked: true };
  }

  function buildLine(payload){
    if (!template) return null;
    const fragment = template.content.cloneNode(true);
    const item = fragment.querySelector('.menuLineItem');
    if (!item) return null;
    const data = hydrateLineFromLibrary(normalizeLine(payload, activeLane));
    item.dataset.lineId = data.id;
    item.dataset.lineKind = data.kind;
    item.dataset.sourceId = data.sourceId || '';
    item.dataset.linked = data.linked ? 'true' : 'false';
    item.dataset.lane = data.lane || activeLane;
    const typeEl = item.querySelector('.menuLineType');
    const nameEl = item.querySelector('.menuLineName');
    const metaEl = item.querySelector('.menuLineMeta');
    if (typeEl) typeEl.textContent = data.kind === 'recipe' ? 'Recette' : (data.kind === 'ingredient' ? 'Ingrédient' : 'Note');
    if (nameEl) nameEl.textContent = data.name;
    if (metaEl) {
      const strong = data.linked ? '<strong>Lié</strong> · ' : '';
      metaEl.innerHTML = `${strong}${escapeHtml(data.meta || (data.kind === 'note' ? 'Note libre' : 'Source liée'))}`;
    }
    return item;
  }

  function addLine(payload){
    const lane = laneItemsContainer(activeLane);
    if (!lane) return;
    const item = buildLine({ ...(payload || {}), lane: activeLane });
    if (!item) return;
    lane.appendChild(item);
    onEditorChanged({ status: payload?.kind === 'note' ? 'Note ajoutée au repas actif.' : 'Élément lié ajouté depuis la bibliothèque.' });
    item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function serializeLines(){
    const lines = [];
    lanes.forEach(lane => {
      const laneName = lane.dataset.lane;
      lane.querySelectorAll('.menuLineItem').forEach(item => {
        lines.push({
          id: item.dataset.lineId || uid('line'),
          lane: laneName,
          kind: item.dataset.lineKind || 'note',
          sourceId: item.dataset.sourceId || '',
          name: item.querySelector('.menuLineName')?.textContent?.trim() || 'Sans titre',
          meta: item.querySelector('.menuLineMeta')?.textContent?.trim() || ''
        });
      });
    });
    return lines;
  }

  function getEditorSnapshot(){
    return {
      id: currentMenuId || '',
      title: mealName?.value.trim() || '',
      category: mealCategory?.value || '',
      tags: mealTags?.value.trim() || '',
      objective: mealNote?.value.trim() || '',
      prep: mealPrep?.value.trim() || '',
      lines: serializeLines()
    };
  }

  function updateDraftCard(){
    const snap = getEditorSnapshot();
    const stats = menuStats(snap.lines);
    if (draftTitle) draftTitle.textContent = snap.title || 'Commencer un menu';
    if (draftMeta) draftMeta.textContent = stats.meals ? `${stats.meals} repas structurés` : 'À composer';
    if (draftDescription) {
      const bits = [snap.category, snap.tags, snap.objective].filter(Boolean).join(' · ');
      draftDescription.textContent = bits || 'Choisis des recettes ou ingrédients réels, puis garde les ajustements en note libre.';
    }
    if (draftMealRail) {
      const labels = Array.from(new Set(snap.lines.map(line => laneMap[line.lane]).filter(Boolean)));
      const list = labels.length ? labels : ['Matin', 'Midi', 'Soir', 'Snack'];
      draftMealRail.innerHTML = list.map(label => `<span>${escapeHtml(label)}</span>`).join('');
    }
    if (draftPreviewList) {
      const preview = snap.lines.slice(0, 3).map(line => line.name).filter(Boolean);
      draftPreviewList.innerHTML = (preview.length ? preview : ['Le résumé du brouillon apparaîtra ici dès que tu ajoutes des éléments.'])
        .map(line => `<div>${escapeHtml(line)}</div>`).join('');
    }
    if (draftMeals) draftMeals.textContent = String(stats.meals);
    if (draftRecipes) draftRecipes.textContent = String(stats.recipes);
    if (draftIngredients) draftIngredients.textContent = String(stats.ingredients);
    if (draftNotes) draftNotes.textContent = String(stats.notes);
  }

  function updateSummary(){
    const stats = menuStats(serializeLines());
    if (summaryMeals) summaryMeals.textContent = String(stats.meals);
    if (summaryRecipes) summaryRecipes.textContent = String(stats.recipes);
    if (summaryIngredients) summaryIngredients.textContent = String(stats.ingredients);
    if (summaryNotes) summaryNotes.textContent = String(stats.notes);
    if (summaryNote) {
      if (!stats.meals) summaryNote.textContent = 'Aucune ligne pour l\'instant. Ajoute des éléments réels depuis la bibliothèque ou des notes libres.';
      else if (!stats.linked) summaryNote.textContent = 'Le menu ne contient encore que des notes libres. Ajoute au moins une recette ou un ingrédient lié pour ancrer la composition.';
      else summaryNote.textContent = `${stats.linked} élément(s) lié(s) à la bibliothèque, ${stats.notes} note(s) libre(s). Le résumé reste volontairement honnête et non nutritionnel.`;
    }
  }

  function onEditorChanged(opts){
    updateLaneCounts();
    updateDraftCard();
    updateSummary();
    if (editorStatus && opts && opts.status) editorStatus.textContent = opts.status;
  }

  function emptyEditor(){
    currentMenuId = '';
    if (mealName) mealName.value = '';
    if (mealCategory) mealCategory.value = '';
    if (mealTags) mealTags.value = '';
    if (mealNote) mealNote.value = '';
    if (mealPrep) mealPrep.value = '';
    if (sourceSearch) sourceSearch.value = '';
    if (quickNoteText) quickNoteText.value = '';
    clearLaneItems();
    syncLane('breakfast');
    onEditorChanged({ status: 'Menu vide. Choisis maintenant des recettes ou ingrédients depuis la bibliothèque.' });
  }

  function loadMenuIntoEditor(menu, mode){
    const normalized = normalizeMenu(menu);
    if (!normalized) return;
    emptyEditor();
    currentMenuId = mode === 'duplicate' ? '' : normalized.id;
    if (mealName) mealName.value = mode === 'duplicate' ? `${normalized.title} (copie)` : normalized.title;
    if (mealCategory) mealCategory.value = normalized.category || '';
    if (mealTags) mealTags.value = normalized.tags || '';
    if (mealNote) mealNote.value = normalized.objective || '';
    if (mealPrep) mealPrep.value = normalized.prep || '';
    normalized.lines.forEach(line => {
      const lane = laneItemsContainer(line.lane);
      const item = buildLine(line);
      if (lane && item) lane.appendChild(item);
    });
    syncLane('breakfast');
    onEditorChanged({ status: mode === 'duplicate' ? 'Copie chargée. Modifie puis enregistre comme nouveau brouillon.' : 'Menu chargé depuis la bibliothèque Menus.' });
  }

  function seedCardToMenu(card){
    const buildSeedLines = (lane, value, firstKind) => String(value || '').split('|').map(v => v.trim()).filter(Boolean).map((label, idx) => ({
      id: uid('line'),
      lane,
      kind: idx === 0 ? firstKind : 'ingredient',
      sourceId: '',
      name: label,
      meta: idx === 0 ? 'Inspiration de départ à remplacer par une vraie recette liée si disponible' : 'Complément libre à préciser ou relier ensuite'
    }));
    return {
      id: uid('menu'),
      title: String(card?.dataset.menuTitle || 'Menu').trim(),
      category: String(card?.dataset.menuCategory || '').trim(),
      tags: String(card?.dataset.menuTags || '').trim(),
      objective: String(card?.dataset.menuNote || '').trim(),
      prep: '',
      lines: [
        ...buildSeedLines('breakfast', card?.dataset.breakfast || '', 'recipe'),
        ...buildSeedLines('lunch', card?.dataset.lunch || '', 'recipe'),
        ...buildSeedLines('dinner', card?.dataset.dinner || '', 'recipe'),
        ...buildSeedLines('snack', card?.dataset.snack || '', 'ingredient')
      ],
      origin: 'seed'
    };
  }

  function menuCardMarkup(menu){
    const stats = menuStats(menu.lines);
    const labels = Array.from(new Set(menu.lines.map(line => laneMap[line.lane]).filter(Boolean)));
    const preview = menu.lines.slice(0,3).map(line => line.name);
    const meta = [menu.category, menu.tags].filter(Boolean).join(' · ') || 'Brouillon enregistré';
    const search = [menu.title, menu.category, menu.tags, menu.objective, ...menu.lines.map(line => line.name)].join(' ').toLowerCase();
    return `
<article class="menuLibraryCard" data-menu-id="${escapeHtml(menu.id)}" data-menu-kind="saved" data-menu-search="${escapeHtml(search)}">
  <div class="menuLibraryCover">
    <div class="menuLibraryTopline">
      <span class="menuLibraryTag">Sauvé</span>
      <span class="menuLibraryMeta">${stats.meals} repas · ${stats.linked} liens réels</span>
    </div>
    <div class="menuLibraryTitleWrap">
      <h4>${escapeHtml(menu.title)}</h4>
      <p>${escapeHtml(meta)}</p>
    </div>
  </div>
  <div class="menuLibraryBody">
    <div class="menuLibraryMealRail">${(labels.length ? labels : ['Matin','Midi','Soir','Snack']).map(label => `<span>${escapeHtml(label)}</span>`).join('')}</div>
    <div class="menuLibraryListPreview">${(preview.length ? preview : ['Menu enregistré.']).map(line => `<div>${escapeHtml(line)}</div>`).join('')}</div>
    <div class="menuLibraryKpis">
      <div><b>${stats.meals}</b><span>Repas</span></div>
      <div><b>${stats.recipes}</b><span>Recettes</span></div>
      <div><b>${stats.ingredients}</b><span>Ingrédients</span></div>
      <div><b>${stats.notes}</b><span>Notes</span></div>
    </div>
    <div class="menuLibraryActions">
      <button class="btn" data-menu-open-editor="saved" type="button">Ouvrir</button>
      <button class="btn ghost" data-menu-open-editor="saved-copy" type="button">Dupliquer</button>
    </div>
  </div>
</article>`;
  }

  function renderSavedMenuCards(){
    if (!libraryGrid) return;
    libraryGrid.querySelectorAll('.menuLibraryCard[data-menu-kind="saved"]').forEach(node => node.remove());
    const saved = readMenus().sort((a,b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    const draftAnchor = draftCard ? draftCard.nextSibling : null;
    let insertBefore = draftAnchor;
    saved.forEach(menu => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = menuCardMarkup(menu).trim();
      const card = wrapper.firstElementChild;
      if (card && libraryGrid) libraryGrid.insertBefore(card, insertBefore);
    });
    if (menuCount) menuCount.textContent = String(saved.length);
    filterLibrary();
  }

  function saveDraft(){
    const snap = getEditorSnapshot();
    if (!snap.title && !snap.lines.length) {
      if (editorStatus) editorStatus.textContent = 'Rien à enregistrer. Donne un nom ou ajoute au moins une ligne liée.';
      return;
    }
    const menu = normalizeMenu({
      ...snap,
      id: currentMenuId || uid('menu'),
      title: snap.title || 'Menu sans titre',
      createdAt: currentMenuId ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      origin: 'saved'
    });
    const list = readMenus();
    const idx = list.findIndex(m => String(m.id) === String(menu.id));
    if (idx >= 0) list[idx] = { ...list[idx], ...menu, updatedAt: new Date().toISOString() };
    else list.unshift(menu);
    writeMenus(list);
    currentMenuId = menu.id;
    renderSavedMenuCards();
    updateDraftCard();
    if (editorStatus) editorStatus.textContent = 'Menu enregistré dans la bibliothèque Menus avec ses liens réels ou ses notes libres.';
    setView('library');
  }

  function filterLibrary(){
    const query = (searchInput?.value || '').trim().toLowerCase();
    let visible = 0;
    Array.from(page.querySelectorAll('.menuLibraryCard')).forEach(card => {
      const haystack = (card.dataset.menuSearch || card.textContent || '').toLowerCase();
      const show = !query || haystack.includes(query);
      card.style.display = show ? '' : 'none';
      if (show) visible += 1;
    });
    if (searchEmpty) searchEmpty.hidden = visible !== 0;
  }

  function sourceItems(){
    const query = slug(sourceSearch?.value || '');
    if (activeSourceKind === 'recipe') {
      return recipeSource().filter(item => !query || `${item?.name || ''} ${item?.categoryId || ''}`.toLowerCase().includes(query)).slice(0, 12).map(item => ({
        kind: 'recipe',
        id: String(item?.id || ''),
        title: String(item?.name || 'Recette').trim(),
        meta: [item?.categoryId || '', `${Array.isArray(item?.rows) ? item.rows.length : 0} ligne(s)`, `${item?.parts || 1} portion(s)`].filter(Boolean).join(' · ')
      }));
    }
    if (activeSourceKind === 'ingredient') {
      return ingredientSource().filter(item => !query || `${item?.name || ''} ${item?.categoryId || ''}`.toLowerCase().includes(query)).slice(0, 14).map(item => ({
        kind: 'ingredient',
        id: String(item?.id || ''),
        title: String(item?.name || 'Ingrédient').trim(),
        meta: [ingredientCategoryLabel(item?.categoryId), Array.isArray(item?.allowedUnits) ? item.allowedUnits.join(', ') : 'g'].filter(Boolean).join(' · ')
      }));
    }
    return [];
  }

  function renderSourceResults(){
    if (!sourceResults) return;
    if (noteRow) noteRow.hidden = activeSourceKind !== 'note';
    if (activeSourceKind === 'note') {
      sourceResults.innerHTML = '<div class="menuSourceEmpty">La note libre reste volontairement séparée : elle sert à préciser un service, une cuisson, une variante ou une consigne de composition.</div>';
      return;
    }
    const items = sourceItems();
    if (!items.length) {
      const label = activeSourceKind === 'recipe' ? 'Aucune recette trouvée dans la bibliothèque.' : 'Aucun ingrédient trouvé dans la bibliothèque.';
      sourceResults.innerHTML = `<div class="menuSourceEmpty">${escapeHtml(label)}</div>`;
      return;
    }
    sourceResults.innerHTML = items.map(item => `
      <button class="menuSourceItem" type="button" data-add-source-kind="${escapeHtml(item.kind)}" data-add-source-id="${escapeHtml(item.id)}">
        <span class="menuSourceItemBadge">${item.kind === 'recipe' ? 'Recette' : 'Ingrédient'}</span>
        <span class="menuSourceItemMain">
          <span class="menuSourceItemTitle">${escapeHtml(item.title)}</span>
          <span class="menuSourceItemMeta">${escapeHtml(item.meta)}</span>
        </span>
        <span class="menuSourceItemAction">Ajouter → ${escapeHtml(laneMap[activeLane] || activeLane)}</span>
      </button>
    `).join('');
  }

  function addSourceById(kind, id){
    if (!id) return;
    if (kind === 'recipe') {
      const recipe = findRecipe(id);
      if (!recipe) return;
      addLine({ kind: 'recipe', sourceId: recipe.id, name: recipe.name, meta: '' });
      return;
    }
    const ingredient = findIngredient(id);
    if (!ingredient) return;
    addLine({ kind: 'ingredient', sourceId: ingredient.id, name: ingredient.name, meta: '' });
  }

  page.addEventListener('click', (e) => {
    const tone = e.target.closest('.menuTone');
    if (tone) {
      toneButtons.forEach(btn => btn.classList.toggle('is-active', btn === tone));
      if (searchInput) {
        searchInput.value = tone.dataset.menuSearch || '';
        filterLibrary();
      }
      return;
    }

    const sourceKindBtn = e.target.closest('[data-menu-source-kind]');
    if (sourceKindBtn) {
      activeSourceKind = sourceKindBtn.dataset.menuSourceKind;
      sourceKindButtons.forEach(btn => {
        const on = btn === sourceKindBtn;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      renderSourceResults();
      return;
    }

    const sourceAdd = e.target.closest('[data-add-source-kind]');
    if (sourceAdd) {
      addSourceById(sourceAdd.dataset.addSourceKind, sourceAdd.dataset.addSourceId);
      return;
    }

    const openBtn = e.target.closest('[data-menu-open-editor]');
    if (openBtn) {
      const mode = openBtn.dataset.menuOpenEditor;
      const card = openBtn.closest('.menuLibraryCard');
      if (mode === 'blank') emptyEditor();
      else if ((mode === 'saved' || mode === 'saved-copy') && card?.dataset.menuId) {
        const menu = readMenus().find(entry => String(entry.id) === String(card.dataset.menuId));
        if (menu) loadMenuIntoEditor(menu, mode === 'saved-copy' ? 'duplicate' : 'saved');
      } else if (card) {
        loadMenuIntoEditor(seedCardToMenu(card), mode === 'seed-copy' ? 'duplicate' : 'seed');
      }
      setView('editor');
      return;
    }

    if (e.target.closest('#btnMenuStart') || e.target.closest('#btnMenuJumpStudio')) {
      emptyEditor();
      setView('editor');
      return;
    }

    if (e.target.closest('#btnMenusBackToLibrary')) {
      setView('library');
      return;
    }

    const sceneBtn = e.target.closest('[data-menu-lane]');
    if (sceneBtn) {
      syncLane(sceneBtn.dataset.menuLane);
      return;
    }

    if (e.target.closest('#btnAddMealRow')) {
      sourceSearch?.focus();
      page.querySelector('.menuEditorCard--source')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (editorStatus) editorStatus.textContent = `Choisis maintenant une ${activeSourceKind === 'ingredient' ? 'source ingrédient' : 'source recette'} pour ${laneMap[activeLane] || activeLane}.`;
      return;
    }

    if (e.target.closest('#btnAddMealNote')) {
      const label = quickNoteText?.value.trim();
      if (!label) {
        if (editorStatus) editorStatus.textContent = 'Écris d’abord une note libre.';
        return;
      }
      addLine({ kind: 'note', sourceId: '', name: label, meta: 'Note libre de composition' });
      if (quickNoteText) quickNoteText.value = '';
      return;
    }

    if (e.target.closest('#btnCalcMeal')) {
      summary?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      summary?.animate([
        { transform: 'scale(1)', boxShadow: '0 16px 34px rgba(31,42,36,.08)' },
        { transform: 'scale(1.01)', boxShadow: '0 20px 38px rgba(30,78,51,.12)' },
        { transform: 'scale(1)', boxShadow: '0 16px 34px rgba(31,42,36,.08)' }
      ], { duration: 420, easing: 'ease-out' });
      return;
    }

    if (e.target.closest('#btnMealReset')) {
      emptyEditor();
      return;
    }

    if (e.target.closest('#btnMealDuplicate')) {
      currentMenuId = '';
      if (mealName && mealName.value.trim()) mealName.value = `${mealName.value.trim()} (copie)`;
      onEditorChanged({ status: 'Copie locale prête. Enregistre-la pour créer un nouveau menu.' });
      return;
    }

    if (e.target.closest('#btnSaveMeal')) {
      saveDraft();
      return;
    }

    const lineAction = e.target.closest('[data-line-action]');
    if (lineAction) {
      const item = lineAction.closest('.menuLineItem');
      if (!item) return;
      if (lineAction.dataset.lineAction === 'remove') {
        item.remove();
        onEditorChanged({ status: 'Ligne supprimée du repas actif.' });
      }
      if (lineAction.dataset.lineAction === 'duplicate') {
        const clonePayload = {
          id: uid('line'),
          lane: item.dataset.lane || activeLane,
          kind: item.dataset.lineKind || 'note',
          sourceId: item.dataset.sourceId || '',
          name: item.querySelector('.menuLineName')?.textContent?.trim() || 'Sans titre',
          meta: item.querySelector('.menuLineMeta')?.textContent?.trim() || ''
        };
        const clone = buildLine(clonePayload);
        item.parentElement?.insertBefore(clone, item.nextSibling);
        onEditorChanged({ status: 'Ligne dupliquée.' });
      }
      return;
    }
  });

  searchInput?.addEventListener('input', filterLibrary);
  sourceSearch?.addEventListener('input', renderSourceResults);
  quickNoteText?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      page.querySelector('#btnAddMealNote')?.click();
    }
  });

  [mealName, mealCategory, mealTags, mealNote, mealPrep].forEach(input => {
    input?.addEventListener('input', () => {
      updateDraftCard();
      updateSummary();
    });
  });

  if (window.NutriStore && typeof window.NutriStore.subscribe === 'function') {
    try {
      window.NutriStore.subscribe('recipes:changed', () => renderSourceResults());
      window.NutriStore.subscribe('ingredients:changed', () => renderSourceResults());
    } catch(_) { }
  }

  syncLane('breakfast');
  setView('library');
  renderSavedMenuCards();
  updateDraftCard();
  updateSummary();
  renderSourceResults();
  filterLibrary();
})();
