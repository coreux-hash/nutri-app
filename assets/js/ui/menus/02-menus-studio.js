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
    const detailOverlay = document.getElementById('menuDetailOverlay');
    const detailTitle = document.getElementById('menuDetailTitle');
    const detailBody = document.getElementById('menuDetailBody');
    const detailClose = document.getElementById('menuDetailClose');
    const menuFilterSearch = document.getElementById('menuFilterSearch');
    const menuFilterCategory = document.getElementById('menuFilterCategory');
    const menuFilterStatus = document.getElementById('menuFilterStatus');
    const menuFilterContent = document.getElementById('menuFilterContent');

  let activeView = 'library';
    let activeLane = 'breakfast';
    let activeSourceKind = 'recipe';
    let currentMenuId = '';
    let activeDetailMenu = null;

    const laneMap = { breakfast: 'Matin', lunch: 'Midi', dinner: 'Soir', snack: 'Snack' };
    const statusLabels = {
      draft: 'Brouillon',
      complete: 'Complet',
      incomplete: 'Incomplet',
      missing: 'Source absente',
      inspiration: 'Inspiration'
    };

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
        linked: kind !== 'note' && !!String(raw.sourceId || raw.recipeId || raw.ingredientId || '').trim()
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
        if (line.kind === 'recipe') { stats.recipes += 1; if (line.sourceId) stats.linked += 1; }
        else if (line.kind === 'ingredient') { stats.ingredients += 1; if (line.sourceId) stats.linked += 1; }
      else { stats.notes += 1; }
    });
      stats.meals = activeMeals.size;
      return stats;
    }

    function menuHasMissingSource(menu){
      return (menu?.lines || []).some(line => {
        if (!line || line.kind === 'note' || !line.sourceId) return false;
        return !hydrateLineFromLibrary(line).linked;
      });
    }

    function menuStatus(menu, fallback){
      if (fallback === 'inspiration') return 'inspiration';
      const stats = menuStats(menu?.lines || []);
      if (!stats.meals) return 'draft';
      if (menuHasMissingSource(menu)) return 'missing';
      if (!stats.linked) return 'incomplete';
      return 'complete';
    }

    function menuStatusLabel(status){
      return statusLabels[status] || 'Menu';
    }

    function splitTags(tags){
      return String(tags || '').split(',').map(x => x.trim()).filter(Boolean);
    }

    function lineMatchesKind(menu, contentKind){
      if (!contentKind) return true;
      return (menu?.lines || []).some(line => line && line.kind === contentKind);
    }

    function menuSearchText(menu){
      return [
        menu?.title,
        menu?.category,
        menu?.tags,
        menu?.objective,
        menu?.prep,
        ...(menu?.lines || []).map(line => `${line?.name || ''} ${line?.meta || ''}`)
      ].join(' ').toLowerCase();
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
      if (draftCard) {
        const draftMenu = normalizeMenu({ ...snap, title: snap.title || 'Commencer un menu', origin: 'draft' });
        draftCard.dataset.menuCategory = snap.category || '';
        draftCard.dataset.menuStatus = menuStatus(draftMenu);
        draftCard.dataset.menuSearch = menuSearchText(draftMenu) || 'nouveau brouillon menu';
      }
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

    function applySeedToEditor(seed){
      const data = seed || {};
      emptyEditor();
      if (mealName) mealName.value = String(data.title || data.name || '').trim();
      if (mealCategory) mealCategory.value = String(data.category || '').trim();
      if (mealTags) mealTags.value = Array.isArray(data.tags) ? data.tags.join(', ') : String(data.tags || '').trim();
      if (mealNote) mealNote.value = String(data.objective || '').trim();
      if (mealPrep) mealPrep.value = String(data.prep || '').trim();
      onEditorChanged({ status: 'Brouillon prêt. Ajoute maintenant des recettes, ingrédients ou notes.' });
    }

    function createMenuShell(seed){
      const data = seed || {};
      const menu = normalizeMenu({
        id: uid('menu'),
        title: String(data.title || data.name || '').trim() || 'Menu sans titre',
        category: String(data.category || '').trim(),
        tags: Array.isArray(data.tags) ? data.tags.join(', ') : String(data.tags || '').trim(),
        objective: String(data.objective || '').trim(),
        prep: String(data.prep || '').trim(),
        lines: [],
        origin: 'saved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      const list = readMenus();
      list.unshift(menu);
      writeMenus(list);
      renderSavedMenuCards();
      return menu;
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
      const status = menuStatus(menu);
      return `
<article class="menuLibraryCard" data-menu-id="${escapeHtml(menu.id)}" data-menu-kind="saved" data-menu-category="${escapeHtml(menu.category || '')}" data-menu-status="${escapeHtml(status)}" data-menu-search="${escapeHtml(search)}">
    <div class="menuLibraryCover">
      <div class="menuLibraryTopline">
        <span class="menuLibraryTag">${escapeHtml(menuStatusLabel(status))}</span>
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
        <button class="btn" data-menu-open-detail="saved" type="button">Fiche</button>
        <button class="btn ghost" data-menu-open-editor="saved" type="button">Modifier</button>
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

    function groupedMenuLines(menu){
      const groups = { breakfast: [], lunch: [], dinner: [], snack: [] };
      (menu?.lines || []).forEach(line => {
        const lane = groups[line?.lane] ? line.lane : 'breakfast';
        groups[lane].push(hydrateLineFromLibrary(line));
      });
      return groups;
    }

    function menuDetailMarkup(menu, origin){
      const normalized = normalizeMenu(menu);
      const status = menuStatus(normalized, origin === 'inspiration' ? 'inspiration' : '');
      const stats = menuStats(normalized.lines);
      const tagPills = splitTags(normalized.tags).map(tag => `<span class="pill">${escapeHtml(tag)}</span>`).join('');
      const groups = groupedMenuLines(normalized);
      const mealBlocks = Object.entries(groups).map(([lane, lines]) => {
        const rows = lines.length ? lines.map(line => `
          <article class="menuDetailLine" data-kind="${escapeHtml(line.kind)}" data-linked="${line.linked ? 'true' : 'false'}">
            <div>
              <div class="menuDetailLineTitle">${escapeHtml(line.name)}</div>
              <div class="menuDetailLineMeta">${escapeHtml(line.meta || (line.kind === 'note' ? 'Note libre' : 'Source liée'))}</div>
            </div>
          </article>
        `).join('') : '<div class="menuDetailEmpty">Aucun élément dans ce repas.</div>';
        return `
          <section class="menuDetailMeal">
            <div class="menuDetailMealHead"><b>${escapeHtml(laneMap[lane] || lane)}</b><span>${lines.length} élément${lines.length > 1 ? 's' : ''}</span></div>
            <div class="menuDetailLines">${rows}</div>
          </section>
        `;
      }).join('');
      const canDelete = origin !== 'inspiration' && !!normalized.id;
      return `
        <section class="ingLeadCard">
          <div class="ingLeadTop">
            <div class="ingLeadThumb">🍽️</div>
            <div>
              <h3 class="ingLeadName">${escapeHtml(normalized.title || 'Menu')}</h3>
              <div class="menuDetailPills">
                <span class="menuDetailStatus" data-status="${escapeHtml(status)}">${escapeHtml(menuStatusLabel(status))}</span>
                ${normalized.category ? `<span class="pill">${escapeHtml(normalized.category)}</span>` : ''}
                ${tagPills}
              </div>
            </div>
          </div>
          <div class="ingKv recipeDetailKv">
            <div class="k">Objectif</div><div class="v">${escapeHtml(normalized.objective || '—')}</div>
            <div class="k">Repas</div><div class="v">${stats.meals}</div>
            <div class="k">Recettes liées</div><div class="v">${stats.recipes}</div>
            <div class="k">Ingrédients liés</div><div class="v">${stats.ingredients}</div>
            <div class="k">Notes libres</div><div class="v">${stats.notes}</div>
          </div>
          <div class="ingMacroGrid">
            <div class="ingMacroCell"><div class="ingMacroVal">${stats.meals}</div><div class="ingMacroLbl">Repas</div></div>
            <div class="ingMacroCell"><div class="ingMacroVal">${stats.recipes}</div><div class="ingMacroLbl">Recettes</div></div>
            <div class="ingMacroCell"><div class="ingMacroVal">${stats.ingredients}</div><div class="ingMacroLbl">Ingrédients</div></div>
            <div class="ingMacroCell"><div class="ingMacroVal">${stats.notes}</div><div class="ingMacroLbl">Notes</div></div>
          </div>
          <div class="menuDetailActions">
            <button class="btn btnGold" data-menu-detail-action="edit" type="button">${origin === 'inspiration' ? 'Utiliser dans le studio' : 'Modifier'}</button>
            <button class="btn ghost" data-menu-detail-action="duplicate" type="button">Dupliquer</button>
            ${canDelete ? `<button class="btn ghost" data-exchange-share="menu" data-exchange-id="${escapeHtml(normalized.id || '')}" type="button">Partager la carte</button>` : ''}
            <button class="btn ghost" data-menu-detail-action="export" type="button">Exporter JSON</button>
            ${canDelete ? '<button class="btn ghost" data-menu-detail-action="delete" type="button">Supprimer</button>' : ''}
          </div>
        </section>
        <aside class="ingAsideCard menuDetailAside">
          <section>
            <div class="bigTitle" style="margin-top:0;font-size:20px;">Repas inclus</div>
            <div class="createHint" style="margin-bottom:12px;">Lecture seule. Les liens absents restent visibles pour éviter les menus fantômes.</div>
            <div class="menuDetailMealList">${mealBlocks}</div>
          </section>
          <section>
            <div class="bigTitle" style="margin-top:0;font-size:20px;">Préparation / note</div>
            <div class="menuDetailPrep">${escapeHtml(normalized.prep || 'Aucune note de préparation.')}</div>
          </section>
        </aside>
      `;
    }

    function openMenuDetail(menu, origin){
      if (!detailOverlay || !detailBody) return;
      const normalized = normalizeMenu(menu);
      if (!normalized) return;
      activeDetailMenu = normalized;
      detailOverlay.dataset.menuId = normalized.id || '';
      detailOverlay.dataset.menuOrigin = origin || normalized.origin || 'saved';
      if (detailTitle) detailTitle.textContent = normalized.title || 'Fiche menu';
      detailBody.innerHTML = menuDetailMarkup(normalized, detailOverlay.dataset.menuOrigin);
      detailOverlay.classList.add('show');
      detailOverlay.setAttribute('aria-hidden', 'false');
      try{ detailOverlay.inert = false; }catch(_e){}
      document.body.style.overflow = 'hidden';
      try{ detailClose?.focus(); }catch(_e){}
    }

    function closeMenuDetail(){
      if (!detailOverlay) return;
      try{
        const active = document.activeElement;
        if (active && detailOverlay.contains(active) && typeof active.blur === 'function') active.blur();
      }catch(_e){}
      detailOverlay.classList.remove('show');
      detailOverlay.setAttribute('aria-hidden', 'true');
      try{ detailOverlay.inert = true; }catch(_e){}
      document.body.style.overflow = '';
      activeDetailMenu = null;
    }

    function menuForCard(card){
      if (!card) return null;
      const kind = card.dataset.menuKind || '';
      if (kind === 'saved' && card.dataset.menuId) {
        return readMenus().find(entry => String(entry.id) === String(card.dataset.menuId)) || null;
      }
      if (kind === 'inspiration') return seedCardToMenu(card);
      if (kind === 'draft') return normalizeMenu({ title: mealName?.value || 'Commencer un menu', category: mealCategory?.value || '', tags: mealTags?.value || '', objective: mealNote?.value || '', prep: mealPrep?.value || '', lines: serializeLines(), origin: 'draft' });
      return null;
    }

    function buildMenuExportPayload(menu, opts){
      const normalized = normalizeMenu(menu);
      const payload = {
        meta: {
          app: 'NutriApp',
          schema: 'menu.v1',
          exportedAt: new Date().toISOString(),
          bundle: !!(opts && opts.bundle)
        },
        menu: {
          ...normalized,
          tags: splitTags(normalized.tags),
          lines: normalized.lines.map(line => ({
            id: line.id,
            lane: line.lane,
            kind: line.kind,
            sourceId: line.sourceId,
            nameSnapshot: line.name,
            note: line.kind === 'note' ? line.name : line.meta || ''
          }))
        }
      };
      if (opts && opts.bundle) {
        const recipeIds = new Set(normalized.lines.filter(line => line.kind === 'recipe' && line.sourceId).map(line => String(line.sourceId)));
        const ingredientIds = new Set(normalized.lines.filter(line => line.kind === 'ingredient' && line.sourceId).map(line => String(line.sourceId)));
        payload.recipes = recipeSource().filter(recipe => recipeIds.has(String(recipe?.id || '')));
        payload.ingredients = ingredientSource().filter(ingredient => ingredientIds.has(String(ingredient?.id || '')));
      }
      return payload;
    }

    function downloadMenuJson(menu){
      const payload = buildMenuExportPayload(menu, { bundle: true });
      const name = String(menu?.title || 'menu').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'menu';
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nutriapp-${name}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 800);
    }

    function deleteMenuById(id){
      if (!id) return false;
      const list = readMenus();
      const next = list.filter(menu => String(menu.id) !== String(id));
      if (next.length === list.length) return false;
      writeMenus(next);
      renderSavedMenuCards();
      closeMenuDetail();
      return true;
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
      const pageQuery = (searchInput?.value || '').trim().toLowerCase();
      const modalQuery = (menuFilterSearch?.value || '').trim().toLowerCase();
      const category = String(menuFilterCategory?.value || '').trim().toLowerCase();
      const status = String(menuFilterStatus?.value || '').trim();
      const content = String(menuFilterContent?.value || '').trim();
      let visible = 0;
      Array.from(page.querySelectorAll('.menuLibraryCard')).forEach(card => {
        const haystack = (card.dataset.menuSearch || card.textContent || '').toLowerCase();
        const cardCategory = String(card.dataset.menuCategory || '').trim().toLowerCase();
        const cardStatus = String(card.dataset.menuStatus || '').trim();
        const menu = menuForCard(card);
        const menuText = menuSearchText(menu);
        const okPageQuery = !pageQuery || haystack.includes(pageQuery) || menuText.includes(pageQuery);
        const okModalQuery = !modalQuery || haystack.includes(modalQuery) || menuText.includes(modalQuery);
        const okQuery = okPageQuery && okModalQuery;
        const okCategory = !category || cardCategory === category || String(menu?.category || '').trim().toLowerCase() === category;
        const okStatus = !status || cardStatus === status || menuStatus(menu, card.dataset.menuKind === 'inspiration' ? 'inspiration' : '') === status;
        const okContent = lineMatchesKind(menu, content);
        const show = okQuery && okCategory && okStatus && okContent;
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

      const detailBtn = e.target.closest('[data-menu-open-detail]');
      if (detailBtn) {
        const card = detailBtn.closest('.menuLibraryCard');
        const menu = menuForCard(card);
        if (menu) openMenuDetail(menu, card?.dataset.menuKind || 'saved');
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

      const cardHit = e.target.closest('.menuLibraryCard');
      if (cardHit && !e.target.closest('button, a, input, select, textarea, label')) {
        const menu = menuForCard(cardHit);
        if (menu) openMenuDetail(menu, cardHit.dataset.menuKind || 'saved');
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
    menuFilterSearch?.addEventListener('input', filterLibrary);
    menuFilterCategory?.addEventListener('change', filterLibrary);
    menuFilterStatus?.addEventListener('change', filterLibrary);
    menuFilterContent?.addEventListener('change', filterLibrary);
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

    document.getElementById('btnFilterApply')?.addEventListener('click', () => {
      const ctx = window.NutriAppFilterModal && typeof window.NutriAppFilterModal.getCurrentContext === 'function'
        ? window.NutriAppFilterModal.getCurrentContext()
        : '';
      if (ctx !== 'menus') return;
      if (searchInput && menuFilterSearch && menuFilterSearch.value.trim()) searchInput.value = menuFilterSearch.value.trim();
      filterLibrary();
    }, { capture:true });

    document.getElementById('btnFilterReset')?.addEventListener('click', () => {
      const ctx = window.NutriAppFilterModal && typeof window.NutriAppFilterModal.getCurrentContext === 'function'
        ? window.NutriAppFilterModal.getCurrentContext()
        : '';
      if (ctx !== 'menus') return;
      if (menuFilterSearch) menuFilterSearch.value = '';
      if (menuFilterCategory) menuFilterCategory.value = '';
      if (menuFilterStatus) menuFilterStatus.value = '';
      if (menuFilterContent) menuFilterContent.value = '';
      if (searchInput) searchInput.value = '';
      filterLibrary();
    }, { capture:true });

    detailClose?.addEventListener('click', closeMenuDetail);
    detailOverlay?.addEventListener('click', (e) => { if (e.target === detailOverlay) closeMenuDetail(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && detailOverlay?.classList.contains('show')) closeMenuDetail(); });
    detailOverlay?.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-menu-detail-action]');
      if (!actionBtn) return;
      const id = detailOverlay.dataset.menuId || '';
      const origin = detailOverlay.dataset.menuOrigin || 'saved';
      const sourceMenu = origin === 'inspiration'
        ? null
        : (readMenus().find(menu => String(menu.id) === String(id)) || null);
      const activeMenu = sourceMenu || activeDetailMenu;
      const action = actionBtn.dataset.menuDetailAction;
      if (action === 'edit') {
        if (sourceMenu) loadMenuIntoEditor(sourceMenu, 'saved');
        else if (activeMenu) loadMenuIntoEditor(activeMenu, 'duplicate');
        closeMenuDetail();
        setView('editor');
        return;
      }
      if (action === 'duplicate') {
        if (activeMenu) loadMenuIntoEditor(activeMenu, 'duplicate');
        closeMenuDetail();
        setView('editor');
        return;
      }
      if (action === 'export') {
        if (activeMenu) downloadMenuJson(activeMenu);
        return;
      }
      if (action === 'delete') {
        const ok = confirm('Supprimer ce menu de la bibliothèque ?');
        if (ok) deleteMenuById(id);
      }
    });

    window.NutriMenus = Object.assign({}, window.NutriMenus || {}, {
      openMenuDetail,
      closeMenuDetail,
      createMenuShell,
      openEditorWithSeed(seed){ applySeedToEditor(seed); setView('editor'); },
      createAndOpenEditor(seed){
        const menu = createMenuShell(seed);
        loadMenuIntoEditor(menu, 'saved');
        setView('editor');
        return menu;
      },
      renderSavedMenuCards,
      filterLibrary,
      exportMenu(menu){ return buildMenuExportPayload(menu, { bundle:true }); }
    });

    syncLane('breakfast');
  setView('library');
  renderSavedMenuCards();
  updateDraftCard();
  updateSummary();
  renderSourceResults();
  filterLibrary();
})();

(function(){
  const openBtn = document.getElementById('btnOpenCreateMenu');
  const overlay = document.getElementById('menuCreateOverlay');
  const modal = document.getElementById('menuCreateModal');
  const closeBtn = document.getElementById('btnMenuCreateClose');
  const backBtn = document.getElementById('btnMenuCreateBack');
    const jumpBtn = document.getElementById('btnMenuCreateJumpStudio');
    const studioBtn = document.getElementById('btnMenuJumpStudio');
    const saveDraftBtn = document.getElementById('btnMenuCreateSaveDraft');
    const nameInput = document.getElementById('menuCreateName');
    const categoryInput = document.getElementById('menuCreateCategory');
    const objectiveInput = document.getElementById('menuCreateObjective');
    const tagsInput = document.getElementById('menuCreateTags');
    const statusEl = document.getElementById('menuCreateStatus');
    if(!openBtn || !overlay || !modal) return;

    function readSeed(){
      return {
        title: nameInput?.value.trim() || '',
        category: categoryInput?.value || '',
        objective: objectiveInput?.value.trim() || '',
        tags: tagsInput?.value.trim() || ''
      };
    }

    function resetForm(){
      if(nameInput) nameInput.value = '';
      if(categoryInput) categoryInput.value = '';
      if(objectiveInput) objectiveInput.value = '';
      if(tagsInput) tagsInput.value = '';
      if(statusEl) statusEl.textContent = '';
    }

    function ensureSeedTitle(seed){
      if(seed.title || seed.objective || seed.category || seed.tags) return true;
      if(statusEl) statusEl.textContent = 'Donne au moins un nom, une catégorie ou un objectif.';
      try{ nameInput?.focus(); }catch(_e){}
      return false;
    }

    function open(){
      overlay.classList.remove('hidden');
      overlay.setAttribute('aria-hidden', 'false');
      try{ overlay.inert = false; }catch(_e){}
      try{ nameInput?.focus(); }catch(_e){}
    }

  function close(){
    try{
      const active = document.activeElement;
      if(active && overlay.contains(active) && typeof active.blur === 'function') active.blur();
    }catch(_e){}
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
      try{ overlay.inert = true; }catch(_e){}
    }

  openBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    open();
  });
  closeBtn?.addEventListener('click', close);
  backBtn?.addEventListener('click', close);
  overlay.addEventListener('click', (e)=>{
    if(e.target === overlay) close();
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
  });
    jumpBtn?.addEventListener('click', ()=>{
      const seed = readSeed();
      if(!ensureSeedTitle(seed)) return;
      close();
      if(window.NutriMenus && typeof window.NutriMenus.createAndOpenEditor === 'function') window.NutriMenus.createAndOpenEditor(seed);
      else if(studioBtn && typeof studioBtn.click === 'function') studioBtn.click();
      resetForm();
    });
    saveDraftBtn?.addEventListener('click', ()=>{
      const seed = readSeed();
      if(!ensureSeedTitle(seed)) return;
      if(window.NutriMenus && typeof window.NutriMenus.createMenuShell === 'function'){
        window.NutriMenus.createMenuShell(seed);
        if(statusEl) statusEl.textContent = 'Brouillon enregistré dans la bibliothèque Menus.';
        setTimeout(()=>{ close(); resetForm(); }, 250);
      }
    });
  })();
