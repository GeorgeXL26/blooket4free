/* Monster Brawl — wave-based brawler that pays out Blook Coins per knockout. */
(function () {
    const MONSTERS = [
        { id: "angrybot", name: "Angry Bot", hp: 46, atk: [5, 9] },
        { id: "crocodile", name: "Crocodile", hp: 60, atk: [6, 10] },
        { id: "anaconda", name: "Anaconda", hp: 72, atk: [7, 11] },
        { id: "alien", name: "Alien", hp: 86, atk: [8, 13] },
        { id: "blobfish", name: "Blobfish", hp: 68, atk: [9, 12] },
    ];

    const BOSS = { id: "brainybot", name: "Brainy Bot", hp: 130, atk: [11, 16] };

    const PLAYER_MAX_HP = 100;
    const PLAYER_HEALS = 3;

    const state = {
        wave: 1,
        hp: PLAYER_MAX_HP,
        heals: PLAYER_HEALS,
        rage: 0,
        kills: 0,
        earned: 0,
        busy: false,
        over: false,
        monster: null,
    };

    const $ = (id) => document.getElementById(id);
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function setLog(html) {
        $("log").innerHTML = html;
    }

    function renderBars() {
        const hpPct = Math.max(0, (state.hp / PLAYER_MAX_HP) * 100);
        const hpBar = $("playerHpBar");
        hpBar.style.width = hpPct + "%";
        hpBar.classList.toggle("low", hpPct <= 30);
        $("playerHpText").innerText = `${Math.max(0, state.hp)} / ${PLAYER_MAX_HP}`;

        $("rageBar").style.width = state.rage + "%";
        $("rageText").innerText = `Rage ${state.rage}%`;

        const m = state.monster;
        if (m) {
            const mPct = Math.max(0, (m.hp / m.maxHp) * 100);
            $("monsterHpBar").style.width = mPct + "%";
            $("monsterHpText").innerText = `${Math.max(0, Math.round(m.hp))} / ${m.maxHp}`;
        }

        $("hudWave").innerText = state.wave;
        $("hudKills").innerText = state.kills;
        $("hudEarned").innerText = state.earned.toLocaleString();
        $("healCount").innerText = `(${state.heals})`;

        disableButtons();
    }

    function disableButtons() {
        document.querySelectorAll(".actions [data-action]").forEach((btn) => {
            const action = btn.dataset.action;
            let disabled = state.busy || state.over;
            if (action === "heal" && state.heals <= 0) disabled = true;
            if (action === "rage" && state.rage < 100) disabled = true;
            btn.disabled = disabled;
        });
    }

    function floatText(host, text, cls) {
        const span = document.createElement("span");
        span.className = "floatDmg " + (cls || "");
        span.textContent = text;
        host.appendChild(span);
        setTimeout(() => span.remove(), 760);
    }

    function shake(node) {
        node.classList.remove("shake");
        void node.offsetWidth;
        node.classList.add("shake");
    }

    function banner(text) {
        const el = $("waveBanner");
        el.textContent = text;
        el.classList.remove("show");
        void el.offsetWidth;
        el.classList.add("show");
    }

    function monsterForWave(wave) {
        const isBoss = wave % 5 === 0;
        const base = isBoss ? BOSS : MONSTERS[(wave - 1) % MONSTERS.length];
        const hpScale = 1 + 0.30 * (wave - 1);
        const atkScale = 1 + 0.10 * (wave - 1);

        const hp = Math.round(base.hp * hpScale * (isBoss ? 1.5 : 1));
        const atk = [
            Math.max(1, Math.round(base.atk[0] * atkScale * (isBoss ? 1.15 : 1))),
            Math.max(2, Math.round(base.atk[1] * atkScale * (isBoss ? 1.15 : 1))),
        ];

        return {
            id: base.id,
            name: isBoss ? `${base.name} (BOSS)` : base.name,
            hp,
            maxHp: hp,
            atk,
            boss: isBoss,
            reward: 12 + wave * 4 + (isBoss ? 25 : 0),
        };
    }

    function startWave(wave) {
        state.wave = wave;
        state.monster = monsterForWave(wave);

        const m = state.monster;
        $("monsterName").textContent = m.name;
        $("monsterSprite").innerHTML = blookImg(m.id, m.boss ? 140 : 126);
        $("monsterSprite").classList.toggle("boss", m.boss);

        banner(m.boss ? `WAVE ${wave} — BOSS!` : `WAVE ${wave}`);
        setLog(`<b>${m.name}</b> steps into the arena.`);
        renderBars();
    }

    function gainRage(n) {
        state.rage = Math.min(100, state.rage + n);
    }

    function awardCoins(amount) {
        state.earned += amount;
        if (typeof addCoins === "function") addCoins(amount);
    }

    async function knockOutMonster() {
        const m = state.monster;
        const reward = m.reward;

        state.kills += 1;
        awardCoins(reward);
        floatText($("monsterSprite"), `+${reward} 🪙`, "crit");
        setLog(`<span class="crit">${m.name} knocked out!</span> +${reward} Blook Coins.`);

        $("monsterSprite").style.opacity = "0.25";
        $("monsterSprite").style.transform = "rotate(18deg) scale(0.85)";

        const clearedWave = state.wave;
        saveBest(clearedWave);

        state.hp = Math.min(PLAYER_MAX_HP, state.hp + 30);
        state.heals = PLAYER_HEALS;
        gainRage(10);
        renderBars();

        await sleep(720);

        $("monsterSprite").style.opacity = "";
        $("monsterSprite").style.transform = "";
        startWave(clearedWave + 1);
    }

    async function monsterTurn() {
        const m = state.monster;
        if (!m || m.hp <= 0) return;

        await sleep(160);

        if (Math.random() < 0.12) {
            setLog("You sidestep the attack — <b>dodged!</b>");
            gainRage(6);
            renderBars();
            return;
        }

        const enraged = m.hp / m.maxHp < 0.3;
        let dmg = rand(m.atk[0], m.atk[1]);
        if (enraged) dmg = Math.round(dmg * 1.25);

        state.hp -= dmg;
        gainRage(12);

        floatText($("playerSprite"), `-${dmg}`, "hurt");
        shake($("playerSprite"));
        setLog(`${m.name} hits you for <span class="bad">${dmg}</span>${enraged ? " (enraged!)" : ""}.`);
        renderBars();

        if (state.hp <= 0) {
            state.hp = 0;
            renderBars();
            await sleep(420);
            endGame();
        }
    }

    async function act(action) {
        if (state.busy || state.over) return;
        const m = state.monster;
        if (!m || m.hp <= 0) return;

        if (action === "heal" && state.heals <= 0) return;
        if (action === "rage" && state.rage < 100) return;

        state.busy = true;
        renderBars();

        if (action === "attack") {
            const crit = Math.random() < 0.15;
            let dmg = rand(8, 14) + Math.floor(state.wave * 0.8);
            if (crit) dmg = Math.round(dmg * 1.8);
            m.hp -= dmg;
            gainRage(14);
            floatText($("monsterSprite"), crit ? `${dmg}!` : `${dmg}`, crit ? "crit" : "");
            shake($("monsterSprite"));
            setLog(crit ? `<span class="crit">CRITICAL HIT!</span> You strike for ${dmg}.` : `You strike for ${dmg}.`);
        } else if (action === "heavy") {
            if (Math.random() < 0.25) {
                setLog("<span class=\"bad\">Heavy Hit missed!</span> The monster laughs.");
            } else {
                const crit = Math.random() < 0.1;
                let dmg = rand(20, 32) + state.wave;
                if (crit) dmg = Math.round(dmg * 1.7);
                m.hp -= dmg;
                gainRage(18);
                floatText($("monsterSprite"), `${dmg}`, crit ? "crit" : "");
                shake($("monsterSprite"));
                setLog(crit ? `<span class="crit">HEAVY CRIT!</span> ${dmg} damage!` : `Heavy Hit lands for ${dmg}!`);
            }
        } else if (action === "heal") {
            state.heals -= 1;
            const healed = Math.min(28, PLAYER_MAX_HP - state.hp);
            state.hp += healed;
            gainRage(8);
            floatText($("playerSprite"), `+${healed}`, "heal");
            setLog(`You heal <span class="crit">${healed} HP</span> (${state.heals} heals left).`);
        } else if (action === "rage") {
            const dmg = 45 + state.wave * 3;
            m.hp -= dmg;
            state.rage = 0;
            floatText($("monsterSprite"), `${dmg}!!`, "crit");
            shake($("monsterSprite"));
            setLog(`<span class="crit">RAGE BURST!</span> ${dmg} damage!`);
        }

        renderBars();
        await sleep(280);

        if (m.hp <= 0) {
            await knockOutMonster();
            state.busy = false;
            renderBars();
            return;
        }

        await monsterTurn();
        state.busy = false;
        renderBars();

        if (state.over) return;
    }

    function saveBest(waves) {
        const key = "monsterBrawlBestWave";
        const best = parseInt(localStorage.getItem(key), 10) || 0;
        if (waves > best) localStorage.setItem(key, String(waves));
    }

    function endGame() {
        state.over = true;
        state.busy = false;
        const wavesSurvived = Math.max(0, state.wave - 1);
        saveBest(wavesSurvived);

        $("overWaves").textContent = wavesSurvived;
        $("overKills").textContent = state.kills;
        $("overCoins").textContent = state.earned.toLocaleString();
        $("overCard").classList.add("active");
        setLog("<span class=\"bad\">You were knocked out.</span> Play again to beat your best wave.");
        renderBars();
    }

    function resetGame() {
        state.wave = 1;
        state.hp = PLAYER_MAX_HP;
        state.heals = PLAYER_HEALS;
        state.rage = 0;
        state.kills = 0;
        state.earned = 0;
        state.busy = false;
        state.over = false;
        state.monster = null;

        $("overCard").classList.remove("active");
        $("monsterSprite").style.opacity = "";
        $("monsterSprite").style.transform = "";
        startWave(1);
    }

    function init() {
        renderSidebar("games");
        $("playerSprite").innerHTML = blookImg("astronaut", 128);

        document.querySelectorAll(".actions [data-action]").forEach((btn) => {
            btn.addEventListener("click", () => act(btn.dataset.action));
        });

        $("againBtn").addEventListener("click", resetGame);

        document.addEventListener("keydown", (e) => {
            const map = { 1: "attack", 2: "heavy", 3: "heal", 4: "rage" };
            if (map[e.key]) {
                e.preventDefault();
                act(map[e.key]);
            }
        });

        resetGame();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
