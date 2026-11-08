/* Blooket4Free — tiny blook sprite registry + loader (CDN art with emoji fallback). */
const BLOOK_CDN = "https://ac.blooket.com/marketassets/blooks/";

const BLOOKS = {
    toast: { name: "Toast", emoji: "🍞" },
    cereal: { name: "Cereal", emoji: "🥣" },
    waffle: { name: "Waffle", emoji: "🧇" },
    pancakes: { name: "Pancakes", emoji: "🥞" },
    pizza: { name: "Pizza", emoji: "🍕" },
    milk: { name: "Milk", emoji: "🥛" },
    cheeseburger: { name: "Cheeseburger", emoji: "🍔" },
    buddybot: { name: "Buddy Bot", emoji: "🤖" },
    brainybot: { name: "Brainy Bot", emoji: "🧠" },
    angrybot: { name: "Angry Bot", emoji: "😠" },
    ant: { name: "Ant", emoji: "🐜" },
    bee: { name: "Bee", emoji: "🐝" },
    crow: { name: "Crow", emoji: "🐦" },
    crocodile: { name: "Crocodile", emoji: "🐊" },
    anaconda: { name: "Anaconda", emoji: "🐍" },
    alien: { name: "Alien", emoji: "👽" },
    blobfish: { name: "Blobfish", emoji: "🐡" },
    cat: { name: "Cat", emoji: "🐱" },
    astronaut: { name: "Astronaut", emoji: "🧑‍🚀" },
};

const _blookImages = {};

function blookUrl(id) {
    return BLOOK_CDN + id + ".svg";
}

function getBlookImage(id) {
    if (_blookImages[id]) return _blookImages[id];
    const img = new Image();
    img.decoding = "async";
    img.src = blookUrl(id);
    _blookImages[id] = img;
    return img;
}

function blookReady(id) {
    const img = _blookImages[id];
    return !!(img && img.complete && img.naturalWidth > 0);
}

function preloadBlooks(ids) {
    ids.forEach((id) => getBlookImage(id));
}

/* Draw a blook centred at (cx, cy); falls back to its emoji if art is unavailable. */
function drawBlook(ctx, id, cx, cy, size) {
    const img = getBlookImage(id);
    if (img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
        ctx.restore();
        return true;
    }
    const meta = BLOOKS[id];
    ctx.save();
    ctx.font = `${Math.round(size * 0.8)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(meta ? meta.emoji : "❓", cx, cy);
    ctx.restore();
    return false;
}

function blookImgError(imgEl) {
    const emoji = imgEl.dataset.emoji || "❓";
    const span = document.createElement("span");
    span.className = imgEl.className + " emojiArt";
    span.textContent = emoji;
    if (imgEl.style.width) span.style.fontSize = `calc(${imgEl.style.width} * 0.8)`;
    imgEl.replaceWith(span);
}

/* HTML helper for DOM sprites (cards, arena). */
function blookImg(id, size = 92, cls = "") {
    const meta = BLOOKS[id] || { name: id, emoji: "❓" };
    return `<img src="${blookUrl(id)}" alt="${meta.name}" class="${cls}" style="width:${size}px;height:${size}px"
        data-emoji="${meta.emoji}" onerror="blookImgError(this)">`;
}

/* Preload the art used by the current page so the first frame is not emoji. */
document.addEventListener("DOMContentLoaded", () => {
    preloadBlooks(Object.keys(BLOOKS));
});
