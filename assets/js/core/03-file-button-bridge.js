
(function(){
  function closestButtonId(ev){
    const btn = ev.target && ev.target.closest ? ev.target.closest('button') : null;
    return btn ? btn.id : '';
  }

  document.addEventListener('click', function(ev){
    const id = closestButtonId(ev);
    if(!id) return;
if(id === 'btnImportClear'){
      const t = document.getElementById('quickImportBox'); if(t) t.value='';
      const p = document.getElementById('quickImportPreview'); if(p){ p.style.display='none'; p.textContent=''; }
      const s = document.getElementById('quickImportStatus'); if(s) s.textContent='';
      return;
    }
  }, true);
})();
