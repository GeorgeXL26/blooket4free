Hacking into Booklet!!!!!!!

A fan-made recreation of Blooket's collection screen — packs, blooks, a pack maker, and a small arcade of
game modes that pay out **Blook Coins**.

> Fan project, not affiliated with Blooket LLC. The blook art is loaded from Blooket's public CDN with emoji
> fallbacks, so the games still work offline.

## Pages

| Page | What it does |
| --- | --- |
| `index.html` | Market — every pack, opening animation, buy packs with Blook Coins |
| `blooks.html` | My Blooks — the collection grid, sell duplicates for coins |
| `maker.html` | Pack Maker — build and load custom `.bpk` packs |
| `games.html` | Games hub — pick a mode, see your best runs |
| `monsterbrawl.html` | Monster Brawl — wave brawler, coins per knockout |
| `towerdefense.html` | Tower Defense 2 — build blook towers, 20 waves, coins per wave |
| `goldquest.html` | Gold Quest — chest gambling against a rival, coins from your pile |
| `snake.html` | Coin Snake — the original coin grinder |

## Game modes

| Mode | Earn rate | Best saved as |
| --- | --- | --- |
| Monster Brawl | 12 + 4×wave per knockout, +25 for bosses | `monsterBrawlBestWave` |
| Tower Defense 2 | 6 per wave cleared + 0.5 per blook popped | `td2BestWave` |
| Gold Quest | 1 coin per 8 gold, +20 for beating the rival | `goldQuestBestGold` |
| Coin Snake | 20 per pellet eaten | `snakeBestCoins` |

Everything is client-side: coins live in `localStorage` (`blookCoins`) through `assets/js/coins.js`, and the
collection lives in `blooksCollection`.

## Running it

No build step. Serve the folder and open it:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```
