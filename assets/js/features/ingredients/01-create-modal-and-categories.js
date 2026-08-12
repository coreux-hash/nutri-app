/* Phase 4.2 — Features / Ingredients / Create modal + categories */
(function(){
    const openBtn = el.btnOpenCreate;
    const overlay = el.createOverlay;
    const modal   = el.createModal;
    const closeBtn= el.btnCreateClose;
    const backBtn = el.btnCreateBack;
    const modeBtns= Array.from(modal.querySelectorAll('.createSeg button'));

    const pManual = el.panelManual;
    const pScan   = el.panelScan;
    const pImport = el.panelImport;
    const titleEl = el.createTitle;
    const manualStepBtns = Array.from(pManual?.querySelectorAll('[data-manual-step]') || []);
    const manualStepPanels = Array.from(pManual?.querySelectorAll('[data-manual-step-panel]') || []);
    const manualProxySaveBtns = Array.from(pManual?.querySelectorAll('[data-manual-proxy-save]') || []);
    const manualProxyCancelBtns = Array.from(pManual?.querySelectorAll('[data-manual-proxy-cancel]') || []);

    function setManualStep(step){
      const target = String(step || 'identity');
      manualStepBtns.forEach(btn=>{
        const on = btn.dataset.manualStep === target;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      manualStepPanels.forEach(panel=>{
        panel.classList.toggle('is-active', panel.dataset.manualStepPanel === target);
      });
      pManual?.scrollTo?.({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    }

    function open(){
      overlay.classList.remove('hidden');
      overlay.setAttribute('aria-hidden','false');
    }
    function close(){
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden','true');
    }

    function clickNativeManualAction(kind){
      const target = kind === 'cancel'
        ? document.getElementById('cmManualCancel')
        : document.getElementById('cmManualSave');
      if(target) target.click();
      else if(kind === 'cancel') close();
    }

    function setMode(mode, opts = {}){
      const targetMode = String(mode || 'manual');
      modeBtns.forEach(b=>{
        const on = b.dataset.mode === targetMode;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      pManual.classList.toggle('hiddenPanel', targetMode !== 'manual');
      pScan.classList.toggle('hiddenPanel', targetMode !== 'scan');
      pImport.classList.toggle('hiddenPanel', targetMode !== 'import');

      titleEl.textContent = 'Créer / Modifier un ingrédient';

      if(targetMode === 'manual'){
        setManualStep(opts.manualStep || 'identity');
      }
    }

    openBtn && openBtn.addEventListener('click', ()=>{ open(); setMode('manual'); });
    closeBtn && closeBtn.addEventListener('click', close);
    backBtn && backBtn.addEventListener('click', close);

    overlay.addEventListener('click', (e)=>{ if(e.target === overlay) close(); });
modeBtns.forEach(b=> b.addEventListener('click', ()=> setMode(b.dataset.mode)));
    manualStepBtns.forEach(btn=> btn.addEventListener('click', ()=> setManualStep(btn.dataset.manualStep)));
    pManual?.addEventListener('click', (e)=>{
      const jump = e.target.closest('[data-manual-target]');
      if(!jump) return;
      setManualStep(jump.dataset.manualTarget);
    });
    manualProxySaveBtns.forEach(btn=> btn.addEventListener('click', ()=> clickNativeManualAction('save')));
    manualProxyCancelBtns.forEach(btn=> btn.addEventListener('click', ()=> clickNativeManualAction('cancel')));

    modal?.addEventListener('click', (e)=>{
      const nav = e.target.closest('[data-mode-nav]');
      if(!nav) return;
      const mode = nav.dataset.modeNav || 'manual';
      const manualStep = nav.dataset.manualTarget || undefined;
      setMode(mode, { manualStep });
    });


    document.getElementById('btnCreateSave')?.addEventListener('click', close);
    document.getElementById('cmManualCancel')?.addEventListener('click', close);

    // --- CreateModal -> Ingredient cards binding (manual save) ---
const ingGrid = el.ingGrid;
const cm = {
  name: el.ingName,
  cat:  el.ingCategory,
  profileSolid: el.profileSolid,
  profileLiquid: el.profileLiquid,
  profileCardSolid: el.profileCardSolid,
  profileCardLiquid: el.profileCardLiquid,
  defaultUnit: el.ingDefaultUnit,
  allowG: el.allowG,
  allowPiece: el.allowPiece,
  allowMl: el.allowMl,
  allowTbsp: el.allowTbsp,
  allowTsp: el.allowTsp,
  pieceWeightG: el.pieceWeightG,
  mlWeightG: el.mlWeightG,
  tbspWeightG: el.tbspWeightG,
  tspWeightG: el.tspWeightG,
  unitsGrid: el.ingUnitsGrid,
  gramInfoDot: el.ingGramInfoDot,
  gramSub: el.ingGramSub,
  gramHelp: el.ingGramHelp,
  kcal: el.ingKcal,
  p:    el.ingProt,
  c:    el.ingCarb,
  f:    el.ingFat,
  note: el.ingNote,
  saveManual: el.cmManualSave,
  cancelManual: el.cmManualCancel,
};

  const ING_UNIT_META = [
    { id:'g', label:'g', profiles:['solid','liquid'] },
    { id:'ml', label:'ml', profiles:['liquid'] },
    { id:'piece', label:'pièce', profiles:['solid'] },
    { id:'tbsp', label:'càs', profiles:['solid','liquid'] },
    { id:'tsp', label:'càc', profiles:['solid','liquid'] },
  ];

  function getProfileFromForm(){
    return cm.profileLiquid?.checked ? 'liquid' : 'solid';
  }

  function setProfileInForm(profile, opts = {}){
    const target = (String(profile) === 'liquid') ? 'liquid' : 'solid';
    if(cm.profileSolid) cm.profileSolid.checked = (target === 'solid');
    if(cm.profileLiquid) cm.profileLiquid.checked = (target === 'liquid');
    cm.profileCardSolid?.classList.toggle('is-on', target === 'solid');
    cm.profileCardLiquid?.classList.toggle('is-on', target === 'liquid');
    if(opts.applyDefaults) applyProfileDefaults(target, { force: !!opts.force });
    refreshGrammageUi();
  }

  function applyProfileDefaults(profile, opts = {}){
    const force = !!opts.force;
    if(profile === 'liquid'){
      if(cm.mlWeightG && (force || !String(cm.mlWeightG.value || '').trim())) cm.mlWeightG.value = '1';
      if(cm.allowMl && force) cm.allowMl.checked = true;
      if(cm.pieceWeightG && force && !cm.allowPiece?.checked) cm.pieceWeightG.value = cm.pieceWeightG.value || '';
      if(cm.tbspWeightG && (force || !String(cm.tbspWeightG.value || '').trim())) cm.tbspWeightG.value = '15';
      if(cm.tspWeightG && (force || !String(cm.tspWeightG.value || '').trim())) cm.tspWeightG.value = '5';
    }else{
      if(cm.tbspWeightG && (force || !String(cm.tbspWeightG.value || '').trim())) cm.tbspWeightG.value = '12';
      if(cm.tspWeightG && (force || !String(cm.tspWeightG.value || '').trim())) cm.tspWeightG.value = '4';
    }
  }

  function getAllowedUnitsFromForm(){
    const units = ['g'];
    if(cm.allowMl?.checked) units.push('ml');
    if(cm.allowPiece?.checked) units.push('piece');
    if(cm.allowTbsp?.checked) units.push('tbsp');
    if(cm.allowTsp?.checked) units.push('tsp');
    return units;
  }

  function getUnitCard(unit){
    return cm.unitsGrid?.querySelector(`.ingUnitCard[data-unit="${unit}"]`) || null;
  }

  function setUnitCardState(unit, on){
    const card = getUnitCard(unit);
    if(!card) return;
    card.classList.toggle('is-on', !!on);
    card.classList.toggle('is-off', !on);
  }

  function syncUnitCards(){
    setUnitCardState('g', true);
    setUnitCardState('ml', !!cm.allowMl?.checked);
    setUnitCardState('piece', !!cm.allowPiece?.checked);
    setUnitCardState('tbsp', !!cm.allowTbsp?.checked);
    setUnitCardState('tsp', !!cm.allowTsp?.checked);
  }

  function syncDefaultUnitChoiceUI(){
    const grid = document.getElementById('ingDefaultGrid');
    if(!grid || !cm.defaultUnit) return;
    const allowed = getAllowedUnitsFromForm();
    const current = cm.defaultUnit.value || 'g';
    grid.querySelectorAll('.ingDefaultChoice').forEach(label => {
      const unit = label.getAttribute('data-unit') || '';
      const radio = label.querySelector('input[type="radio"]');
      const enabled = allowed.includes(unit);
      label.classList.toggle('is-off', !enabled);
      label.classList.toggle('is-on', enabled && current === unit);
      if(radio){
        radio.disabled = !enabled;
        radio.checked = enabled && current === unit;
      }
    });
  }

  function syncDefaultUnitOptions(){
    if(!cm.defaultUnit) return;
    const allowed = getAllowedUnitsFromForm();
    const prev = cm.defaultUnit.value || 'g';
    cm.defaultUnit.innerHTML = allowed.map(u => `<option value="${u}">${u}</option>`).join('');
    cm.defaultUnit.value = allowed.includes(prev) ? prev : (allowed[0] || 'g');
    syncDefaultUnitChoiceUI();
  }

  function refreshGrammageUi(){
    const profile = getProfileFromForm();
    const isLiquid = profile === 'liquid';
    if(cm.gramInfoDot) cm.gramInfoDot.style.display = isLiquid ? '' : 'none';
    if(cm.gramSub) cm.gramSub.textContent = 'Référence du calcul nutritionnel';
    if(cm.gramHelp) cm.gramHelp.style.display = isLiquid ? '' : 'none';
  }

  function syncProfileRules(){
    const profile = getProfileFromForm();
    const allowMap = { ml: cm.allowMl, piece: cm.allowPiece, tbsp: cm.allowTbsp, tsp: cm.allowTsp };
    for(const meta of ING_UNIT_META){
      if(meta.id === 'g') continue;
      const input = allowMap[meta.id];
      const card = getUnitCard(meta.id);
      const compatible = meta.profiles.includes(profile);
      if(input){
        input.disabled = !compatible;
        if(!compatible) input.checked = false;
      }
      if(card) card.style.display = compatible ? '' : 'none';
    }
    syncUnitCards();
    syncDefaultUnitOptions();
    refreshGrammageUi();
  }

  function fillIngredientUnitForm(ing){
    const profile = (ing && ing.profile) ? String(ing.profile) : 'solid';
    setProfileInForm(profile, { applyDefaults:false });
    const allowed = Array.isArray(ing?.allowedUnits) && ing.allowedUnits.length ? ing.allowedUnits.map(String) : ['g'];
    if(cm.allowMl) cm.allowMl.checked = allowed.includes('ml');
    if(cm.allowPiece) cm.allowPiece.checked = allowed.includes('piece');
    if(cm.allowTbsp) cm.allowTbsp.checked = allowed.includes('tbsp');
    if(cm.allowTsp) cm.allowTsp.checked = allowed.includes('tsp');
    if(cm.pieceWeightG) cm.pieceWeightG.value = ing?.conversions?.pieceWeightG ?? '';
    if(cm.mlWeightG) cm.mlWeightG.value = ing?.conversions?.mlWeightG ?? '';
    if(cm.tbspWeightG) cm.tbspWeightG.value = ing?.conversions?.tbspWeightG ?? '';
    if(cm.tspWeightG) cm.tspWeightG.value = ing?.conversions?.tspWeightG ?? '';
    applyProfileDefaults(getProfileFromForm(), { force:false });
    syncProfileRules();
    if(cm.defaultUnit) cm.defaultUnit.value = (allowed.includes(ing?.defaultUnit) ? ing.defaultUnit : (getAllowedUnitsFromForm()[0] || 'g'));
    syncUnitCards();
    syncDefaultUnitChoiceUI();
  }

  function initIngredientUnitUi(){
    [cm.allowMl, cm.allowPiece, cm.allowTbsp, cm.allowTsp].filter(Boolean).forEach(inp => inp.addEventListener('change', ()=>{ syncUnitCards(); syncDefaultUnitOptions(); }));
    const bindProfile = (target) => {
      target?.addEventListener('change', ()=>{
        if(target === cm.profileSolid && cm.profileSolid.checked){
          if(cm.profileLiquid) cm.profileLiquid.checked = false;
          setProfileInForm('solid', { applyDefaults:true, force:true });
        }else if(target === cm.profileLiquid && cm.profileLiquid.checked){
          if(cm.profileSolid) cm.profileSolid.checked = false;
          setProfileInForm('liquid', { applyDefaults:true, force:true });
        }else if(!cm.profileSolid?.checked && !cm.profileLiquid?.checked){
          setProfileInForm('solid', { applyDefaults:true, force:false });
        }
        syncProfileRules();
      });
    };
    bindProfile(cm.profileSolid);
    bindProfile(cm.profileLiquid);
    cm.profileCardSolid?.addEventListener('click', (e)=>{ if(e.target !== cm.profileSolid) { setProfileInForm('solid', { applyDefaults:true, force:true }); syncProfileRules(); } });
    cm.profileCardLiquid?.addEventListener('click', (e)=>{ if(e.target !== cm.profileLiquid) { setProfileInForm('liquid', { applyDefaults:true, force:true }); syncProfileRules(); } });
    document.getElementById('ingDefaultGrid')?.addEventListener('click', (e)=>{
      const choice = e.target.closest('.ingDefaultChoice');
      if(!choice || choice.classList.contains('is-off') || !cm.defaultUnit) return;
      cm.defaultUnit.value = choice.getAttribute('data-unit') || 'g';
      syncDefaultUnitChoiceUI();
    });
    setProfileInForm('solid', { applyDefaults:true, force:false });
    syncProfileRules();
    fillIngredientUnitForm(null);
  }

  // --- Catégories ingrédients (héritées v3_5_4) ---
  const ING_CATEGORY_ITEMS = [
    { id: "viandes_volailles",  label: "Viande & volaille" },
    { id: "poissons",           label: "Poisson" },
    { id: "fruits_de_mer",      label: "Fruits de mer" },
    { id: "oeufs",              label: "Œufs" },
    { id: "produits_laitiers",  label: "Produits laitiers" },

    { id: "proteines_vegetales", label: "Protéines végétales" },
    { id: "cereales_feculents",  label: "Céréales & féculents" },
    { id: "legumes",             label: "Légumes" },
    { id: "fruits",              label: "Fruits" },

    { id: "matieres_grasses",    label: "Matières grasses / oléagineux" },
    { id: "sucrants",            label: "Sucrants" },
    { id: "liquides_boissons",   label: "Liquides & boissons" },

    { id: "aides_techniques",    label: "Aides techniques (levure, gélifiants…)" },
    { id: "epices_aromes",       label: "Épices, herbes & arômes" },
    { id: "autre",               label: "Autres / divers" }
  ];

  const ING_CAT_LABEL_BY_ID = Object.fromEntries(ING_CATEGORY_ITEMS.map(c => [c.id, c.label]));
  const ING_CAT_ID_BY_LABEL = Object.fromEntries(ING_CATEGORY_ITEMS.map(c => [c.label.toLowerCase(), c.id]));

  const IngredientCategoryDomain = (function(){
    const LEGACY_ID_ALIASES = {
      liquides: 'liquides_boissons',
      techniques: 'aides_techniques'
    };
    const LEGACY_LABEL_ALIASES = {
      'liquides': 'liquides_boissons',
      'liquides & boissons': 'liquides_boissons',
      'aides techniques': 'aides_techniques',
      'aides techniques (levure, gélifiants…)': 'aides_techniques',
      'fruit': 'fruits',
      'legume': 'legumes',
      'poisson': 'poissons',
      'oeuf': 'oeufs'
    };
    function slug(s){
      return String(s || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g,'')
        .replace(/&/g,'et')
        .replace(/[^a-z0-9]+/g,'_')
        .replace(/^_+|_+$/g,'');
    }
    function getIngredientCategories(){
      return (Array.isArray(window.ING_CATEGORY_ITEMS) ? window.ING_CATEGORY_ITEMS : ING_CATEGORY_ITEMS)
        .map(c => ({ ...c }));
    }
    function labelForCategoryId(id){
      const sid = String(id || '').trim();
      return (getIngredientCategories().find(c => c.id === sid) || {}).label || sid || '';
    }
    function normalizeCategory(input){
      const raw = String(input ?? '').trim();
      if(!raw) return { id:'', label:'' };
      const byId = Object.fromEntries(getIngredientCategories().map(c => [c.id, c.label]));
      const byLabel = Object.fromEntries(getIngredientCategories().map(c => [String(c.label || '').toLowerCase(), c.id]));
      const rawId = LEGACY_ID_ALIASES[raw] || raw;
      if(byId[rawId]) return { id: rawId, label: byId[rawId] };
      const key = raw.toLowerCase();
      const keySlug = slug(raw);
      const aliasId = LEGACY_LABEL_ALIASES[key] || LEGACY_LABEL_ALIASES[keySlug] || byLabel[key];
      if(aliasId && byId[aliasId]) return { id: aliasId, label: byId[aliasId] };
      for(const c of getIngredientCategories()){
        if(slug(c.id) === keySlug || slug(c.label) === keySlug){
          return { id: c.id, label: c.label };
        }
      }
      return { id:'', label: raw };
    }
    function fillSelect(sel, placeholderHtml){
      if(!sel) return;
      const firstOpt = sel.querySelector('option[value=""]');
      const keep = placeholderHtml || (firstOpt ? firstOpt.outerHTML : '<option value="">Catégorie</option>');
      const items = getIngredientCategories().slice().sort((a,b)=>String(a.label||'').localeCompare(String(b.label||''), 'fr'));
      sel.innerHTML = keep + items.map(it => `<option value="${it.id}">${it.label}</option>`).join('');
    }
    return { getIngredientCategories, labelForCategoryId, normalizeCategory, fillSelect };
  })();
  window.IngredientCategoryDomain = IngredientCategoryDomain;

  function normalizeCategory(input){
    return IngredientCategoryDomain.normalizeCategory(input);
  }

  const ING_CAT_COLOR = {
    _palette: [
      'var(--chipStBg)','var(--chipPBg)','var(--chipVBg)','var(--chipFBg)',
      '#e7f3ff','#f3e7ff','#fff2e0','#e8fff1',
      '#ffe7f1','#eef7e7','#e7eef7','#f7e7ee'
    ],
    get(id){
      if(!id) return { bg:'var(--chipMutedBg)', fg:'var(--chipMutedFg)' };
      let h=0; for(let i=0;i<id.length;i++) h=(h*31 + id.charCodeAt(i))>>>0;
      const bg = this._palette[h % this._palette.length];
      return { bg, fg:'var(--chipMutedFg)' };
    }
  };

  function fillCategorySelect(sel){
    return IngredientCategoryDomain.fillSelect(sel);
  }

  function initIngredientCategories(){
    // createModal (ingrédient)
    fillCategorySelect(document.getElementById('ingCategory'));
    // fallback si un ancien id existe encore
    fillCategorySelect(document.getElementById('cmCategory'));
    // filtre (modal)
    fillCategorySelect(document.getElementById('fltCategory'));
  }

  // expose for other handlers
  window.initIngredientCategories = initIngredientCategories;

  document.addEventListener('DOMContentLoaded', ()=>{ initIngredientCategories(); initIngredientUnitUi(); });
  const ns = window.NutriIngredients = window.NutriIngredients || {};
  ns.ui = Object.assign({}, ns.ui || {}, {
    openCreateModal: open,
    closeCreateModal: close,
    setCreateMode: setMode,
    ingGrid,
    cm,
    getProfileFromForm,
    setProfileInForm,
    applyProfileDefaults,
    getAllowedUnitsFromForm,
    fillIngredientUnitForm,
    initIngredientUnitUi
  });
  ns.domain = Object.assign({}, ns.domain || {}, {
    ING_CATEGORY_ITEMS,
    ING_CAT_LABEL_BY_ID,
    ING_CAT_ID_BY_LABEL,
    IngredientCategoryDomain,
    normalizeCategory,
    ING_CAT_COLOR,
    fillCategorySelect,
    initIngredientCategories
  });
  window.normalizeCategory = normalizeCategory;
  window.fillCategorySelect = fillCategorySelect;
})();
