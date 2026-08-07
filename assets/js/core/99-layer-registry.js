(function(){
  const app = window.NutriApp = Object.assign({}, window.NutriApp || {});
  app.core = Object.assign({}, app.core || {}, {
    el: (typeof el !== 'undefined') ? el : undefined,
    STORAGE_KEYS: window.STORAGE_KEYS,
    NutriStorage: window.NutriStorage,
    NutriAppData: window.NutriAppData,
    NutriAppFilters: window.NutriAppFilters
  });

  app.domain = Object.assign({}, app.domain || {}, {
    IngredientCategoryDomain: window.IngredientCategoryDomain,
    IngredientDomain: window.IngredientDomain,
    RecipeDomain: window.RecipeDomain,
    CategoryDomain: window.CategoryDomain
  });

  app.ui = Object.assign({}, app.ui || {}, {
    recipeList: (app.ui && app.ui.recipeList) || (window.NutriRecipes && window.NutriRecipes.ui && (window.NutriRecipes.ui.recipeList || window.NutriRecipes.ui.RecipeListView)),
    recipeScenario: (app.ui && app.ui.recipeScenario) || (window.NutriRecipes && window.NutriRecipes.ui && (window.NutriRecipes.ui.recipeScenario || window.NutriRecipes.ui.RecipeReadonlyView)),
    recipeEditor: (app.ui && app.ui.recipeEditor) || window.RecipeEditorModal,
    safe: Object.assign({}, (app.ui && app.ui.safe) || {}, {
      recipeList: app.ui?.safe?.recipeList,
      recipeScenario: app.ui?.safe?.recipeScenario,
      recipeEditor: app.ui?.safe?.recipeEditor,
      UIBus: app.ui?.safe?.UIBus
    })
  });

  app.features = Object.assign({}, app.features || {}, {
    ingredients: Object.assign({}, (app.features && app.features.ingredients) || {}, {
      openCreate: window.NutriAppOpenCreate,
      filters: window.NutriAppFilters,
      data: window.NutriAppData
    }),
    recipes: Object.assign({}, (app.features && app.features.recipes) || {}, {
      openScenario: app.actions && app.actions.openRecipeScenario,
      openEditor: app.actions && app.actions.openRecipeEditor,
      duplicate: app.actions && app.actions.duplicateRecipe,
      delete: app.actions && app.actions.deleteRecipe
    }),
    shared: Object.assign({}, (app.features && app.features.shared) || {}, {
      ocrRecognizeFileToText: window.ocrRecognizeFileToText
    })
  });

  app.compat = Object.assign({}, app.compat || {}, {
    renderRecipeList: ()=>app.ui?.recipeList?.render?.(),
    refreshRecipeFilter: ()=>app.ui?.recipeList?.refreshFilter?.(),
    RecipeEditor: app.ui?.recipeEditor,
    RecipeReadonlyView: app.ui?.recipeScenario
  });

  window.NutriAppBoundaryReport = {
    version: "phase4.3-coupe1",
    layers: ["core", "domain", "ui", "features"],
    compositeFiles: [
      "assets/js/features/ingredients/01-ingredients-runtime-composite.js",
      "assets/js/features/recipes/03-recipes-page-runtime.js"
    ],
    notes: [
      "Les composites restants sont conservés pour éviter une casse fonctionnelle.",
      "Le binding recipe editor init a été déplacé après le runtime éditeur pour supprimer une dépendance temporelle inutile."
    ]
  };
})();
