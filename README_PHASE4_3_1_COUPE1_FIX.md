Phase 4.3.1 — Coupe 1 fix

Fixes:
- ingredients cards now resolve getIngredientStoreSnapshot via NutriIngredients.store or legacy global fallback
- print init now resolves recipe category labels via CategoryDomain.labelForCategoryId
- compatibility globals re-exposed for get/setIngredientStoreSnapshot only
