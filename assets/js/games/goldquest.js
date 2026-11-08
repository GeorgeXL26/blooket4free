/* Gold Quest — ten rounds of chest gambling against a rival, paid out in Blook Coins. */
(function () {
    const ROUNDS = 10;
    const START_RIVAL = 40;

    const OUTCOMES = [
        { id: "small", w: 34, min: 25, max: 60, cls: "good" },
        { id: "big", w: 16, min: 70, max: 120, cls: "good" },
        { id: "jackpot", w: 4, min: 200, max: 300, cls: "good" },
        { id: "steal", w: 10, min: 40, max: 90, cls: "good" },
        { id: "theft", w: 16, min: 30, max: 70, cls: "bad" },
        { id: "curse", w: 6, cls: "bad" },
        { id: "shield", w: 6, cls: "neutral" },
        { id: "nothing", w: 8, cls: "neutral" },
    ];

    const TOTAL_WEIGHT = OUTCOMES.reduce((sum, o) => sum + o.w, 0);

    const state = {
        round: 1,
        gold: 0,
        rival: START_RIVAL,
        shield: 0,
        over: false,
        busy: false,
    };

    const $ = (id) => document.getElementById(id);
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function rollOutcome() {
        let roll = Math.random() * TOTAL_WEIGHT;
        for (const outcome of OUTCOMES) {
            roll -= outcome.w;
            if (roll <= 0) return outcome;
        }
        return OUTCOMES[0];
    }

    function syncHud() {
        $("hudRound").textContent = `${state.round} / ${ROUNDS}`;
        $("hudGold").textContent = state.gold.toLocaleString();
        $("hudRival").textContent = state.rival.toLocaleString();
        $("hudShield").textContent = state.shield;
    }

    function log(message, delta) {
        const li = document.createElement("li");
        li.innerHTML = `<span>R${state.round}: ${message}</span><span class="r ${delta > 0 ? "good" : delta < 0 ? "bad" : ""}">${delta > 0 ? "+" : ""}${delta ? delta.toLocaleString() : ""}</span>`;
        const list = $("log");
        list.prepend(li);
        while (list.children.length > 7) list.lastChild.remove();
    }

    function setResult(html) {
        $("result").innerHTML = html;
    }

    async function openChest(index) {
        if (state.busy || state.over) return;
        state.busy = true;

        const chests = Array.from(document.querySelectorAll(".chest"));
        chests.forEach((chest, i) => {
            chest.disabled = true;
            chest.classList.toggle("chosen", i === index);
            chest.classList.toggle("dim", i !== index);
        });

        const outcome = rollOutcome();
        let message = "";
        let delta = 0;

        if (outcome.id === "small" || outcome.id === "big" || outcome.id === "jackpot") {
            const amount = randInt(outcome.min, outcome.max);
            state.gold += amount;
            delta = amount;
            const label = outcome.id === "jackpot" ? "JACKPOT!" : outcome.id === "big" ? "Big chest!" : "Gold chest!";
            message = `${label} +${amount.toLocaleString()} gold`;
            setResult(`<span class="good">${label}</span> +${amount.toLocaleString()} gold`);
        } else if (outcome.id === "steal") {
            const wanted = randInt(outcome.min, outcome.max);
            const amount = Math.min(state.rival, wanted);
            state.rival -= amount;
            state.gold += amount;
            delta = amount;
            message = amount > 0 ? `Heist! Stole ${amount.toLocaleString()} gold` : "Heist botched — rival is broke";
            setResult(amount > 0
                ? `<span class="good">HEIST!</span> You stole ${amount.toLocaleString()} gold from your rival`
                : `<span class="neutral">Heist!</span> …but your rival had nothing left`);
        } else if (outcome.id === "theft") {
            if (state.shield > 0) {
                state.shield -= 1;
                message = "Shield blocked a robbery";
                setResult(`<span class="neutral">🛡️ Shield up!</span> The robbery bounced right off`);
            } else {
                const amount = Math.min(state.gold, randInt(outcome.min, outcome.max));
                state.gold -= amount;
                state.rival += amount;
                delta = -amount;
                message = `Robbed! Lost ${amount.toLocaleString()} gold`;
                setResult(`<span class="bad">ROBBED!</span> Your rival pinched ${amount.toLocaleString()} gold`);
            }
        } else if (outcome.id === "curse") {
            if (state.shield > 0) {
                state.shield -= 1;
                message = "Shield blocked a curse";
                setResult(`<span class="neutral">🛡️ Shield up!</span> The curse fizzled out`);
            } else {
                const amount = Math.floor(state.gold * 0.25);
                state.gold -= amount;
                delta = -amount;
                message = `Cursed chest — lost ${amount.toLocaleString()} gold`;
                setResult(`<span class="bad">CURSED CHEST!</span> You lost 25% of your gold (${amount.toLocaleString()})`);
            }
        } else if (outcome.id === "shield") {
            state.shield = Math.min(2, state.shield + 1);
            message = "Picked up a shield";
            setResult(`<span class="neutral">🛡️ SHIELD!</span> Blocks the next robbery or curse`);
        } else {
            message = "Empty chest";
            setResult(`<span class="neutral">Empty chest…</span> Rude`);
        }

        log(message, delta);
        syncHud();

        await sleep(1250);

        state.busy = false;
        state.round += 1;
        state.rival += randInt(20, 60) + state.round * 2;
        syncHud();

        if (state.round > ROUNDS) {
            finish();
            return;
        }

        resetChests();
        $("prompt").textContent = `Round ${state.round} — pick a chest!`;
        $("questSub").textContent = "Your rival keeps digging. Pick wisely.";
        setResult("&nbsp;");
    }

    function resetChests() {
        document.querySelectorAll(".chest").forEach((chest) => {
            chest.disabled = false;
            chest.classList.remove("chosen", "dim");
        });
    }

    function saveBest(gold) {
        const key = "goldQuestBestGold";
        const best = parseInt(localStorage.getItem(key), 10) || 0;
        if (gold > best) localStorage.setItem(key, String(gold));
    }

    function finish() {
        state.over = true;
        const won = state.gold > state.rival;
        const coins = Math.floor(state.gold / 8) + (won ? 20 : 0);

        saveBest(state.gold);
        if (typeof addCoins === "function") addCoins(coins);

        $("overTitle").textContent = won ? "You Win the Quest!" : "Quest Complete";
        $("overGold").textContent = state.gold.toLocaleString();
        $("overRival").textContent = state.rival.toLocaleString();
        $("overRank").innerHTML = won
            ? '<span class="good">🏆 You out-earned your rival!</span>'
            : '<span class="bad">Your rival out-earned you…</span>';
        $("overCoins").textContent = coins.toLocaleString();
        $("overCard").classList.add("active");

        document.querySelectorAll(".chest").forEach((chest) => {
            chest.disabled = true;
        });
        $("prompt").textContent = "Quest over!";
        setResult(`<span class="${won ? "good" : "bad"}">${won ? "Victory!" : "Defeat"}</span> Final pile: ${state.gold.toLocaleString()} gold`);
    }

    function resetGame() {
        state.round = 1;
        state.gold = 0;
        state.rival = START_RIVAL;
        state.shield = 0;
        state.over = false;
        state.busy = false;

        $("overCard").classList.remove("active");
        $("log").innerHTML = "";
        $("prompt").textContent = "Round 1 — pick a chest!";
        $("questSub").textContent = "Chests can hold gold, shields… or your rival's grubby hands.";
        setResult("&nbsp;");
        resetChests();
        syncHud();
    }

    function init() {
        renderSidebar("games");

        document.querySelectorAll(".chest").forEach((chest) => {
            chest.addEventListener("click", () => openChest(Number(chest.dataset.i)));
        });

        $("againBtn").addEventListener("click", resetGame);

        document.addEventListener("keydown", (ev) => {
            if (["1", "2", "3"].includes(ev.key)) openChest(Number(ev.key) - 1);
        });

        resetGame();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
