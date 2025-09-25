const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const axios = require("axios");

const allItems = require("./all.json");

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ 
  timeoutSeconds: 540,
  memory: "1GiB" 
});

exports.updateAllWeaponPrices = onSchedule("every 24 hours", async (event) => {
  try {
    console.log(`Loaded ${allItems.length} total items from all.json.`);

    const weaponsToUpdate = allItems.filter(item => {
      const isGun = item.type === "Weapon";
      const isKnife = item.type === "Knife";
      const isGlove = item.type === "Gloves";
      return isGun || isKnife || isGlove;
    });

    console.log(`Found ${weaponsToUpdate.length} weapons to update. Starting slow scrape...`);

    for (const skin of weaponsToUpdate) {
      const skinName = skin.name;

      const skinData = {
        market_hash_name: skin.name,
        price: null,
        icon_url: skin.image,
        tier: skin.rarity,
        collection: skin.collection ? skin.collection.name : null
      };

      try {
        const encodedName = encodeURIComponent(skinName);
        const priceOverviewUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodedName}`;
        
        const priceResponse = await axios.get(priceOverviewUrl);
        
        if (priceResponse.data && priceResponse.data.success) {
          skinData.price = parseFloat(priceResponse.data.lowest_price.replace('$', '').replace(' USD', ''));
        }
      } catch (error) {
        console.log(`Could not fetch price for ${skinName}. It will be saved as N/A.`);
      }

      const docRef = db.collection("skins").doc(skinName);
      await docRef.set(skinData, { merge: true });

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log("Finished slow scrape of all weapons.");
    return null;

  } catch (error) {
    console.error("Could not load or process all.json file.", error.message);
    return null;
  }
});