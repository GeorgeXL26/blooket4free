const COINS_KEY = "blookCoins";
const COINS_EVENT = "blookcoins:changed";

const SELL_PRICES = {
    Common: 1,
    Uncommon: 5,
    Rare: 20,
    Epic: 75,
    Legendary: 200,
    Chroma: 500,
};

const KANTO_PACK_COST = 25;
const NORMAL_PACK_COST = 20;

function getCoins() {
    const raw = parseInt(localStorage.getItem(COINS_KEY), 10);
    return Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

function setCoins(n) {
    const clamped = Math.max(0, Math.floor(n) || 0);
    localStorage.setItem(COINS_KEY, String(clamped));
    window.dispatchEvent(new CustomEvent(COINS_EVENT, { detail: { coins: clamped } }));
    return clamped;
}

function addCoins(n) {
    return setCoins(getCoins() + n);
}

function spendCoins(n) {
    const current = getCoins();
    if (current < n) return false;
    setCoins(current - n);
    return true;
}

function getSellPrice(rarity) {
    return SELL_PRICES[rarity] ?? 1;
}

function getPackCost(pack, isFree) {
    if (isFree) return 0;
    if (pack && pack.id === "kanto") return KANTO_PACK_COST;
    return NORMAL_PACK_COST;
}

function onCoinsChanged(callback) {
    window.addEventListener(COINS_EVENT, (e) => callback(e.detail.coins));
    window.addEventListener("storage", (e) => {
        if (e.key === COINS_KEY) callback(getCoins());
    });
}
