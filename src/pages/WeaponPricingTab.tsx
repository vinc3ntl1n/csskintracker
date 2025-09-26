import React, { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

/* --------------------------- Types --------------------------- */

type CatalogItem = {
  id?: string;
  name?: string;
  market_hash_name?: string;
  image?: string;
  image_url?: string;
};

type SkinDoc = {
  market_hash_name: string;
  name?: string;                    // <-- added so TS is happy if we see 'name'
  price?: number | null;
  price_cents?: number | null;
  icon_url?: string | null;
  tier?: string | null;
  collection?: string | null;
  is_stattrak?: boolean;
  is_souvenir?: boolean;
  updated_at?: any;
};

type VariantKey = "regular" | "stattrak" | "souvenir";
type WearKey =
  | "Factory New"
  | "Minimal Wear"
  | "Field-Tested"
  | "Well-Worn"
  | "Battle-Scarred";


const WEARS: WearKey[] = [
  "Factory New",
  "Minimal Wear",
  "Field-Tested",
  "Well-Worn",
  "Battle-Scarred",
];

const FN_URL =
  "https://us-central1-csskins-73bf6.cloudfunctions.net/getSkinsByWeapon"; 
function formatPrice(p?: number | null, pc?: number | null) {
  if (pc != null) return `$${(pc / 100).toFixed(2)}`;
  if (p != null) return `$${p.toFixed(2)}`;
  return "—";
}

function parseFamilyAndWear(display: string): { family: string; wear?: WearKey } {
  const trimmed = display.trim();
  const wearMatch =
    trimmed.match(
      /\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)/i
    ) || null;

  const wear = wearMatch ? (wearMatch[1] as WearKey) : undefined;
  const family = wearMatch
    ? trimmed.replace(wearMatch[0], "").trim()
    : trimmed;

  return { family: family.replace(/\s+\|\s+.*$/, "").trim() || family, wear };
}

function parseMarketHashName(mhn: string) {
  const isSt = /\bStatTrak™\b/i.test(mhn);
  const isSouvenir = /\bSouvenir\b/i.test(mhn);

  let s = mhn.replace(/^StatTrak™\s+/i, "").replace(/^Souvenir\s+/i, "").trim();
  s = s.replace(/^★\s+/, ""); 

  const parts = s.split("|");
  const weapon = parts[0]?.trim() || "";
  const rhs = (parts[1] || "").trim(); 
  const { family, wear } = parseFamilyAndWear(rhs);

  const variant: VariantKey = isSouvenir ? "souvenir" : isSt ? "stattrak" : "regular";
  return { weapon, display: rhs, family, wear, variant };
}

function buildGrouping(items: SkinDoc[]) {
  const group = new Map<string, Map<WearKey, Map<VariantKey, SkinDoc>>>();

  for (const it of items) {
    const name = (it.market_hash_name || it.name || "").trim();
    if (!name) continue;

    const { family, wear, variant } = parseMarketHashName(name);
    if (!family) continue;

    const wKey = (wear ?? "Minimal Wear") as WearKey; 

    if (!group.has(family)) group.set(family, new Map());
    const wearMap = group.get(family)!;

    if (!wearMap.has(wKey)) wearMap.set(wKey, new Map());
    const varMap = wearMap.get(wKey)!;

    const vKey: VariantKey = it.is_souvenir
      ? "souvenir"
      : it.is_stattrak
      ? "stattrak"
      : "regular";

    varMap.set(vKey, it);
  }
  return group;
}

async function fetchCatalogForWeapon(weaponName: string): Promise<CatalogItem[]> {
  const res = await fetch(
    `${FN_URL}?name=${encodeURIComponent(weaponName)}`,
    { cache: "force-cache" }
  );
  if (!res.ok) throw new Error(`getSkinsByWeapon failed: ${res.status}`);
  return (await res.json()) as CatalogItem[];
}

async function fetchSkinDocs(names: string[]): Promise<SkinDoc[]> {
  const SIZE = 20;
  const chunks: string[][] = [];
  for (let i = 0; i < names.length; i += SIZE) chunks.push(names.slice(i, i + SIZE));

  const out: SkinDoc[] = [];
  for (const ch of chunks) {
    const docs = await Promise.all(
      ch.map(async (mhn) => {
        try {
          const snap = await getDoc(doc(db, "skins", mhn));
          if (snap.exists()) return snap.data() as SkinDoc;
        } catch {}
        return { market_hash_name: mhn } as SkinDoc;
      })
    );
    out.push(...docs);
  }
  return out;
}

function familySort(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function titleFor(weaponName: string) {
  return `${weaponName} Skins & Prices`;
}


const WeaponPricingTabs: React.FC<{ weaponName: string }> = ({ weaponName }) => {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [families, setFamilies] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [grouped, setGrouped] =
    useState<Map<string, Map<WearKey, Map<VariantKey, SkinDoc>>>>(new Map());

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const catalog = await fetchCatalogForWeapon(weaponName);
        const names = catalog
          .map((c) => (c.market_hash_name || c.name || "").trim())
          .filter(Boolean);

        const docs = await fetchSkinDocs(names);

        const g = buildGrouping(docs);
        if (cancel) return;

        const fams = Array.from(g.keys()).sort(familySort);
        setFamilies(fams);
        setActive(fams[0] ?? null);
        setGrouped(g);
      } catch (e: any) {
        setErr(e.message || String(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [weaponName]);

  const activeWearMap = useMemo(
    () => (active ? grouped.get(active) : undefined),
    [grouped, active]
  );

  return (
    <div className="wp-container">
      <h1 className="wp-title">{titleFor(weaponName)}</h1>

      <div className="wp-tabs" role="tablist" aria-label={`${weaponName} skins`}>
        {families.map((fam) => (
          <button
            key={fam}
            role="tab"
            aria-selected={active === fam}
            className={`wp-tab ${active === fam ? "active" : ""}`}
            onClick={() => setActive(fam)}
          >
            {fam}
          </button>
        ))}
      </div>

      {loading && <div className="wp-status">Loading…</div>}
      {err && <div className="wp-error">Error: {err}</div>}

      {!loading && !err && active && activeWearMap && (
        <div className="wp-matrix">
          <table className="wp-table">
            <thead>
              <tr>
                <th>Wear</th>
                <th>Regular</th>
                <th>StatTrak™</th>
                <th>Souvenir</th>
              </tr>
            </thead>
            <tbody>
              {WEARS.map((wear) => {
                const varMap = activeWearMap.get(wear);
                const reg = varMap?.get("regular");
                const st = varMap?.get("stattrak");
                const sou = varMap?.get("souvenir");
                return (
                  <tr key={wear}>
                    <td className="wear">{wear}</td>
                    <td>{formatPrice(reg?.price, reg?.price_cents)}</td>
                    <td>{formatPrice(st?.price, st?.price_cents)}</td>
                    <td>{formatPrice(sou?.price, sou?.price_cents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="wp-note">
            Prices come from your Firestore and update continuously in the background.
          </div>
        </div>
      )}

      <style>{`
        .wp-container { max-width: 1100px; margin: 24px auto; padding: 0 16px; }
        .wp-title { text-align: center; font-weight: 800; margin-bottom: 16px; }

        .wp-tabs {
          display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
          margin: 8px auto 16px auto;
        }
        .wp-tab {
          border: 1px solid #ddd; background: #fff; padding: 8px 12px; border-radius: 999px;
          cursor: pointer; font-weight: 700;
        }
        .wp-tab.active { background: #1f2030; color: #fff; border-color: #1f2030; }

        .wp-status, .wp-error { text-align: center; margin-top: 12px; }
        .wp-error { color: #c0392b; }

        .wp-matrix { overflow-x: auto; }
        .wp-table { width: 100%; border-collapse: collapse; }
        .wp-table th, .wp-table td {
          border: 1px solid #e5e5e5; padding: 10px; text-align: center;
        }
        .wp-table th { background: #fafafa; font-weight: 800; }
        .wp-table td.wear { font-weight: 700; text-align: left; }
        .wp-note { margin-top: 8px; color: #666; font-size: 0.9rem; text-align: center; }
      `}</style>
    </div>
  );
};

export default WeaponPricingTabs;
