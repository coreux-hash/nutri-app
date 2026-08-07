/* === JS utilities (clean lvl 2) === */
const el = {
  // Filter modal
  btnOpenFilters: document.getElementById('btnOpenFilters'),
  filterOverlay: document.getElementById('filterOverlay'),
  filterModal: document.getElementById('filterModal'),
  btnFilterClose: document.getElementById('btnFilterClose'),
  btnFilterBack: document.getElementById('btnFilterBack'),
  fltCatWrap: document.getElementById('fltCatWrap'),
  fltTagsWrap: document.getElementById('fltTagsWrap'),
  fltScope: document.getElementById('fltScope'),
  btnFilterReset: document.getElementById('btnFilterReset'),
  btnFilterApply: document.getElementById('btnFilterApply'),
  fltCategory: document.getElementById('fltCategory'),

  // Create modal
  btnOpenCreate: document.getElementById('btnOpenCreate'),
  createOverlay: document.getElementById('createOverlay'),
  createModal: document.getElementById('createModal'),
  btnCreateClose: document.getElementById('btnCreateClose'),
  btnCreateBack: document.getElementById('btnCreateBack'),
  createTitle: document.getElementById('createTitle'),
  panelManual: document.getElementById('panelManual'),
  panelScan: document.getElementById('panelScan'),
  panelImport: document.getElementById('panelImport'),

  // Ingredient grid + create fields
  ingGrid: document.getElementById('ingGrid'),
  ingName: document.getElementById('ingName'),
  ingCategory: document.getElementById('ingCategory'),
  profileSolid: document.getElementById('profileSolid'),
  profileLiquid: document.getElementById('profileLiquid'),
  profileCardSolid: document.getElementById('profileCardSolid'),
  profileCardLiquid: document.getElementById('profileCardLiquid'),
  ingDefaultUnit: document.getElementById('ingDefaultUnit'),
  allowG: document.getElementById('allowG'),
  allowPiece: document.getElementById('allowPiece'),
  allowMl: document.getElementById('allowMl'),
  allowTbsp: document.getElementById('allowTbsp'),
  allowTsp: document.getElementById('allowTsp'),
  pieceWeightG: document.getElementById('pieceWeightG'),
  mlWeightG: document.getElementById('mlWeightG'),
  tbspWeightG: document.getElementById('tbspWeightG'),
  tspWeightG: document.getElementById('tspWeightG'),
  ingUnitsGrid: document.getElementById('ingUnitsGrid'),
  ingGramInfoDot: document.getElementById('ingGramInfoDot'),
  ingGramSub: document.getElementById('ingGramSub'),
  ingGramHelp: document.getElementById('ingGramHelp'),
  ingKcal: document.getElementById('ingKcal'),
  ingProt: document.getElementById('ingProt'),
  ingCarb: document.getElementById('ingCarb'),
  ingFat: document.getElementById('ingFat'),
  ingNote: document.getElementById('ingNote'),
  cmManualSave: document.querySelector('#createModal #cmManualSave'),
  cmManualCancel: document.querySelector('#createModal #cmManualCancel'),

  // OCR/import controls (used elsewhere too)
  btnOcrScan: document.getElementById('btnOcrScan'),
  btnOcrApplyToManual: document.getElementById('btnOcrApplyToManual'),
  ocrImage: document.getElementById('ocrImage'),
  ocrOut: document.getElementById('ocrOut'),
  btnQuickPreview: document.getElementById('btnQuickPreview'),
  btnQuickAdd: document.getElementById('btnQuickAdd'),
  quickImportBox: document.getElementById('quickImportBox'),
  quickImportPreview: document.getElementById('quickImportPreview'),
  quickImportStatus: document.getElementById('quickImportStatus'),
  btnImportClear: document.getElementById('btnImportClear'),

  // Backup modal (if present)
  btnOpenBackup: document.getElementById('btnOpenBackup'),
};

const STORAGE_KEYS = Object.freeze({
  ingredients: 'nutriapp.ingredients.v2',
  recipes:     'nutriapp.recipes.v2',
  // Internal canonical name = meals (UI label can stay "Menus")
  meals:       'nutriapp.meals.v2',
  // Backward/compat alias (legacy code paths may still reference .menus)
  menus:       'nutriapp.meals.v2'
});

  
const STORAGE = STORAGE_KEYS;
window.STORAGE_KEYS = STORAGE_KEYS;

window.NutriApp = Object.assign({}, window.NutriApp || {}, { core: Object.assign({}, (window.NutriApp && window.NutriApp.core) || {}, { el, STORAGE_KEYS }) });
