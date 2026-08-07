
(function(){
  "use strict";

  function safeCall(fn){
    try{ return fn(); }catch(err){ console.error(err); }
  }

  const app = window.NutriApp = Object.assign({}, window.NutriApp || {});
  app.ui = Object.assign({}, app.ui || {});
  app.ui.safe = Object.assign({}, app.ui.safe || {});
  const recipesNs = window.NutriRecipes || {};
  const listView = app.ui.recipeList || recipesNs.ui?.recipeList || recipesNs.ui?.RecipeListView;
  const scenarioView = app.ui.recipeScenario || recipesNs.ui?.recipeScenario || recipesNs.ui?.RecipeReadonlyView;
  const editorView = app.ui.recipeEditor || window.RecipeEditorModal;
  const actions = app.actions || {};

  const UIBus = app.ui.safe.UIBus || (()=>{
    const map = new Map();
    return {
      on(evt, cb){
        if(!map.has(evt)) map.set(evt, new Set());
        map.get(evt).add(cb);
        return ()=>{ try{ map.get(evt)?.delete(cb); }catch(_){} };
      },
      emit(evt, payload){
        const set = map.get(evt);
        if(!set) return;
        [...set].forEach(cb=>{ try{ cb(payload); }catch(err){ console.error(err); } });
      }
    };
  })();

  const RecipeListViewModule = {
    render(){
      return safeCall(()=> listView && typeof listView.render === 'function' ? listView.render() : undefined);
    },
    refreshFilter(){
      return safeCall(()=> listView && typeof listView.refreshFilter === 'function' ? listView.refreshFilter() : undefined);
    },
    openScenario(id){ UIBus.emit('recipe:openScenario', id); },
    editRecipe(id){ UIBus.emit('recipe:edit', id); },
    duplicateRecipe(id){ UIBus.emit('recipe:duplicate', id); },
    deleteRecipe(id){ UIBus.emit('recipe:delete', id); }
  };

  const RecipeScenarioViewModule = {
    openById(id){
      return safeCall(()=> scenarioView && typeof scenarioView.openById === 'function' ? scenarioView.openById(id) : undefined);
    },
    close(){
      return safeCall(()=> scenarioView && typeof scenarioView.close === 'function' ? scenarioView.close() : undefined);
    }
  };

  const RecipeEditorModalModule = {
    create(){
      return safeCall(()=> editorView && typeof editorView.create === 'function' ? editorView.create() : undefined);
    },
    edit(id){
      return safeCall(()=> editorView && typeof editorView.edit === 'function' ? editorView.edit(id) : undefined);
    },
    save(){
      return safeCall(()=> editorView && typeof editorView.save === 'function' ? editorView.save() : undefined);
    },
    reset(){
      return safeCall(()=> editorView && typeof editorView.reset === 'function' ? editorView.reset() : undefined);
    }
  };

  UIBus.on('recipe:openScenario', (id)=>{
    if(id == null || id === '') return;
    RecipeScenarioViewModule.openById(id);
  });
  UIBus.on('recipe:edit', (id)=>{
    if(id == null || id === '') return;
    RecipeEditorModalModule.edit(id);
  });
  UIBus.on('recipe:duplicate', (id)=>{
    if(id == null || id === '') return;
    safeCall(()=> typeof actions.duplicateRecipe === 'function' ? actions.duplicateRecipe(id) : undefined);
  });
  UIBus.on('recipe:delete', (id)=>{
    if(id == null || id === '') return;
    safeCall(()=> typeof actions.deleteRecipe === 'function' ? actions.deleteRecipe(id) : undefined);
  });

  app.ui.safe = Object.assign({}, app.ui.safe || {}, {
    UIBus,
    recipeList: RecipeListViewModule,
    recipeScenario: RecipeScenarioViewModule,
    recipeEditor: RecipeEditorModalModule
  });

  const btnOpenCreateRecipe = document.getElementById('btnOpenCreateRecipe');
  if(btnOpenCreateRecipe && !btnOpenCreateRecipe.dataset.phase3Bound){
    btnOpenCreateRecipe.dataset.phase3Bound = '1';
    btnOpenCreateRecipe.addEventListener('click', function(){ RecipeEditorModalModule.create(); });
  }
})();
