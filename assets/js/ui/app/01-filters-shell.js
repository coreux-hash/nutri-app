(function(){
  // Phase 5 bridge: keep a lightweight filter-modal registry without binding UI twice.
  const overlay = document.getElementById('filterOverlay');
  const modal = document.getElementById('filterModal');
  if(!overlay || !modal) return;

  window.NutriAppFilterModal = Object.assign({}, window.NutriAppFilterModal || {}, {
    overlay,
    modal,
    getCurrentContext(){
      return String(modal.dataset.filterContext || 'ingredients').trim() || 'ingredients';
    },
    setCurrentContext(name){
      modal.dataset.filterContext = name || 'ingredients';
      return modal.dataset.filterContext;
    }
  });
})();
