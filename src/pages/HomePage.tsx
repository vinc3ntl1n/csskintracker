import React from 'react';
import ItemCard from './ItemCard';
import base_weapons from '../data/base_weapons.json';
import WeaponScroller from '../components/WeaponPage';

const HomePage = () => {
    return (
        <div className="homepage-container">
            <WeaponScroller />
        </div>
    );
};

export default HomePage;