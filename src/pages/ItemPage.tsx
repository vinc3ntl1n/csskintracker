import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import ItemCard from "./ItemCard";

type AnySkin = {
  id?: string;
  name?: string;          
  market_hash_name?: string; 
  image?: string;
  image_url?: string;       
 
};

const ALL_JSON_URL = "/data/all.json"; 

function buildWeaponMatcher(weaponName: string) {
  const escaped = weaponName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `^(StatTrak™\\s+)?(★\\s+)?${escaped}(?:\\s*\\|\\s+.+)?$`,
    "i"
  );
  return re;
}

const ItemPage: React.FC = () => {
  const { name: encoded } = useParams<{ name: string }>();
  const weaponName = decodeURIComponent(encoded || "");

  const [allItems, setAllItems] = useState<AnySkin[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(ALL_JSON_URL, { cache: "force-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mounted) setAllItems(Array.isArray(data) ? data : Object.values(data));
      } catch (e: any) {
        if (mounted) setError(`Failed to load all.json: ${e.message}`);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!allItems || !weaponName) return [];
    const matcher = buildWeaponMatcher(weaponName);
    return allItems.filter((it) => {
      const label = (it.market_hash_name || it.name || "").trim();
      return matcher.test(label);
    });
  }, [allItems, weaponName]);

  if (error) return <div style={{padding: 24}}>{error}</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ textAlign: "center", marginBottom: 16 }}>{weaponName} Skins</h1>
      {!allItems && <div>Loading skins…</div>}

      {allItems && filtered.length === 0 && (
        <div>No skins found for “{weaponName}”.</div>
      )}

      <div className="grid">
        {filtered.map((item, i) => (
          <ItemCard
            key={(item.id ?? "") + i}
            item={{
              id: item.id ?? `${weaponName}-${i}`,
              name: item.name,
              market_hash_name: item.market_hash_name,
              image: item.image,
              image_url: item.image_url,
            }}
          />
        ))}
      </div>

      <style>{`
        .grid {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 20px;
          margin-top: 12px;
        }
        .item-card { width: 240px; }
        .item-image { max-height: 160px; object-fit: contain; }
      `}</style>
    </div>
  );
};

export default ItemPage;
