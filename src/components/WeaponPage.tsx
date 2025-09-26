import React, { useMemo } from "react";
import baseWeapons from "../data/base_weapons.json";
import ItemCard from "../pages/ItemCard";
import Header from "./Header";

interface WeaponItem {
  id: string;
  name?: string;
  image?: string;
  description?: string | null;
}

const WeaponGrid: React.FC = () => {
  const { knives, gloves, guns } = useMemo(() => {
    const arr = baseWeapons as WeaponItem[];

    const knives = arr
      .filter((w) => w.id.toLowerCase().includes("knife"))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const gloves = arr
      .filter((w) => w.id.toLowerCase().includes("glove"))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const guns = arr
      .filter(
        (w) =>
          !w.id.toLowerCase().includes("knife") &&
          !w.id.toLowerCase().includes("glove")
      )
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    return { knives, gloves, guns };
  }, []);

  const renderSection = (title: string, items: WeaponItem[]) => (
    <div className="weapon-section">
      <h2 className="section-title">{title}</h2>
      <div className="weapon-grid">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="weapon-page">
      <Header />
      {renderSection("Knives", knives)}
      {renderSection("Gloves", gloves)}
      {renderSection("Guns", guns)}

      <style>{`
        .weapon-page {
          padding: 24px;
        }
        .section-title {
          font-size: 1.75rem;
          font-weight: 700;
          margin: 40px 0 20px;
          text-align: center;
          border-bottom: 2px solid #ccc;
          padding-bottom: 6px;
        }
        .weapon-grid {
          display: flex;
          flex-wrap: wrap;
          justify-content: center; /* <-- centers 1 or many cards */
          gap: 20px;
        }
        .item-card {
          width: 240px; /* fixed card width */
          border: 1px solid #ddd;
          border-radius: 12px;
          padding: 16px;
          background: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          text-align: center;
        }
        .item-image {
          max-width: 100%;
          max-height: 160px;
          object-fit: contain;
          margin-bottom: 12px;
        }
        .item-name {
          font-size: 1rem;
          font-weight: 600;
          color: #333;
        }
      `}</style>
    </div>
  );
};

export default WeaponGrid;
