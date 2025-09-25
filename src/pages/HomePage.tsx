import React from 'react';
import ItemCard from './ItemCard';
import base_weapons from '../data/base_weapons.json';

const HomePage = () => {
    return (
        <div className="homepage-container">
            <h1>Base Weapons</h1>
            <div className="item-grid">
                {base_weapons.map((weapon) => (
                    <ItemCard key={weapon.id} item={weapon} />
                ))}
            </div>
        </div>
    );
};

export default HomePage;