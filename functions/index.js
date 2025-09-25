const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ 
  timeoutSeconds: 540,
  memory: "1GiB" 
});

exports.updateAllWeaponPrices = onSchedule("every 24 hours", async (event) => {
  try {
    const filePath = path.join(__dirname, 'all.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const allItemsObject = JSON.parse(fileContent);
    const allItems = Object.values(allItemsObject);
    
    console.log(`Successfully loaded ${allItems.length} total items from all.json.`);

    const weaponsToUpdate = allItems.filter(item => {
      const itemCategory = item.category?.name;
      const validCategories = ["Pistols", "SMGs", "Rifles", "Sniper Rifles", "Shotguns", "Machineguns", "Knives"];
      return validCategories.includes(itemCategory);
    });

    console.log(`Found ${weaponsToUpdate.length} valid skins to update. Starting slow scrape...`);

    for (const skin of weaponsToUpdate) {
      const skinName = skin.market_hash_name || skin.name;

      const skinData = {
        market_hash_name: skinName,
        price: null,
        icon_url: skin.image,
        tier: skin.rarity?.name || null,
        collection: skin.collections && skin.collections.length > 0 ? skin.collections[0].name : null,
        is_stattrak: skinName.includes('StatTrak™'),
        is_souvenir: skinName.includes('Souvenir')
      };
      
      try {
        const encodedName = encodeURIComponent(skinName);
        const priceOverviewUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodedName}`;
        
        const priceResponse = await axios.get(priceOverviewUrl);
        
        if (priceResponse.data && priceResponse.data.success) {
          skinData.price = parseFloat(priceResponse.data.lowest_price.replace('$', '').replace(' USD', ''));
        }
      } catch (error) {
        console.log(`Could not fetch price for ${skinName}. Saving with default price.`);
      }
      
      const docRef = db.collection("skins").doc(skinName);
      await docRef.set(skinData, { merge: true });
      
      await new Promise(resolve => setTimeout(resolve, 30000));
    }

    console.log("Finished slow scrape of all weapons.");
    return null;

  } catch (error) {
    console.error("Critical error during function execution:", error.message);
    return null;
  }
});