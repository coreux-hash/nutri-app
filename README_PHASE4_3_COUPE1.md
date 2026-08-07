Phase 4.3 — Coupe 1

- Suppression des façades UI globales redondantes : NutriUI, RecipeListViewModule, RecipeScenarioViewModule, RecipeEditorModalModule.
- Les modules UI "safe" restent disponibles sous window.NutriApp.ui.safe.*
- core/99-layer-registry.js lit désormais app.ui.safe au lieu des anciens globals modules.
- Aucun changement métier, moteur nutritionnel, IDs DOM, OCR/import/export.
