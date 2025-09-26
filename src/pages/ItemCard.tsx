import React from 'react';
import { Link } from 'react-router-dom';

interface Item {
    id: string;
    name?: string;
    image?: string;
    market_hash_name?: string;
    image_url?: string;
}

interface ItemCardProps {
    item: Item;
}

const ItemCard: React.FC<ItemCardProps> = ({ item }) => {
    const itemName = item.name || item.market_hash_name;
    const imageUrl = item.image || item.image_url;
    const encodedName = encodeURIComponent(itemName || '');

    return (
        <Link to={`/weapon/${encodedName}`}>
            <div className="item-card">
                <img src={imageUrl} alt={itemName} className="item-image" />
                <p className="item-name">{itemName}</p>
            </div>
        </Link>
    );
};

export default ItemCard;