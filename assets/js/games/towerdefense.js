/* Tower Defense 2 — place blook towers, survive the waves, cash out Blook Coins. */
(function () {
    const canvas = document.getElementById("td");
    const ctx = canvas.getContext("2d");

    const CELL = 48;
    const COLS = 20;
    const ROWS = 12;
    const W = COLS * CELL;
    const H = ROWS * CELL;

    const PATH_CELLS = [
        [-1, 3], [4, 3], [4, 9], [9, 9], [9, 2], [14, 2], [14, 8], [19, 8],
    ];
    const WAYPOINTS = PATH_CELLS.map(([x, y]) => ({ x: (x + 0.5) * CELL, y: (y + 0.5) * CELL }));
    const PORTAL = WAYPOINTS[WAYPOINTS.length - 1];

    const pathSet = new Set();
    for (let i = 0; i < PATH_CELLS.length - 1; i++) {
        const [x1, y1] = PATH_CELLS[i];
        const [x2, y2] = PATH_CELLS[i + 1];
        const sx = Math.sign(x2 - x1);
        const sy = Math.sign(y2 - y1);
        let x = x1;
        let y = y1;
        pathSet.add(`${x},${y}`);
        while (x !== x2 || y !== y2) {
            x += sx;
            y += sy;
            pathSet.add(`${x},${y}`);
        }
    }

    const TOWER_TYPES = {
        toast: {
            key: "toast",
            sprite: "toast",
            name: "Toast Turret",
            blurb: "Fast single-target shots",
            cost: 40,
            dmg: 9,
            range: 132,
            fire: 0.55,
            splash: 0,
            slow: null,
            color: "#f5c542",
        },
        frost: {
            key: "frost",
            sprite: "bluebutterfly",
            name: "Frost Flutter",
            blurb: "Chills enemies to a crawl",
            cost: 60,
            dmg: 5,
            range: 122,
            fire: 0.85,
            splash: 0,
            slow: { factor: 0.42, dur: 1.5 },
            color: "#4db8ff",
        },
        cannon: {
            key: "cannon",
            sprite: "cheeseburger",
            name: "Burger Cannon",
            blurb: "Slow splash damage",
            cost: 80,
            dmg: 18,
            range: 140,
            fire: 1.3,
            splash: 48,
            slow: null,
            color: "#e67e22",
        },
    };

    const ENEMY_TYPES = {
        ant: { sprite: "ant", name: "Ant", hp: 24, speed: 54, bounty: 6, size: 32, leak: 1 },
        bee: { sprite: "bee", name: "Bee", hp: 18, speed: 84, bounty: 6, size: 28, leak: 1 },
        crow: { sprite: "crow", name: "Crow", hp: 52, speed: 50, bounty: 9, size: 36, leak: 1 },
        alien: { sprite: "alien", name: "Alien", hp: 86, speed: 56, bounty: 12, size: 40, leak: 1 },
        crocodile: { sprite: "crocodile", name: "Croc", hp: 190, speed: 34, bounty: 22, size: 50, leak: 3 },
    };

    const TOTAL_WAVES = 20;

    const state = {
        gold: 150,
        lives: 20,
        wave: 0,
        kills: 0,
        wavesCleared: 0,
        waveActive: false,
        over: false,
        won: false,
        paused: false,
        speed: 1,
        enemies: [],
        towers: [],
        projectiles: [],
        particles: [],
        floats: [],
        spawnQueue: [],
        spawnTimer: 0,
        selectedShop: null,
        selectedTower: null,
        hover: null,
        paid: false,
    };

    const $ = (id) => document.getElementById(id);
    const rand = (a, b) => a + Math.random() * (b - a);

    /* ---------- helpers ---------- */
    function key(cx, cy) {
        return `${cx},${cy}`;
    }

    function isPath(cx, cy) {
        return pathSet.has(key(cx, cy));
    }

    function towerAt(cx, cy) {
        return state.towers.find((t) => t.cx === cx && t.cy === cy) || null;
    }

    function isBuildable(cx, cy) {
        if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return false;
        if (isPath(cx, cy)) return false;
        return !towerAt(cx, cy);
    }

    function projection() {
        return Math.floor(state.wavesCleared * 6 + state.kills * 0.5);
    }

    function upgradeCost(t) {
        return Math.round(TOWER_TYPES[t.type].cost * 0.8 * t.level);
    }

    function sellValue(t) {
        return Math.floor(t.invested * 0.6);
    }

    /* ---------- UI ---------- */
    function syncHud() {
        $("stGold").textContent = Math.floor(state.gold);
        $("stLives").textContent = state.lives;
        $("stLives").classList.toggle("danger", state.lives <= 5);
        $("stWave").textContent = `${state.wave}`;
        $("stCoins").textContent = projection();

        document.querySelectorAll(".shopItem").forEach((btn) => {
            const type = TOWER_TYPES[btn.dataset.tower];
            btn.classList.toggle("poor", state.gold < type.cost);
            btn.classList.toggle("active", state.selectedShop === btn.dataset.tower);
        });

        const startBtn = $("startWaveBtn");
        startBtn.disabled = state.waveActive || state.over || state.wave >= TOTAL_WAVES;
        startBtn.textContent = state.waveActive ? "Wave in progress" : "Start Wave";
        $("pauseBtn").textContent = state.paused ? "Resume" : "Pause";
        $("speedBtn").textContent = `${state.speed}×`;
    }

    function renderTowerInfo() {
        const box = $("towerInfo");
        const t = state.selectedTower;

        if (!t) {
            box.innerHTML = "Pick a tower, then click the grass to build.";
            return;
        }

        const type = TOWER_TYPES[t.type];
        const maxed = t.level >= 3;
        const cost = upgradeCost(t);
        const canUpgrade = !maxed && state.gold >= cost;

        box.innerHTML = `
            <span class="tName">${type.name} · Lv ${t.level}</span>
            Damage ${Math.round(t.dmg)} · Range ${Math.round(t.range)} · ${t.fire.toFixed(2)}s cooldown
            <div class="acts">
                ${maxed
                ? '<button class="gb gb--ghost" disabled>Max level</button>'
                : `<button class="gb gb--gold" data-act="upgrade" ${canUpgrade ? "" : "disabled"}>Upgrade · ${cost}🪙</button>`}
                <button class="gb gb--red" data-act="sell">Sell · ${sellValue(t)}🪙</button>
            </div>`;
    }

    function banner(text) {
        const el = $("tdBanner");
        el.textContent = text;
        el.classList.remove("show");
        void el.offsetWidth;
        el.classList.add("show");
    }

    function buildShop() {
        const shop = $("shop");
        shop.innerHTML = Object.values(TOWER_TYPES).map((type) => `
            <button class="shopItem" data-tower="${type.key}" title="${type.blurb}">
                <span class="ico">${blookImg(type.sprite, 34)}</span>
                <span class="info">
                    <span class="nm">${type.name}</span>
                    <span class="blurb">${type.blurb}</span>
                </span>
                <span class="cost">${type.cost}🪙</span>
            </button>`).join("");

        shop.querySelectorAll(".shopItem").forEach((btn) => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.tower;
                state.selectedShop = state.selectedShop === id ? null : id;
                state.selectedTower = null;
                renderTowerInfo();
                syncHud();
            });
        });
    }

    /* ---------- building ---------- */
    function build(cx, cy, typeKey) {
        const type = TOWER_TYPES[typeKey];
        if (state.gold < type.cost) return;

        state.gold -= type.cost;
        state.towers.push({
            type: typeKey,
            cx,
            cy,
            x: (cx + 0.5) * CELL,
            y: (cy + 0.5) * CELL,
            level: 1,
            dmg: type.dmg,
            range: type.range,
            fire: type.fire,
            cd: 0.2,
            invested: type.cost,
        });
        burst((cx + 0.5) * CELL, (cy + 0.5) * CELL, type.color, 10);
        syncHud();
    }

    function upgrade(t) {
        if (t.level >= 3) return;
        const cost = upgradeCost(t);
        if (state.gold < cost) return;
        state.gold -= cost;
        t.invested += cost;
        t.level += 1;
        t.dmg *= 1.6;
        t.range += 10;
        t.fire *= 0.92;
        burst(t.x, t.y, TOWER_TYPES[t.type].color, 12);
        syncHud();
        renderTowerInfo();
    }

    function sell(t) {
        state.gold += sellValue(t);
        state.towers = state.towers.filter((x) => x !== t);
        if (state.selectedTower === t) state.selectedTower = null;
        burst(t.x, t.y, "#ffffff", 8);
        syncHud();
        renderTowerInfo();
    }

    /* ---------- waves ---------- */
    function buildWaveList(w) {
        const list = [];
        const count = 5 + Math.floor(w * 1.5);
        for (let i = 0; i < count; i++) {
            let type = "ant";
            if (w >= 2 && i % 3 === 1) type = "bee";
            if (w >= 4 && i % 4 === 2) type = "crow";
            if (w >= 7 && i % 5 === 3) type = "alien";
            list.push(type);
        }
        if (w % 5 === 0) list.push("crocodile");
        return list;
    }

    function startWave() {
        if (state.waveActive || state.over || state.wave >= TOTAL_WAVES) return;
        state.wave += 1;
        state.waveActive = true;
        state.spawnQueue = buildWaveList(state.wave);
        state.spawnTimer = 0.2;
        banner(`Wave ${state.wave}${state.wave % 5 === 0 ? " — BOSS" : ""}`);
        syncHud();
    }

    function spawnEnemy(typeKey) {
        const base = ENEMY_TYPES[typeKey];
        const scale = Math.pow(1.13, state.wave - 1);
        const hp = Math.round(base.hp * scale);
        state.enemies.push({
            type: typeKey,
            sprite: base.sprite,
            hp,
            maxHp: hp,
            speed: base.speed,
            bounty: Math.round(base.bounty * (1 + 0.04 * state.wave)),
            size: base.size,
            leakAmount: base.leak,
            x: WAYPOINTS[0].x,
            y: WAYPOINTS[0].y,
            wp: 1,
            dist: 0,
            slowTime: 0,
            slowFactor: 1,
            dead: false,
            wiggle: Math.random() * Math.PI * 2,
        });
    }

    function completeWave() {
        state.waveActive = false;
        state.wavesCleared = state.wave;
        const bonus = 20 + state.wave * 4;
        state.gold += bonus;
        state.wavesCleared = state.wave;

        if (state.wave >= TOTAL_WAVES) {
            endGame(true);
            return;
        }

        banner(`Wave ${state.wave} cleared · +${bonus}🪙`);
        syncHud();
    }

    /* ---------- combat ---------- */
    function burst(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = rand(30, 130);
            state.particles.push({
                x,
                y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: rand(0.25, 0.55),
                maxLife: 0.55,
                color,
                size: rand(2, 5),
            });
        }
    }

    function floatText(x, y, text, color) {
        state.floats.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
    }

    function findTarget(tower) {
        let best = null;
        for (const e of state.enemies) {
            if (e.dead) continue;
            const d = Math.hypot(e.x - tower.x, e.y - tower.y);
            if (d > tower.range) continue;
            if (!best || e.dist > best.dist) best = e;
        }
        return best;
    }

    function fire(tower, target) {
        const type = TOWER_TYPES[tower.type];
        state.projectiles.push({
            x: tower.x,
            y: tower.y,
            target,
            dmg: tower.dmg,
            splash: type.splash,
            slow: type.slow,
            color: type.color,
            speed: 620,
            dead: false,
        });
    }

    function damage(enemy, amount, slow) {
        if (enemy.dead) return;
        enemy.hp -= amount;
        if (slow) {
            enemy.slowTime = Math.max(enemy.slowTime, slow.dur);
            enemy.slowFactor = slow.factor;
        }
        if (enemy.hp <= 0) {
            enemy.dead = true;
            state.kills += 1;
            state.gold += enemy.bounty;
            burst(enemy.x, enemy.y, "#ffd24d", 8);
            floatText(enemy.x, enemy.y - 14, `+${enemy.bounty}`, "#ffd24d");
            syncHud();
        }
    }

    function moveEnemy(e, dt) {
        const slowed = e.slowTime > 0;
        let remaining = e.speed * (slowed ? e.slowFactor : 1) * dt;
        e.slowTime = Math.max(0, e.slowTime - dt);
        e.wiggle += dt * 8;

        while (remaining > 0) {
            const wp = WAYPOINTS[e.wp];
            if (!wp) {
                leakEnemy(e);
                return;
            }
            const dx = wp.x - e.x;
            const dy = wp.y - e.y;
            const d = Math.hypot(dx, dy);
            if (d <= remaining) {
                e.x = wp.x;
                e.y = wp.y;
                e.wp += 1;
                e.dist += d;
                remaining -= d;
            } else {
                e.x += (dx / d) * remaining;
                e.y += (dy / d) * remaining;
                e.dist += remaining;
                remaining = 0;
            }
        }
    }

    function leakEnemy(e) {
        e.dead = true;
        e.leaked = true;
        state.lives -= e.leakAmount;
        burst(PORTAL.x, PORTAL.y, "#ff6b57", 10);
        syncHud();
        if (state.lives <= 0) {
            state.lives = 0;
            syncHud();
            endGame(false);
        }
    }

    function updateProjectiles(dt) {
        for (const p of state.projectiles) {
            if (p.dead) continue;
            const target = p.target;

            if (!target || target.dead) {
                if (p.splash > 0) {
                    explode(p);
                } else {
                    p.dead = true;
                }
                continue;
            }

            const dx = target.x - p.x;
            const dy = target.y - p.y;
            const d = Math.hypot(dx, dy);
            const step = p.speed * dt;

            if (d <= step + 8) {
                p.x = target.x;
                p.y = target.y;
                explode(p);
            } else {
                p.x += (dx / d) * step;
                p.y += (dy / d) * step;
            }
        }
        state.projectiles = state.projectiles.filter((p) => !p.dead);
    }

    function explode(p) {
        p.dead = true;
        if (p.splash > 0) {
            burst(p.x, p.y, p.color, 10);
            for (const e of state.enemies) {
                if (e.dead) continue;
                if (Math.hypot(e.x - p.x, e.y - p.y) <= p.splash) {
                    damage(e, p.dmg, p.slow);
                }
            }
        } else {
            damage(p.target, p.dmg, p.slow);
            burst(p.x, p.y, p.color, 4);
        }
    }

    /* ---------- loop ---------- */
    function update(dt) {
        if (state.over || state.paused) return;

        if (state.waveActive) {
            state.spawnTimer -= dt;
            while (state.spawnQueue.length > 0 && state.spawnTimer <= 0) {
                const type = state.spawnQueue.shift();
                spawnEnemy(type);
                state.spawnTimer += type === "crocodile" ? 1.2 : 0.62;
            }
        }

        for (const e of state.enemies) {
            if (!e.dead) moveEnemy(e, dt);
        }
        state.enemies = state.enemies.filter((e) => !e.dead);

        for (const t of state.towers) {
            t.cd -= dt;
            if (t.cd > 0) continue;
            const target = findTarget(t);
            if (target) {
                fire(t, target);
                t.cd = t.fire;
            }
        }

        updateProjectiles(dt);

        for (const p of state.particles) {
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.94;
            p.vy *= 0.94;
        }
        state.particles = state.particles.filter((p) => p.life > 0);

        for (const f of state.floats) {
            f.life -= dt;
            f.y -= 28 * dt;
        }
        state.floats = state.floats.filter((f) => f.life > 0);

        if (state.waveActive && state.spawnQueue.length === 0 && state.enemies.length === 0) {
            completeWave();
        }
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function drawBoard() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#2a8052");
        g.addColorStop(1, "#1f6b45");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        for (let cy = 0; cy < ROWS; cy++) {
            for (let cx = 0; cx < COLS; cx++) {
                if (isPath(cx, cy)) continue;
                if ((cx + cy) % 2 === 0) {
                    ctx.fillStyle = "rgba(255,255,255,0.045)";
                    ctx.fillRect(cx * CELL, cy * CELL, CELL, CELL);
                }
            }
        }

        for (let cy = 0; cy < ROWS; cy++) {
            for (let cx = 0; cx < COLS; cx++) {
                if (!isPath(cx, cy)) continue;
                ctx.fillStyle = "#e3c08a";
                roundRect(cx * CELL + 1, cy * CELL + 1, CELL - 2, CELL - 2, 9);
                ctx.fill();
                ctx.fillStyle = "rgba(255,255,255,0.16)";
                roundRect(cx * CELL + 5, cy * CELL + 5, CELL - 10, CELL - 10, 7);
                ctx.fill();
            }
        }

        // portal at the end of the path
        const t = performance.now() / 600;
        ctx.save();
        ctx.globalAlpha = 0.55 + Math.sin(t) * 0.15;
        ctx.fillStyle = "#0d2b3d";
        ctx.beginPath();
        ctx.arc(PORTAL.x, PORTAL.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ff6b57";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(PORTAL.x, PORTAL.y, 22 + Math.sin(t) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.font = "16px 'Apple Color Emoji', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🏠", PORTAL.x, PORTAL.y + 1);

        // hover / shop preview
        if (state.hover && state.selectedShop) {
            const { cx, cy } = state.hover;
            const type = TOWER_TYPES[state.selectedShop];
            if (isBuildable(cx, cy)) {
                ctx.save();
                ctx.globalAlpha = 0.16;
                ctx.fillStyle = "#ffffff";
                roundRect(cx * CELL + 2, cy * CELL + 2, CELL - 4, CELL - 4, 8);
                ctx.fill();
                ctx.globalAlpha = 0.22;
                ctx.fillStyle = type.color;
                ctx.beginPath();
                ctx.arc((cx + 0.5) * CELL, (cy + 0.5) * CELL, type.range, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 0.5;
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }
        }

        if (state.selectedTower) {
            const t2 = state.selectedTower;
            ctx.save();
            ctx.strokeStyle = "rgba(255,255,255,0.75)";
            ctx.setLineDash([7, 6]);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(t2.x, t2.y, t2.range, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    function drawTowers() {
        for (const t of state.towers) {
            const type = TOWER_TYPES[t.type];
            ctx.save();
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.beginPath();
            ctx.ellipse(t.x, t.y + 16, 22, 8, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "rgba(255,255,255,0.12)";
            ctx.beginPath();
            ctx.arc(t.x, t.y, 23, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = type.color;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();

            drawBlook(ctx, type.sprite, t.x, t.y, 34);

            for (let i = 0; i < t.level; i++) {
                ctx.fillStyle = "#ffd24d";
                ctx.beginPath();
                ctx.arc(t.x - 8 + i * 8, t.y + 22, 3.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function drawEnemies() {
        for (const e of state.enemies) {
            const bob = Math.sin(e.wiggle) * 2;
            if (e.slowTime > 0) {
                ctx.save();
                ctx.globalAlpha = 0.35;
                ctx.fillStyle = "#59c6ff";
                ctx.beginPath();
                ctx.arc(e.x, e.y - 4 + bob, e.size * 0.62, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            drawBlook(ctx, e.sprite, e.x, e.y - 4 + bob, e.size);

            const w = Math.max(26, e.size * 0.85);
            const pct = Math.max(0, e.hp / e.maxHp);
            const bx = e.x - w / 2;
            const by = e.y - e.size / 2 - 10 + bob;
            ctx.fillStyle = "rgba(0,0,0,0.55)";
            roundRect(bx, by, w, 6, 3);
            ctx.fill();
            ctx.fillStyle = pct > 0.5 ? "#57e36b" : pct > 0.25 ? "#ffd24d" : "#ff6b57";
            roundRect(bx, by, w * pct, 6, 3);
            ctx.fill();
        }
    }

    function drawEffects() {
        for (const p of state.projectiles) {
            ctx.save();
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.splash > 0 ? 5.5 : 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        for (const p of state.particles) {
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.globalAlpha = 1;

        for (const f of state.floats) {
            ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
            ctx.font = "bold 15px 'Titan One', cursive";
            ctx.textAlign = "center";
            ctx.fillStyle = f.color;
            ctx.strokeStyle = "rgba(0,0,0,0.6)";
            ctx.lineWidth = 3;
            ctx.strokeText(f.text, f.x, f.y);
            ctx.fillText(f.text, f.x, f.y);
        }
        ctx.globalAlpha = 1;
    }

    function draw() {
        drawBoard();
        drawTowers();
        drawEnemies();
        drawEffects();

        if (state.over) {
            ctx.fillStyle = "rgba(0,0,0,0.35)";
            ctx.fillRect(0, 0, W, H);
        }
    }

    /* ---------- input ---------- */
    function toCanvas(ev) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (ev.clientX - rect.left) * (canvas.width / rect.width),
            y: (ev.clientY - rect.top) * (canvas.height / rect.height),
        };
    }

    canvas.addEventListener("mousemove", (ev) => {
        const { x, y } = toCanvas(ev);
        state.hover = { cx: Math.floor(x / CELL), cy: Math.floor(y / CELL) };
    });

    canvas.addEventListener("mouseleave", () => {
        state.hover = null;
    });

    canvas.addEventListener("click", (ev) => {
        if (state.over) return;
        const { x, y } = toCanvas(ev);
        const cx = Math.floor(x / CELL);
        const cy = Math.floor(y / CELL);

        const tower = towerAt(cx, cy);
        if (tower) {
            state.selectedTower = tower === state.selectedTower ? null : tower;
            state.selectedShop = null;
            renderTowerInfo();
            syncHud();
            return;
        }

        if (state.selectedShop && isBuildable(cx, cy)) {
            build(cx, cy, state.selectedShop);
            return;
        }

        state.selectedTower = null;
        renderTowerInfo();
    });

    $("towerInfo").addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-act]");
        if (!btn || !state.selectedTower) return;
        if (btn.dataset.act === "upgrade") upgrade(state.selectedTower);
        if (btn.dataset.act === "sell") sell(state.selectedTower);
    });

    $("startWaveBtn").addEventListener("click", startWave);

    $("speedBtn").addEventListener("click", () => {
        state.speed = state.speed === 1 ? 2 : 1;
        syncHud();
    });

    $("pauseBtn").addEventListener("click", () => {
        state.paused = !state.paused;
        syncHud();
    });

    document.addEventListener("keydown", (ev) => {
        if (ev.key === "1") { state.selectedShop = "toast"; state.selectedTower = null; syncHud(); renderTowerInfo(); }
        if (ev.key === "2") { state.selectedShop = "frost"; state.selectedTower = null; syncHud(); renderTowerInfo(); }
        if (ev.key === "3") { state.selectedShop = "cannon"; state.selectedTower = null; syncHud(); renderTowerInfo(); }
        if (ev.key === "Escape") { state.selectedShop = null; state.selectedTower = null; syncHud(); renderTowerInfo(); }
        if (ev.key === " ") { ev.preventDefault(); startWave(); }
        if (ev.key === "p" || ev.key === "P") { state.paused = !state.paused; syncHud(); }
    });

    /* ---------- game flow ---------- */
    function endGame(won) {
        if (state.over) return;
        state.over = true;
        state.won = won;

        const coins = projection();
        if (!state.paid) {
            state.paid = true;
            if (typeof addCoins === "function") addCoins(coins);
        }

        const bestKey = "td2BestWave";
        const best = parseInt(localStorage.getItem(bestKey), 10) || 0;
        if (state.wavesCleared > best) localStorage.setItem(bestKey, String(state.wavesCleared));

        $("overTitle").textContent = won ? "Victory!" : "Tower Down!";
        $("overWaves").textContent = state.wavesCleared;
        $("overKills").textContent = state.kills;
        $("overCoins").textContent = coins.toLocaleString();
        $("overCard").classList.add("active");
        syncHud();
    }

    function resetGame() {
        Object.assign(state, {
            gold: 150,
            lives: 20,
            wave: 0,
            kills: 0,
            wavesCleared: 0,
            waveActive: false,
            over: false,
            won: false,
            paused: false,
            speed: 1,
            enemies: [],
            towers: [],
            projectiles: [],
            particles: [],
            floats: [],
            spawnQueue: [],
            spawnTimer: 0,
            selectedShop: null,
            selectedTower: null,
            hover: null,
            paid: false,
        });
        $("overCard").classList.remove("active");
        renderTowerInfo();
        syncHud();
    }

    let lastTs = 0;
    function frame(ts) {
        const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
        lastTs = ts;
        update(dt * state.speed);
        draw();
        requestAnimationFrame(frame);
    }

    function init() {
        renderSidebar("games");
        buildShop();
        renderTowerInfo();
        syncHud();
        $("againBtn").addEventListener("click", resetGame);
        requestAnimationFrame(frame);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
