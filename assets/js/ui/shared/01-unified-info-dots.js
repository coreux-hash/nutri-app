
(function(){
  function qsa(root, sel){ return Array.from((root || document).querySelectorAll(sel)); }
  function closeAllInfoBubbles(except){
    qsa(document, '.uiInfoAnchor.open').forEach(function(anchor){
      if(except && anchor === except) return;
      anchor.classList.remove('open');
      var btn = anchor.querySelector('.uiInfoDot');
      if(btn) btn.setAttribute('aria-expanded', 'false');
    });
  }
  function bindInfoAnchor(anchor){
    if(!anchor || anchor.dataset.infoBound === '1') return;
    anchor.dataset.infoBound = '1';
    var btn = anchor.querySelector('.uiInfoDot');
    if(!btn) return;
    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      var willOpen = !anchor.classList.contains('open');
      closeAllInfoBubbles(anchor);
      anchor.classList.toggle('open', willOpen);
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  }
  function createInfoAnchor(text, label){
    var anchor = document.createElement('span');
    anchor.className = 'uiInfoAnchor';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'uiInfoDot';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', label || 'Informations');
    btn.textContent = 'i';
    var bubble = document.createElement('div');
    bubble.className = 'uiInfoBubble';
    bubble.textContent = text;
    anchor.appendChild(btn);
    anchor.appendChild(bubble);
    bindInfoAnchor(anchor);
    return anchor;
  }
  function resolveTitleForHint(hint){
    if(!hint) return null;
    var prev = hint.previousElementSibling;
    while(prev){
      if(prev.classList && prev.classList.contains('bigTitle')) return prev;
      prev = prev.previousElementSibling;
    }
    var panel = hint.closest('.panel');
    if(panel){
      var panelTitle = panel.querySelector('.bigTitle');
      if(panelTitle) return panelTitle;
    }
    var modal = hint.closest('.createModal');
    if(modal){
      return modal.querySelector('.title, .ctitle');
    }
    return null;
  }
  function ensureTitleInfo(title, text){
    if(!title || !text) return;
    if(title.querySelector(':scope > .uiInfoAnchor')) return;
    title.classList.add('hasUnifiedInfo');
    if(!title.querySelector(':scope > .uiInfoText')){
      var txt = document.createElement('span');
      txt.className = 'uiInfoText';
      while(title.firstChild && !(title.firstElementChild && title.firstElementChild.classList && title.firstElementChild.classList.contains('modalIconBtn'))){
        txt.appendChild(title.firstChild);
      }
      if(txt.childNodes.length){
        title.insertBefore(txt, title.firstChild || null);
      }
    }
    var anchor = createInfoAnchor(text, "Voir l'aide");
    var actionBtn = title.querySelector(':scope > .modalIconBtn');
    var textSpan = title.querySelector(':scope > .uiInfoText');
    if(actionBtn) title.insertBefore(anchor, actionBtn);
    else if(textSpan && textSpan.nextSibling) title.insertBefore(anchor, textSpan.nextSibling);
    else title.appendChild(anchor);
  }
  function convertCreateHints(scopeSel){
    var scope = document.querySelector(scopeSel);
    if(!scope) return;
    qsa(scope, '.createBody .createHint').forEach(function(hint){
      if(hint.dataset.unifiedInfo === '1') return;
      var text = (hint.innerText || hint.textContent || '').replace(/\s+/g, ' ').trim();
      var title = resolveTitleForHint(hint);
      if(title && text){
        ensureTitleInfo(title, text);
        hint.classList.add('uiHintHidden');
        hint.dataset.unifiedInfo = '1';
      }
    });
  }
  function convertInlineInfoDots(scopeSel){
    var scope = document.querySelector(scopeSel);
    if(!scope) return;
    qsa(scope, '.ingInfoDot').forEach(function(oldDot){
      if(oldDot.dataset.unifiedInfo === '1') return;
      var text = (oldDot.getAttribute('title') || oldDot.dataset.info || oldDot.textContent || '').replace(/\s+/g, ' ').trim();
      if(!text) return;
      var anchor = createInfoAnchor(text, "Voir l'aide");
      if(oldDot.id) anchor.dataset.sourceId = oldDot.id;
      if(oldDot.style && oldDot.style.display === 'none') anchor.style.display = 'none';
      oldDot.replaceWith(anchor);
    });
  }
  function wireOverlayFocusFix(){
    ['createOverlay','recipeCreateOverlay','filterOverlay','backupOverlay'].forEach(function(id){
      var overlay = document.getElementById(id);
      if(!overlay) return;
      var sync = function(){
        var hidden = overlay.classList.contains('hidden') || overlay.getAttribute('aria-hidden') === 'true';
        if(hidden){
          if(overlay.contains(document.activeElement)){ try { document.activeElement.blur(); } catch(e){} }
          overlay.inert = true;
        } else {
          overlay.inert = false;
        }
      };
      sync();
      var mo = new MutationObserver(sync);
      mo.observe(overlay, { attributes:true, attributeFilter:['class','aria-hidden'] });
    });
  }
  convertCreateHints('#createOverlay');
  convertCreateHints('#recipeCreateOverlay');
  convertInlineInfoDots('#createOverlay');
  document.addEventListener('click', function(ev){
    if(ev.target.closest('.uiInfoAnchor')) return;
    closeAllInfoBubbles();
  });
  document.addEventListener('keydown', function(ev){
    if(ev.key === 'Escape') closeAllInfoBubbles();
  });
  wireOverlayFocusFix();
})();
