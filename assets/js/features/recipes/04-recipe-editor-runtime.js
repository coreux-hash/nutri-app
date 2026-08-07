
/* === Stable Recipe CreateModal (rows/edit/duplicate/recalc/save/reopen) === */
(function(){
  "use strict";

  // No local storage circuit here: RecipeEditor must use the runtime single source of truth.

  const recipeModalRoot = ()=>{
    const ov = document.getElementById("recipeCreateOverlay");
    if(!ov) return null;
    // Prefer the visible/active modal when open
    const m = ov.querySelector('#recipeCreateModal');
    return m || null;
  };
  const $ = (id)=>{
    if(id==="recipeCreateOverlay") return document.getElementById(id);
    const root = recipeModalRoot();
    if(root){
      const el = root.querySelector('#'+id);
      if(el) return el;
    }
    return document.getElementById(id);
  };

  // --- Safe storage helpers ---
  // --- Data access (single runtime source of truth) ---
  function getIngredients(){
    return (typeof window.getRuntimeIngredients === "function")
      ? window.getRuntimeIngredients()
      : ((typeof window.getIngredients === "function") ? window.getIngredients() : []);
  }
  function getRecipes(){
    return (typeof window.getRuntimeRecipes === "function")
      ? window.getRuntimeRecipes()
      : ((typeof window.getRecipes === "function") ? window.getRecipes() : []);
  }
  function setRecipes(arr){
    return (typeof window.setRuntimeRecipes === "function")
      ? window.setRuntimeRecipes(Array.isArray(arr) ? arr : [])
      : ((typeof window.setRecipes === "function") ? window.setRecipes(Array.isArray(arr) ? arr : []) : false);
  }

  // --- Normalization ---
  function uid(prefix){
    return (prefix||"r_") + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
  }
  function toNum(v){
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  function clamp(v, min, max){
    const n = Number(v);
    if(!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }
  function normRecipe(r){
    const out = Object.assign({}, r||{});
    out.id = String(out.id || uid("r_"));
    out.name = String(out.name || "").trim() || "Recette";
    out.categoryId = String(out.categoryId || "autre");
    out.tags = String(out.tags || "").trim();
    out.parts = Math.max(0, Math.round(toNum(out.parts || out.recipePortions || 0)));
    out.cookedWeight = Math.max(0, Math.round(toNum(out.cookedWeight || out.poidsCuit || 0)));
    out.prepTime = String(out.prepTime || "").trim();
    out.prep = String(out.prep || "").trim();
    out.thumbDataUrl = out.thumbDataUrl || "";
    out.rows = Array.isArray(out.rows) ? out.rows : [];
    out.rows = out.rows
      .map(x=>{
        const qty = Math.max(0, toNum(x?.qty));
        const unitRaw = String(x?.unit || x?.u || "g").trim().toLowerCase();
        const unit = ["g","piece","ml","tbsp","tsp"].includes(unitRaw) ? unitRaw : "g";
        const gramsResolved = Math.max(0, toNum(x?.gramsResolved ?? x?.grams ?? 0));
        const kcal = Math.max(0, toNum(x?.macrosResolved?.kcal ?? x?.kcal ?? 0));
        const p = Math.max(0, toNum(x?.macrosResolved?.p ?? x?.p ?? 0));
        const c = Math.max(0, toNum(x?.macrosResolved?.c ?? x?.c ?? x?.carbs ?? 0));
        const f = Math.max(0, toNum(x?.macrosResolved?.f ?? x?.f ?? x?.fat ?? 0));
        return {
          categoryId: String(x?.categoryId || x?.cat || ""),
          ingredientId: String(x?.ingredientId || x?.ing || ""),
          ingredientName: String(x?.ingredientName || x?.name || ""),
          qty,
          unit,
          gramsResolved,
          macrosResolved: { kcal, p, c, f }
        };
      })
      .filter(x=> (x.ingredientId || x.ingredientName || x.qty>0 || x.gramsResolved>0));
    return out;
  }

  // --- DOM: datalist for ingredients names ---
  function ensureIngredientDatalist(){
    let dl = $("dlIngredients");
    if(!dl){
      dl = document.createElement("datalist");
      dl.id = "dlIngredients";
      document.body.appendChild(dl);
    }
    const ings = getIngredients();
    dl.innerHTML = ings.map(i=>{
      const name = String(i?.name || "").trim();
      if(!name) return "";
      return `<option value="${name.replace(/"/g,'&quot;')}"></option>`;
    }).join("");
  }

  // --- DOM: row builder ---
  // Expose globally because some existing code calls addRecipeRow(...)
  window.addRecipeRow = function(seed){
    // Backward-compat alias (CLEAN_BASE v2): forward to RecipeEditor row builder
    try{
      if(!seed) return RecipeEditor.addRow();
      RecipeEditor.addRow({
        categoryId: seed.categoryId || seed.cat || "",
        ingredientId: seed.ingredientId || seed.ing || "",
        ingredientName: seed.ingredientName || seed.name || "",
        qty: seed.qty ?? "",
        unit: seed.unit || "g"
      });
    }catch(_){}
  };



  // --- Recipe unit helpers (zone 6) ---
  function recipeAllowedUnitsForIngredient(ing){
    const VALID = ["g","piece","ml","tbsp","tsp"];
    const raw = Array.isArray(ing?.allowedUnits) ? ing.allowedUnits.map(x=>String(x||"").trim()).filter(Boolean) : [];
    const allowed = raw.length ? raw : ["g"];
    const filtered = allowed.filter(u => VALID.includes(u));
    return filtered.length ? filtered : ["g"];
  }

  function recipeUnitLabel(u){
    return ({ g:"g", piece:"pièce", ml:"ml", tbsp:"càs", tsp:"càc" }[u] || u);
  }

  function recipeFindIngredientByRow(row, ings){
    const list = Array.isArray(ings) ? ings : getIngredients();
    if(row?.ingredientId){
      const byId = list.find(i=>String(i?.id)===String(row.ingredientId));
      if(byId) return byId;
    }
    if(row?.ingredientName){
      const needle = String(row.ingredientName||"").trim().toLowerCase();
      if(needle){
        const byName = list.find(i=>String(i?.name||"").trim().toLowerCase()===needle);
        if(byName) return byName;
      }
    }
    return null;
  }

  function recipeConvertQtyToGrams(ing, qty, unit){
    const q = toNum(qty);
    const u = String(unit || "g").trim();
    if(!q || q <= 0) return 0;
    if(u === 'g') return q;
    if(!ing) return 0;
    const allowed = recipeAllowedUnitsForIngredient(ing);
    if(!allowed.includes(u)) return 0;
    const conv = ing?.conversions || {};
    if(u === 'piece') return q * toNum(conv.pieceWeightG);
    if(u === 'ml'){
      const mlWeightG = toNum(conv.mlWeightG || conv.mlWeight || 0);
      return mlWeightG > 0 ? q * mlWeightG : 0;
    }
    if(u === 'tbsp')  return q * toNum(conv.tbspWeightG);
    if(u === 'tsp')   return q * toNum(conv.tspWeightG);
    return 0;
  }

  function recipeMacrosFromGrams(ing, grams){
    const g = toNum(grams);
    const k100 = ing ? toNum(ing.kcal100 ?? ing.kcal ?? ing.kcalPer100) : 0;
    const p100 = ing ? toNum(ing.p100 ?? ing.prot100 ?? ing.protein100 ?? ing.P ?? ing.protein) : 0;
    const c100 = ing ? toNum(ing.g100 ?? ing.carb100 ?? ing.carbs100 ?? ing.G ?? ing.carbs) : 0;
    const f100 = ing ? toNum(ing.l100 ?? ing.fat100 ?? ing.L ?? ing.fat) : 0;
    return {
      kcal: g/100 * k100,
      p: g/100 * p100,
      c: g/100 * c100,
      f: g/100 * f100
    };
  }

  function resolveRecipeRow(row, ings){
    const list = Array.isArray(ings) ? ings : getRuntimeIngredients();
    const qty = clamp(toNum(row?.qty), 0, 1e9);
    const unit = String(row?.unit || "g").trim() || "g";
    const ing = recipeFindIngredientByRow(row, list);
    const allowedUnits = ing ? recipeAllowedUnitsForIngredient(ing) : ["g"];
    const unitAllowed = !!(ing && allowedUnits.includes(unit));
    const gramsResolved = clamp(toNum(recipeConvertQtyToGrams(ing, qty, unit)), 0, 1e9);
    const m = recipeMacrosFromGrams(ing, gramsResolved) || {};
    const macrosResolved = {
      kcal: toNum(m.kcal),
      p: toNum(m.p),
      c: toNum(m.c),
      f: toNum(m.f)
    };

    const hasQty = qty > 0;
    const hasIngredient = !!ing;
    const invalidUnit = !!(hasIngredient && unit !== "g" && !unitAllowed);
    const missingConversion = !!(hasIngredient && hasQty && unit !== "g" && unitAllowed && gramsResolved <= 0);
    const missingIngredient = !!(!hasIngredient && hasQty);
    const isResolved = !!(hasIngredient && hasQty && gramsResolved > 0);
    const isUnresolved = !!(hasQty && (invalidUnit || missingConversion || missingIngredient || !isResolved));

    let reasonLabel = "";
    if(invalidUnit) reasonLabel = "Unité invalide pour cet ingrédient";
    else if(missingConversion) reasonLabel = "Conversion manquante pour cette unité";
    else if(missingIngredient) reasonLabel = "Ingrédient introuvable";
    else if(hasQty && !isResolved) reasonLabel = "Ligne non résolue";

    return {
      ing, qty, unit,
      allowedUnits,
      unitAllowed,
      gramsResolved,
      macrosResolved,
      hasQty,
      hasIngredient,
      invalidUnit,
      missingConversion,
      missingIngredient,
      isResolved,
      isUnresolved,
      reasonLabel
    };
  }

  // --- Editor controller ---
  const getIngCategoryItems = () => {
    try{
      if(window.IngredientCategoryDomain && typeof window.IngredientCategoryDomain.getIngredientCategories === "function"){
        return window.IngredientCategoryDomain.getIngredientCategories();
      }
    }catch(_e){}
    return Array.isArray(window.ING_CATEGORY_ITEMS) ? window.ING_CATEGORY_ITEMS : [];
  };
  const RecipeEditor = {
    get editId(){ return ($("recipeCreateOverlay")?.dataset?.editId || "") },
    set editId(v){
      const ov = $("recipeCreateOverlay");
      if(ov) ov.dataset.editId = String(v||"");
    },

    clear(){
      const tbody = $("cmRecipeBody"); if(tbody) tbody.innerHTML = "";
      ["recipeName","recipeTags","cmRecipePrep","recipePrepTime","recipePortions","poidsCuit"].forEach(id=>{
        const el = $(id); if(el) el.value = "";
      });
      this.editId = "";
      this.recalc();
      this.setStatus("Prêt.", "muted");
    },

    setStatus(msg, tone){
      const el = $("cmRecipeStatus");
      if(!el) return;
      el.textContent = msg || "";
      el.style.color = (tone==="ok") ? "var(--g900)" : (tone==="warn") ? "#7a4b12" : (tone==="err") ? "#7b1f19" : "var(--ink500)";
    },
    collect(){
      const r = {
        id: this.editId || "",
        name: $("recipeName")?.value || "",
        categoryId: $("recipeCategory")?.value || "autre",
        tags: $("recipeTags")?.value || "",
        parts: $("recipePortions")?.value || 0,
        cookedWeight: $("poidsCuit")?.value || 0,
        prepTime: $("recipePrepTime")?.value || "",
        prep: $("cmRecipePrep")?.value || "",
      };

      // preserve existing thumb when editing
      if(this.editId){
        const existing = getRecipes().find(x=>String(x.id)===String(this.editId));
        if(existing?.thumbDataUrl) r.thumbDataUrl = existing.thumbDataUrl;
      }

      const body = $("cmRecipeBody");
      const rows = [];
      if(body){
        const cards = [...body.querySelectorAll(".rRow")];
        const ings = getIngredients();
        cards.forEach(card=>{
          const qty = toNum(card.querySelector(".rQty")?.value);
          const categoryId = String(card.querySelector(".rCat")?.value || "");
          const ingEl = card.querySelector(".rIng");
          let ingredientId = String(card.dataset.ingId || "");
          let ingredientName = "";
          if(ingEl){
            const tag = String(ingEl.tagName||"").toUpperCase();
            if(tag === "SELECT"){
              ingredientId = String(ingEl.value || "");
              ingredientName = String(ingEl.selectedOptions?.[0]?.textContent || "").trim();
              if(ingredientName === "(choisir)") ingredientName = "";
            }else{
              ingredientName = String(ingEl.value || "").trim();
            }
          }
          const unit = String(card.querySelector(".rUnit")?.value || "g");
          if(!ingredientName && !ingredientId && !qty) return;

          const baseRow = { categoryId, ingredientId, ingredientName, qty, unit };
          const resolved = resolveRecipeRow(baseRow, ings);
          const persistedCategoryId = String(resolved.ing?.categoryId || categoryId || "");
          rows.push({
            ...baseRow,
            categoryId: persistedCategoryId,
            gramsResolved: resolved.gramsResolved,
            macrosResolved: { ...resolved.macrosResolved }
          });
        });
      }
      r.rows = rows;

      return normRecipe(r);
    },
    setLineOpen(card, shouldOpen, options={}){
      if(!card) return;
      const { collapseOthers=true } = options || {};
      if(shouldOpen && collapseOthers){
        const body = $("cmRecipeBody");
        if(body){
          [...body.querySelectorAll(".rRow")].forEach(other=>{
            if(other !== card) this.setLineOpen(other, false, { collapseOthers:false });
          });
        }
      }
      const panel = card.querySelector(".recipeLinePanel");
      const toggle = card.querySelector(".recipeLineAccordionToggle");
      const chevron = card.querySelector(".recipeLineChevron");
      card.dataset.expanded = shouldOpen ? "1" : "0";
      card.classList.toggle("is-open", !!shouldOpen);
      if(panel) panel.hidden = !shouldOpen;
      if(toggle) toggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
      if(chevron) chevron.textContent = shouldOpen ? "⌃" : "⌄";
    },
    toggleLine(card){
      if(!card) return;
      this.setLineOpen(card, !(card.dataset.expanded === "1"));
    },
    addRow(initial={}){
      const body = $("cmRecipeBody");
      if(!body) return;

      const card = document.createElement("article");
      card.className = "recipeLineCard rRow";
      card.dataset.resolveState = "idle";
      card.dataset.expanded = "0";

      const top = document.createElement("div");
      top.className = "recipeLineTop";

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "recipeLineAccordionToggle";
      toggle.setAttribute("aria-expanded", "false");

      const summaryMain = document.createElement("div");
      summaryMain.className = "recipeLineSummaryMain";

      const titleWrap = document.createElement("div");
      titleWrap.className = "recipeLineTitleWrap";
      const eyebrowRow = document.createElement("div");
      eyebrowRow.className = "recipeLineEyebrowRow";
      const eyebrow = document.createElement("div");
      eyebrow.className = "recipeLineEyebrow";
      eyebrow.textContent = "Ingrédient";
      const chevron = document.createElement("span");
      chevron.className = "recipeLineChevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = "⌄";
      eyebrowRow.append(eyebrow, chevron);
      const title = document.createElement("div");
      title.className = "recipeLineTitle";
      title.textContent = "Choisir un ingrédient";

      const summaryMeta = document.createElement("div");
      summaryMeta.className = "recipeLineSummaryMeta";
      const summaryQty = document.createElement("span");
      summaryQty.className = "recipeLineSummaryChip recipeLineSummaryChip--qty rSummaryQty";
      summaryQty.textContent = "Qté —";
      const summaryBase = document.createElement("span");
      summaryBase.className = "recipeLineSummaryChip recipeLineSummaryChip--base rSummaryBase";
      summaryBase.textContent = "Base —";
      const summaryBadge = document.createElement("span");
      summaryBadge.className = "recipeLineSummaryChip recipeLineSummaryChip--state is-idle rSummaryBadge";
      summaryBadge.textContent = "À compléter";
      summaryMeta.append(summaryQty, summaryBase, summaryBadge);

      titleWrap.append(eyebrowRow, title, summaryMeta);
      summaryMain.append(titleWrap);
      toggle.append(summaryMain);

      const btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.className = "recipeLineRemove";
      btnDel.setAttribute("aria-label", "Supprimer cet ingrédient");
      btnDel.title = "Supprimer";
      btnDel.textContent = "✕";
      top.append(toggle, btnDel);

      const panel = document.createElement("div");
      panel.className = "recipeLinePanel";
      panel.hidden = true;

      const fieldGrid = document.createElement("div");
      fieldGrid.className = "recipeLineInputGrid";

      const makeField = (labelText, fieldClass)=>{
        const label = document.createElement("label");
        label.className = `recipeLineField ${fieldClass || ""}`.trim();
        const cap = document.createElement("span");
        cap.className = "recipeLineFieldLabel";
        cap.textContent = labelText;
        label.appendChild(cap);
        return label;
      };

      const catField = makeField("Catégorie", "recipeLineField--category");
      const selCat = document.createElement("select");
      selCat.className = "rCat";
      const catItems = getIngCategoryItems().slice().sort((a,b)=>String(a.label||"").localeCompare(String(b.label||""), "fr"));
      selCat.innerHTML = `<option value="">(toutes)</option>` + catItems.map(c=>`<option value="${c.id}">${c.label}</option>`).join("");
      selCat.value = initial.categoryId || initial.cat || "";
      catField.appendChild(selCat);

      const ingField = makeField("Ingrédient", "recipeLineField--ingredient");
      const selIng = document.createElement("select");
      selIng.className = "rIng";
      ingField.appendChild(selIng);

      const qtyField = makeField("Quantité", "recipeLineField--qty");
      const inpQty = document.createElement("input");
      inpQty.className = "rQty";
      inpQty.type = "number";
      inpQty.min = "0";
      inpQty.step = "1";
      inpQty.inputMode = "decimal";
      inpQty.placeholder = "ex: 200";
      inpQty.value = (initial.qty ?? "");
      qtyField.appendChild(inpQty);

      const unitField = makeField("Unité", "recipeLineField--unit");
      const selUnit = document.createElement("select");
      selUnit.className = "rUnit";
      unitField.appendChild(selUnit);

      fieldGrid.append(catField, ingField, qtyField, unitField);

      const metrics = document.createElement("div");
      metrics.className = "recipeLineMetrics";
      const makeMetric = (labelText, valueClass, detail=false)=>{
        const box = document.createElement("div");
        box.className = `recipeLineMetric${detail ? ' recipeLineMetric--detail' : ''}`;
        const label = document.createElement("small");
        label.textContent = labelText;
        const val = document.createElement("b");
        val.className = valueClass;
        val.textContent = "—";
        box.append(label, val);
        return { box, val };
      };
      const mK = makeMetric("kcal/100", "rK");
      const mP = makeMetric("P/100", "rP");
      const mG = makeMetric("G/100", "rG");
      const mL = makeMetric("L/100", "rL");
      metrics.append(mK.box, mP.box, mG.box, mL.box);

      const allowedUnitsForIngredient = (ing)=>{
        const raw = Array.isArray(ing?.allowedUnits) ? ing.allowedUnits.map(x=>String(x||"").trim()).filter(Boolean) : [];
        const allowed = raw.length ? raw : ["g"];
        const VALID = ["g","piece","ml","tbsp","tsp"];
        const filtered = allowed.filter(u => VALID.includes(u));
        return filtered.length ? filtered : ["g"];
      };
      const fillUnitOptionsForIngredient = (ingredientId, forcedUnit)=>{
        selUnit.innerHTML = "";
        const ingId = String(ingredientId || selIng.value || "");
        const ings = getIngredients();
        const ing = ingId ? (ings.find(i=>String(i?.id)===ingId) || null) : null;
        const allowed = allowedUnitsForIngredient(ing);
        for(const u of allowed){
          const o = document.createElement("option");
          o.value = u;
          o.textContent = recipeUnitLabel(u);
          selUnit.appendChild(o);
        }
        const preferred = String(
          forcedUnit ||
          initial.unit ||
          ing?.defaultUnit ||
          allowed[0] ||
          "g"
        );
        const hasPreferred = [...selUnit.options].some(o=>o.value===preferred);
        delete selUnit.dataset.invalidLegacyUnit;
        if(hasPreferred){
          selUnit.value = preferred;
          unitField.title = allowed.length ? `Unités autorisées : ${allowed.map(recipeUnitLabel).join(", ")}` : "";
        }else{
          const legacy = document.createElement("option");
          legacy.value = preferred;
          legacy.textContent = `⚠ ${recipeUnitLabel(preferred)} (ancienne unité invalide)`;
          selUnit.appendChild(legacy);
          selUnit.value = preferred;
          selUnit.dataset.invalidLegacyUnit = "1";
          unitField.title = `Ancienne unité invalide conservée pour correction. Autorisées : ${allowed.map(recipeUnitLabel).join(", ")}`;
        }
      };

      const refreshLineMacros = ()=>{
        let ing = null;
        const ingId = String(selIng.value||"");
        const ings = getIngredients();
        if(ingId) ing = ings.find(i=>String(i?.id)===ingId) || null;
        const k100 = ing ? toNum(ing.kcal100 ?? ing.kcal ?? ing.kcalPer100) : 0;
        const p100 = ing ? toNum(ing.p100 ?? ing.prot100 ?? ing.protein100 ?? ing.P ?? ing.protein) : 0;
        const g100 = ing ? toNum(ing.g100 ?? ing.carb100 ?? ing.carbs100 ?? ing.G ?? ing.carbs) : 0;
        const l100 = ing ? toNum(ing.l100 ?? ing.fat100 ?? ing.L ?? ing.fat) : 0;
        mK.val.textContent = ing ? String(Math.round(k100)) : "—";
        mP.val.textContent = ing ? String(Math.round(p100*10)/10) : "—";
        mG.val.textContent = ing ? String(Math.round(g100*10)/10) : "—";
        mL.val.textContent = ing ? String(Math.round(l100*10)/10) : "—";
      };

      const refreshIngs = ()=>{
        const current = String(selIng.value||"");
        selIng.innerHTML = "";
        const opt0 = document.createElement("option");
        opt0.value = "";
        opt0.textContent = "(choisir)";
        selIng.appendChild(opt0);

        const catId = String(selCat.value||"");
        const ings = getIngredients()
          .filter(i => !catId || String(i.categoryId||"") === catId)
          .slice()
          .sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""), "fr"));
        for(const ing of ings){
          const o = document.createElement("option");
          o.value = String(ing.id||"");
          o.textContent = String(ing.name||"");
          selIng.appendChild(o);
        }
        if(current && [...selIng.options].some(o=>o.value===current)) selIng.value = current;
        else selIng.value = "";
        card.dataset.ingId = String(selIng.value||"");
        fillUnitOptionsForIngredient(selIng.value, selUnit.value || initial.unit || "g");
        refreshLineMacros();
      };

      refreshIngs();

      if(initial.ingredientId){
        selIng.value = String(initial.ingredientId||"");
      }else if(initial.ingredientName){
        const name = String(initial.ingredientName||"").trim().toLowerCase();
        const match = [...selIng.options].find(o=>String(o.textContent||"").trim().toLowerCase()===name);
        if(match) selIng.value = match.value;
      }
      card.dataset.ingId = String(selIng.value||"");
      fillUnitOptionsForIngredient(selIng.value, initial.unit || "g");
      refreshLineMacros();

      toggle.addEventListener("click", ()=>this.toggleLine(card));
      selCat.addEventListener("change", ()=>{
        refreshIngs();
        card.dataset.ingId = String(selIng.value||"");
        this.setLineOpen(card, true);
        this.recalc();
      });
      selIng.addEventListener("change", ()=>{
        card.dataset.ingId = String(selIng.value||"");
        fillUnitOptionsForIngredient(selIng.value, "");
        refreshLineMacros();
        this.setLineOpen(card, true);
        this.recalc();
      });
      selUnit.addEventListener("change", ()=>{
        this.setLineOpen(card, true);
        this.recalc();
      });
      inpQty.addEventListener("input", ()=>{
        this.setLineOpen(card, true);
        this.recalc();
      });
      btnDel.addEventListener("click", ()=>{
        const wasOpen = card.dataset.expanded === "1";
        const next = card.nextElementSibling || card.previousElementSibling;
        card.remove();
        if(wasOpen && next && next.classList?.contains("rRow")) this.setLineOpen(next, true);
        this.recalc();
        this.setStatus("Ligne supprimée.", "muted");
      });

      panel.append(fieldGrid, metrics);
      card.append(top, panel);
      body.appendChild(card);

      const shouldOpenInitially = !(initial.ingredientId || initial.ingredientName || initial.qty) || body.querySelectorAll(".rRow").length === 1;
      this.setLineOpen(card, shouldOpenInitially, { collapseOthers: !!shouldOpenInitially });
      this.recalc();
      this.setStatus("Ligne ajoutée.", "muted");
    },
    recalc(){
      const ings = getIngredients();
      const body = $("cmRecipeBody");
      const cards = body ? [...body.querySelectorAll(".rRow")] : [];

      let totalW = 0;
      let totalK = 0, totalP = 0, totalG = 0, totalL = 0;
      let unresolvedCount = 0;

      cards.forEach((card, idx)=>{
        const qty = toNum(card.querySelector(".rQty")?.value);
        const categoryId = String(card.querySelector(".rCat")?.value || "");
        const ingEl = card.querySelector(".rIng");
        let ingredientId = String(card.dataset.ingId || "");
        let ingredientName = "";
        if(ingEl){
          const tag = String(ingEl.tagName||"").toUpperCase();
          if(tag === "SELECT"){
            ingredientId = String(ingEl.value || "");
            ingredientName = String(ingEl.selectedOptions?.[0]?.textContent || "").trim();
            if(ingredientName === "(choisir)") ingredientName = "";
          }else{
            ingredientName = String(ingEl.value || "").trim();
          }
        }
        const unit = String(card.querySelector(".rUnit")?.value || "g");
        const baseRow = { categoryId, ingredientId, ingredientName, qty, unit };
        const resolved = resolveRecipeRow(baseRow, ings);

        const k100 = resolved.ing ? toNum(resolved.ing.kcal100 ?? resolved.ing.kcal ?? resolved.ing.kcalPer100) : 0;
        const p100 = resolved.ing ? toNum(resolved.ing.p100 ?? resolved.ing.prot100 ?? resolved.ing.protein100 ?? resolved.ing.P ?? resolved.ing.protein) : 0;
        const g100 = resolved.ing ? toNum(resolved.ing.g100 ?? resolved.ing.carb100 ?? resolved.ing.carbs100 ?? resolved.ing.G ?? resolved.ing.carbs) : 0;
        const l100 = resolved.ing ? toNum(resolved.ing.l100 ?? resolved.ing.fat100 ?? resolved.ing.L ?? resolved.ing.fat) : 0;

        const kEl = card.querySelector(".rK");
        const pEl = card.querySelector(".rP");
        const gEl = card.querySelector(".rG");
        const lEl = card.querySelector(".rL");
        if(kEl) kEl.textContent = resolved.ing ? String(Math.round(k100)) : "—";
        if(pEl) pEl.textContent = resolved.ing ? String(Math.round(p100*10)/10) : "—";
        if(gEl) gEl.textContent = resolved.ing ? String(Math.round(g100*10)/10) : "—";
        if(lEl) lEl.textContent = resolved.ing ? String(Math.round(l100*10)/10) : "—";

        card.dataset.gramsResolved = String(Math.round(resolved.gramsResolved*100)/100);
        card.dataset.unit = resolved.unit;
        card.dataset.resolveState = resolved.isUnresolved ? "unresolved" : (resolved.isResolved ? "resolved" : "idle");
        card.classList.toggle("is-unresolved", resolved.isUnresolved);
        card.classList.toggle("is-resolved", resolved.isResolved);

        const eye = card.querySelector(".recipeLineEyebrow");
        if(eye) eye.textContent = `Ingrédient ${idx + 1}`;

        const titleEl = card.querySelector(".recipeLineTitle");
        if(titleEl) titleEl.textContent = ingredientName || "Choisir un ingrédient";

        const summaryQtyEl = card.querySelector(".rSummaryQty");
        const summaryBaseEl = card.querySelector(".rSummaryBase");
        const summaryBadgeEl = card.querySelector(".rSummaryBadge");
        let stateText = "Choisis un ingrédient et une quantité.";
        let resolveText = "—";
        let badgeText = "À compléter";
        let badgeTone = "idle";
        if(resolved.qty && resolved.isResolved){
          stateText = `Base ${Math.round(k100)} kcal / 100 g`;
          resolveText = `≈ ${Math.round(resolved.gramsResolved*10)/10} g pris en compte`;
          badgeText = "OK";
          badgeTone = "ok";
        }else if(resolved.qty && resolved.isUnresolved){
          stateText = resolved.reasonLabel || "Ligne non résolue";
          resolveText = resolved.reasonLabel || "Conversion manquante";
          badgeText = "À corriger";
          badgeTone = "warn";
        }else if(resolved.ing){
          stateText = "Renseigne la quantité pour l’intégrer au total.";
          resolveText = "En attente de quantité";
          badgeText = "Qté";
          badgeTone = "idle";
        }
        if(summaryQtyEl) summaryQtyEl.textContent = resolved.qty ? `${Math.round(resolved.qty*10)/10} ${recipeUnitLabel(resolved.unit)}` : "Qté —";
        if(summaryBaseEl) summaryBaseEl.textContent = resolved.ing ? `${Math.round(k100)} kcal/100` : "Base —";
        if(summaryBadgeEl){
          summaryBadgeEl.textContent = badgeText;
          summaryBadgeEl.classList.remove("is-ok", "is-warn", "is-idle");
          summaryBadgeEl.classList.add(`is-${badgeTone}`);
        }
        card.title = resolved.isUnresolved ? [resolved.reasonLabel, resolveText].filter(Boolean).join(" · ") : resolveText;

        const unitField = card.querySelector(".recipeLineField--unit");
        if(unitField){
          if(resolved.invalidUnit){
            unitField.setAttribute("title", `Unité invalide pour cet ingrédient. Autorisées : ${resolved.allowedUnits.map(recipeUnitLabel).join(", ")}`);
          }else if(resolved.missingConversion){
            unitField.setAttribute("title", `Conversion manquante pour l'unité ${recipeUnitLabel(resolved.unit)}.`);
          }else{
            unitField.setAttribute("title", "");
          }
        }

        if(resolved.qty){
          if(resolved.isUnresolved) unresolvedCount += 1;
          totalW += resolved.gramsResolved;
          totalK += resolved.macrosResolved.kcal;
          totalP += resolved.macrosResolved.p;
          totalG += resolved.macrosResolved.c;
          totalL += resolved.macrosResolved.f;
        }
      });

      const p100K = totalW ? (totalK/totalW*100) : 0;
      const p100P = totalW ? (totalP/totalW*100) : 0;
      const p100G = totalW ? (totalG/totalW*100) : 0;
      const p100L = totalW ? (totalL/totalW*100) : 0;

      if($("totK")) $("totK").textContent = Math.round(totalK);
      if($("cmTotKcal")) $("cmTotKcal").textContent = Math.round(totalK);
      if($("cmTotP")) $("cmTotP").textContent = (Math.round(totalP*10)/10).toString();
      if($("cmTotG")) $("cmTotG").textContent = (Math.round(totalG*10)/10).toString();
      if($("cmTotL")) $("cmTotL").textContent = (Math.round(totalL*10)/10).toString();

      if($("p100K")) $("p100K").textContent = Math.round(p100K);
      if($("p100P")) $("p100P").textContent = (Math.round(p100P*10)/10).toString();
      if($("p100G")) $("p100G").textContent = (Math.round(p100G*10)/10).toString();
      if($("p100L")) $("p100L").textContent = (Math.round(p100L*10)/10).toString();

      if($("weightInfo")){
        const parts = toNum($("recipePortions")?.value) || 0;
        $("weightInfo").textContent = totalW
          ? `${Math.round(totalW)} g total${parts ? ` · ${parts} part${parts>1?'s':''}` : ""}`
          : "—";
      }

      const res = $("cmRecipeResults");
      if(res){
        if(cards.length) res.classList.remove("hidden");
        else res.classList.add("hidden");
      }

      const empty = $("cmRecipeEmpty");
      if(empty){
        empty.classList.toggle("hidden", cards.length > 0);
      }

      if(cards.length && !cards.some(card => card.dataset.expanded === "1")){
        const unresolvedCard = cards.find(card => card.dataset.resolveState === "unresolved");
        this.setLineOpen(unresolvedCard || cards[0], true, { collapseOthers:false });
      }

      if(unresolvedCount > 0){
        this.setStatus(`${unresolvedCount} ligne(s) non résolue(s) : conversion manquante ou unité invalide.`, "warn");
      }else if(cards.length === 0){
        this.setStatus("Prêt.", "muted");
      }else{
        this.setStatus("Totaux mis à jour automatiquement.", "muted");
      }
    },

    openById(id){
      const recipes = getRecipes();
      const r = recipes.find(x=>String(x.id)===String(id)) || null;
      if(!r){ alert("Recette introuvable."); return; }

      // open modal
      if(typeof window.openRecipeCreateModal === "function") window.openRecipeCreateModal();
      else $("btnOpenCreateRecipe")?.click();

      // set edit id
      this.editId = String(r.id);

      // fill fields
      if($("recipeName")) $("recipeName").value = r.name || "";
      if($("recipeTags")) $("recipeTags").value = r.tags || "";
      if($("cmRecipePrep")) $("cmRecipePrep").value = r.prep || "";
      if($("recipePrepTime")) $("recipePrepTime").value = r.prepTime || "";
      if($("recipePortions")) $("recipePortions").value = String(r.parts || 0);
      if($("poidsCuit")) $("poidsCuit").value = String(r.cookedWeight || 0);

      const catSel = $("recipeCategory");
      if(catSel){
        const target = String(r.categoryId || "autre");
        if([...catSel.options].some(o=>o.value===target)) catSel.value = target;
        else catSel.value = "autre";
        catSel.dispatchEvent(new Event("change", { bubbles:true }));
      }

      // rows
      const tbody = $("cmRecipeBody");
      if(tbody) tbody.innerHTML = "";
      (r.rows || []).forEach(row=>{
        this.addRow({
          categoryId: row.categoryId || "",
          ingredientId: row.ingredientId || "",
          ingredientName: row.ingredientName || "",
          qty: row.qty ?? "",
          unit: row.unit || "g"
        });
      });

      this.recalc();
      this.setStatus("Mode édition : modifie puis clique Enregistrer.", "muted");
    },

    save(){
      const r = this.collect();
      if(!r.name || r.name==="Recette"){
        // allow, but warn
        this.setStatus("Nom vide : la recette sera enregistrée comme “Recette”.", "warn");
      }

      const ings = getIngredients();
      const unresolvedCount = (r.rows || []).reduce((acc, row)=>{
        const resolved = resolveRecipeRow(row, ings);
        return acc + (resolved.isUnresolved ? 1 : 0);
      }, 0);

      if(unresolvedCount > 0){
        const ok = confirm(`${unresolvedCount} ligne(s) ne sont pas résolues (conversion manquante, unité invalide ou ingrédient introuvable).\n\nEnregistrer quand même ?`);
        if(!ok){
          this.setStatus("Enregistrement annulé : corrige d'abord les lignes non résolues.", "warn");
          return false;
        }
      }

      let recipes = getRecipes();

      if(this.editId){
        const idx = recipes.findIndex(x=>String(x.id)===String(this.editId));
        if(idx>=0){
          // preserve thumb if set previously
          if(recipes[idx]?.thumbDataUrl && !r.thumbDataUrl) r.thumbDataUrl = recipes[idx].thumbDataUrl;
          recipes[idx] = r;
        }else{
          recipes.unshift(r);
        }
      }else{
        recipes.unshift(r);
        this.editId = r.id;
      }

      setRecipes(recipes);

      if(unresolvedCount > 0) this.setStatus(`⚠️ Recette enregistrée avec ${unresolvedCount} ligne(s) non résolue(s).`, "warn");
      else this.setStatus("✅ Recette enregistrée.", "ok");

      try{
        if(typeof window.closeRecipeCreateModal === "function") window.closeRecipeCreateModal();
      }catch(_e){}
      return true;
    },

    duplicateById(id){
      const recipes = getRecipes();
      const r = recipes.find(x=>String(x.id)===String(id)) || null;
      if(!r){ alert("Recette introuvable."); return; }
      const copy = JSON.parse(JSON.stringify(r));
      copy.id = uid("r_");
      copy.name = (copy.name || "Recette") + " (copie)";
      recipes.unshift(normRecipe(copy));
      setRecipes(recipes);
    },

    deleteById(id){
      const recipes = getRecipes();
      const r = recipes.find(x=>String(x.id)===String(id)) || null;
      if(!r){ alert("Recette introuvable."); return; }
      const ok = confirm(`Supprimer la recette “${r.name || "Sans nom"}” ?`);
      if(!ok) return;
      const next = recipes.filter(x=>String(x.id)!==String(id));
      setRecipes(next);
    }
  };

  const RecipeEditorModal = {
    create(){
      RecipeEditor.clear();
      const ov = $("recipeCreateOverlay");
      if(typeof window.openRecipeCreateModal === "function") return window.openRecipeCreateModal();
      if(ov){
        ov.classList.remove("hidden");
        ov.setAttribute("aria-hidden", "false");
        try{ ov.inert = false; }catch(_e){}
      }
      setTimeout(()=>$("recipeName")?.focus(), 0);
    },
    edit(id){
      return RecipeEditor.openById(id);
    },
    save(){
      return RecipeEditor.save();
    },
    reset(){
      return RecipeEditor.clear();
    }
  };

  const existingApp = window.NutriApp || {};
  const existingUi = existingApp.ui || {};
  const recipesNsForApp = window.NutriRecipes || {};
  const recipesUi = recipesNsForApp.ui || {};
  const recipeListViewRef = recipesUi.recipeList || recipesUi.RecipeListView || existingUi.recipeList;
  const recipeScenarioRef = recipesUi.recipeScenario || recipesUi.RecipeReadonlyView || existingUi.recipeScenario;

  window.NutriApp = Object.assign({}, existingApp, {
    store: window.NutriStore,
    ui: Object.assign({}, existingUi, {
      recipeList: recipeListViewRef,
      recipeScenario: recipeScenarioRef,
      recipeEditor: RecipeEditorModal,
    }),
    actions: Object.assign({}, (existingApp && existingApp.actions) || {}, {
      openRecipeScenario: (id)=>{
        const app = window.NutriApp || {};
        const view = (app.ui && app.ui.recipeScenario) || recipeScenarioRef;
        if(view && typeof view.openById === "function") return view.openById(id);
        return undefined;
      },
      openRecipeEditor: (id)=>RecipeEditorModal.edit(id),
      duplicateRecipe: (id)=>RecipeEditor.duplicateById(id),
      deleteRecipe: (id)=>RecipeEditor.deleteById(id),
    })
  });

  const recipesNs = window.NutriRecipes = window.NutriRecipes || {};
  recipesNs.editor = Object.assign({}, recipesNs.editor || {}, {
    recipeFindIngredientByRow,
    recipeConvertQtyToGrams,
    recipeMacrosFromGrams,
    resolveRecipeRow
  });

  // expose
  window.RecipeEditor = RecipeEditor;
  window.RecipeEditorModal = RecipeEditorModal;
  window.resolveRecipeRow = resolveRecipeRow;
  window.recipeMacrosFromGrams = recipeMacrosFromGrams;
  window.recipeFindIngredientByRow = recipeFindIngredientByRow;
  window.recipeConvertQtyToGrams = recipeConvertQtyToGrams;

  // --- Wire buttons ---
  $("btnAddRow")?.addEventListener("click", ()=>RecipeEditor.addRow());
  $("btnClearRecipeRows")?.addEventListener("click", ()=>{
    const tbody = $("cmRecipeBody"); if(tbody) tbody.innerHTML="";
    RecipeEditor.recalc();
    RecipeEditor.setStatus("Lignes vidées.", "muted");
  });
  $("btnCalc")?.addEventListener("click", ()=>RecipeEditor.recalc());

  $("cmRecipeManualSave")?.addEventListener("click", ()=>RecipeEditor.save());
  $("cmRecipeManualCancel")?.addEventListener("click", ()=>{
    RecipeEditor.setStatus("", "muted");
  });

  // Ensure datalist exists early
  ensureIngredientDatalist();

})();
