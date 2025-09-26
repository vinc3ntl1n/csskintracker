const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ timeoutSeconds: 540, memory: "1GiB" });

/* -------------------- rate + pacing config (tweak here) -------------------- */
const SCHEDULE_EVERY = "every 10 minutes";   // how often the batch job runs
const REQUESTS_PER_MIN_CAP = 10;            // hard cap to stay friendly
const TARGET_BATCH_PER_RUN = 10;            // try to do this many per run
const MIN_SPACING_MS = 10_000;               // ≥10s between requests
const JITTER_MS = 400;                      // ± random jitter to avoid patterns
const MIN_REFRESH_MS = 24 * 60 * 60 * 1000; // 24h freshness window
const ERROR_COOLDOWN_MS = 20 * 60 * 1000;   // cool-off 20m after spikes
const ERROR_WINDOW_MAX = 8;                 // if ≥8 errors in a run, cool off

/* --------------------------------- helpers -------------------------------- */
function moneyToNumber(raw) {
  if (!raw) return null;
  let s = String(raw);

  // normalize weird spaces (NBSP, thin, narrow, etc.)
  s = s.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, "");
  // strip currency words/symbols, keep digits/sep
  s = s.replace(/[^\d.,-]/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // last separator is usually decimal
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // EU style (1.234,56) → remove thousands dots, comma → dot
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // US style (1,234.56) → remove thousands commas
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    // only comma → treat as decimal
    s = s.replace(",", ".");
  }
  // keep digits, one dot, optional leading minus
  s = s.replace(/[^0-9.-]/g, "");

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();

const VALID = new Set([
  "Pistols", "SMGs", "Rifles", "Sniper Rifles",
  "Shotguns", "Machineguns", "Knives",
]);

const stateRef = () => db.collection("meta").doc("price_update_state");
const allJsonPath = () => path.join(__dirname, "data", "all.json");

/* ------------------------------ scheduled job ----------------------------- */
exports.updateAllWeaponPrices = onSchedule(SCHEDULE_EVERY, async () => {
  try {
    // cool-off guard
    const stSnap = await stateRef().get();
    const st = stSnap.exists ? stSnap.data() : {};
    if (st.cooloff_until && now() < st.cooloff_until) {
      console.log(`Cool-off active until ${new Date(st.cooloff_until).toISOString()}. Skipping run.`);
      return null;
    }

    // load catalog
    const raw = fs.readFileSync(allJsonPath(), "utf8");
    const parsed = JSON.parse(raw);
    const allItems = Array.isArray(parsed) ? parsed : Object.values(parsed);

    // filter to weapon-like categories
    const weapons = allItems.filter((item) => {
      const cat = item?.category?.name || item?.category || "";
      return VALID.has(cat);
    });
    const total = weapons.length;

    // cursor
    let start = Number(st.index || 0);
    if (start < 0 || start >= total) start = 0;

    // batch size under cap
    const MAX_PER_RUN_BY_CAP = REQUESTS_PER_MIN_CAP * 5; // 5 minutes window
    const BATCH_SIZE = Math.min(TARGET_BATCH_PER_RUN, MAX_PER_RUN_BY_CAP);

    // pick stale items (≥ 24h) starting at cursor
    const picked = [];
    for (let i = 0; i < total && picked.length < BATCH_SIZE; i++) {
      const idx = (start + i) % total;
      const skin = weapons[idx];
      const skinName = skin?.market_hash_name || skin?.name;
      if (!skinName) continue;

      const doc = await db.collection("skins").doc(skinName).get();
      const last = doc.exists ? (doc.data().updated_at?.toMillis?.() || 0) : 0;
      if (now() - last >= MIN_REFRESH_MS) {
        picked.push({ idx, skin, skinName });
      }
    }

    // if all fresh, still pick a few to keep cursor moving
    if (picked.length === 0) {
      for (let i = 0; i < Math.min(BATCH_SIZE, total); i++) {
        const idx = (start + i) % total;
        const skin = weapons[idx];
        const skinName = skin?.market_hash_name || skin?.name;
        if (skinName) picked.push({ idx, skin, skinName });
      }
    }

    if (picked.length === 0) {
      console.log("Nothing to update this run.");
      await stateRef().set({ index: (start + 1) % total }, { merge: true });
      return null;
    }

    console.log(`Updating ${picked.length} skins. Cursor ${start}/${total}`);

    // process with spacing/jitter + error tracking
    let errors = 0;
    for (const { idx, skin, skinName } of picked) {
      try {
        const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(skinName)}`;
        const t0 = Date.now();
        const resp = await axios.get(url, { timeout: 15_000 });
        const elapsed = Date.now() - t0;

        let price = null;
        if (resp?.data?.success) price = moneyToNumber(resp.data.lowest_price);
        const price_cents = price != null ? Math.round(price * 100) : null;

        await db.collection("skins").doc(skinName).set({
          market_hash_name: skinName,
          price,
          price_cents,
          icon_url: skin.image || skin.image_url || null,
          tier: skin.rarity?.name || null,
          collection:
            skin.collections && skin.collections.length > 0
              ? skin.collections[0].name
              : null,
          is_stattrak: /\bStatTrak™\b/.test(skinName),
          is_souvenir: /\bSouvenir\b/.test(skinName),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
          last_latency_ms: elapsed,
        }, { merge: true });

      } catch (e) {
        errors++;
        console.log(`Fetch failed for ${skinName}: ${e?.message || e}`);
      }

      const jitter = Math.floor(Math.random() * (JITTER_MS * 2)) - JITTER_MS; // ±JITTER_MS
      const wait = Math.max(MIN_SPACING_MS + jitter, 0);
      await sleep(wait);
    }

    const lastIdx = picked[picked.length - 1].idx;
    const next = (lastIdx + 1) % total;

    const updates = { index: next, total, last_run: now(), last_errors: errors };
    if (errors >= ERROR_WINDOW_MAX) {
      updates.cooloff_until = now() + ERROR_COOLDOWN_MS;
      console.warn(`Error spike (${errors}). Cooling off for ${ERROR_COOLDOWN_MS / 60000}m.`);
    }
    await stateRef().set(updates, { merge: true });

    console.log(`Run done. Next cursor: ${next}/${total}. Errors: ${errors}`);
    return null;
  } catch (e) {
    console.error("updateAllWeaponPrices fatal:", e);
    return null;
  }
});

/* -------------------------- one-off fixer endpoint ------------------------ *
 * Manually refresh a single item by exact market_hash_name or name.
 * Example:
 *   /fixOnePrice?name=%E2%98%85%20Specialist%20Gloves%20%7C%20Marble%20Fade%20(Factory%20New)
 */
exports.fixOnePrice = onRequest({ cors: true }, async (req, res) => {
  try {
    const name = String(req.query.name || "").trim();
    if (!name || name.length > 128) {
      return res.status(400).json({ error: "Missing or invalid ?name" });
    }

    const raw = fs.readFileSync(allJsonPath(), "utf8");
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : Object.values(parsed);
    const skin = items.find((it) => (it.market_hash_name || it.name) === name);
    if (!skin) return res.status(404).json({ error: "Not found in all.json" });

    // fetch price once
    let price = null;
    try {
      const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(name)}`;
      const r = await axios.get(url, { timeout: 15_000 });
      if (r?.data?.success) price = moneyToNumber(r.data.lowest_price);
    } catch (e) {
      // ignore; still write doc with null price
    }
    const price_cents = price != null ? Math.round(price * 100) : null;

    await db.collection("skins").doc(name).set({
      market_hash_name: name,
      price,
      price_cents,
      icon_url: skin.image || skin.image_url || null,
      tier: skin.rarity?.name || null,
      collection: skin.collections?.[0]?.name || null,
      is_stattrak: /\bStatTrak™\b/.test(name),
      is_souvenir: /\bSouvenir\b/.test(name),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ ok: true, name, price });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

/* --------------------------- optional read endpoint ----------------------- *
 * Returns the subset of items from all.json for a given weapon name.
 * Example: /getSkinsByWeapon?name=Bayonet
 */
function buildWeaponMatcher(weaponName) {
  const escaped = weaponName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^(StatTrak™\\s+)?(★\\s+)?${escaped}(?:\\s*\\|\\s+.+)?$`, "i");
}

exports.getSkinsByWeapon = onRequest({ cors: true }, (req, res) => {
  try {
    const nameParam = String(req.query.name || "").trim();
    if (!nameParam || nameParam.length > 64) {
      return res.status(400).json({ error: "Missing or invalid ?name" });
    }

    const raw = fs.readFileSync(allJsonPath(), "utf8");
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : Object.values(parsed);

    const re = buildWeaponMatcher(nameParam);
    const filtered = items.filter((it) =>
      re.test(String(it.market_hash_name || it.name || "").trim())
    );
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: e?.message || "Failed to load all.json" });
  }
});
