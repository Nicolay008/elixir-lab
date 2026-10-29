# Elixir Lab — Data and training for Clash Royale

🇪🇸 [Leer en español](README.es.md)

A data pipeline that collects my Clash Royale matches, the Peruvian and global
Path of Legends rankings and the decks top players actually use, stores them in
PostgreSQL in the cloud and analyses them — plus a web mini-game to train the
skills the data shows I need to improve.

🎮 **Try it:** [Elixir Lab](https://nicolay008.github.io/elixir-lab/), a mini-game to
master card costs, track your opponent's elixir and read their cycle.

## Why

The official API only keeps a player's last ~30-40 matches. This project
accumulates them without duplicates to build a full history and answer questions
global tools don't: how **I** perform, in **my** league, against the decks I
**actually** face — and what the top players are really playing.

## Stack

- Python 3 (`requests`, `psycopg`, `python-dotenv`)
- PostgreSQL — Supabase in the cloud (local PostgreSQL for development)
- GitHub Actions for scheduled ingestion
- Official Clash Royale API through the RoyaleAPI proxy
- Plain HTML, CSS and JavaScript for Elixir Lab, published with GitHub Pages

## Structure

```
elixir-lab/
├── .github/workflows/
│   └── ranking.yml          # hourly ingestion: matches, rankings, top decks, DB size
├── docs/                    # Elixir Lab (GitHub Pages)
│   ├── index.html           # the mini-game
│   ├── cards.json           # card catalogue generated from the API
│   └── nombres_es.json      # Spanish card names
├── sql/
│   ├── schema.sql           # match tables
│   ├── views.sql            # analysis views
│   ├── 04_ranking.sql       # ranking snapshots and movement (Supabase)
│   ├── 05_escalera.sql      # step tracking in Path of Legends
│   └── 06_analisis.sql      # opponent archetypes, my decks, security (Supabase)
└── src/
    ├── ingest.py            # my matches
    ├── ingest_ranking.py    # Peru and global ranking snapshots
    ├── ingest_top_decks.py  # real decks of the top players
    ├── check_db_size.py     # storage monitoring
    └── export_cards.py      # generates docs/cards.json
```

## How it runs

A GitHub Actions workflow runs **every hour** (at minute 23, avoiding the
congested top of the hour) on GitHub's servers, so nothing depends on my PC:

1. **Matches:** downloads my latest matches and stores only the new ones.
2. **Rankings:** a snapshot of the Path of Legends ranking for Peru (top 1000)
   and the world (top 1000), at most every 3.5 hours. Manual runs always save one.
3. **Top decks:** once a day, the deck of the last ranked match of the Peruvian
   top 50 and the global top 100.
4. **Database size:** reports usage and warns before the free-plan limit.

It needs two repository secrets: `CR_TOKEN` (API token) and `SUPABASE_DB_URL`
(Supabase connection string in **Session pooler** mode — GitHub Actions has no
IPv6, which the direct connection uses).

## Data model

**My matches** (private)

- `raw_battles`: full JSON of each match, to reprocess without calling the API again.
- `battles`, `battle_players`, `battle_cards`: one row per match, per player and per card,
  with level and form (normal, evolution or hero).
- `cards`, `battle_notes`: card catalogue and tags for unusual matches.
- `pol_anchor` + `v_escalera`: my step in the league, match by match (each win +1, each loss −1).

**Analysis**

- `archetype_rules`: editable rules — anchor card, optional second card and an elixir
  range — that classify each opponent deck (Beatdown, Bridge spam, Hog cycle, Bait…).
- `watched_cards`: threats tracked apart from the archetype (e.g. Mega Knight).
- `v_partidas_arquetipo`: each match with the opponent's archetype, threats, average elixir,
  most expensive card and how many evolutions and heroes they had.
- `deck_labels` + `v_mis_mazos`: my decks recognised by a stable signature and named by me,
  to compare winrate and wasted elixir between decks and variants.

**Rankings and top** (public read)

- `raw_ranking_snapshots`: each ranking snapshot, raw.
- `v_ranking_movimiento`: rank and rating change since the previous snapshot, and the reason
  ("won matches", "got overtaken", "didn't play"…).
- `top_decks` + `v_top_decks`: the decks top players use in ranked, with their signature.

Private tables have row-level security enabled with no policies: only the direct
connection (mine and GitHub Actions') can read them.

## Storage management

Supabase's free plan has 500 MB, and design decisions keep the project inside it:

- **Measure, don't guess:** every run reports the database size; above 350 MB it raises a
  warning and above 400 MB the run fails, leaving time to clean up.
- **Detail where it pays off:** ranking snapshots every 3.5 hours instead of hourly; my
  matches, which are small, hourly.
- **Summarise when a season ends** (planned): keep the final standings and a daily top 100,
  archive the rest.

Current growth estimate: about 80 MB per month.

## Elixir Lab

My data showed many of my losses came from elixir and decision mistakes. Elixir Lab
trains those skills:

- **Card mastery:** a card appears and you pick its cost before time runs out.
- **Track your opponent:** the opponent plays cards and time passes; you work out how much
  elixir they have left.
- **Read their cycle:** a step-by-step path, from following one target card to knowing which
  cards your opponent has available.

Trophies, records, badges and progress charts, in Spanish and English, mobile-friendly.
Costs come from the official API: run `python src/export_cards.py` to update them and add
new card names to `docs/nombres_es.json`.

## Findings from the data

- `elixirLeaked` is always 0 in boat battles, so they are excluded from elixir analysis.
- `evolutionLevel` tells the card form apart: 0 normal, 1 evolution, 2 hero.
- Levels use a different scale per rarity: a card is maxed when `level = maxLevel`.
- Peru's trophy ranking comes back empty: at the top, Path of Legends is what counts, and it
  returns up to 1000 players.
- **The profile deck (`currentDeck`) is not reliable** for top players: many keep a different
  deck selected so theirs isn't copied. The real deck comes from their last ranked match.
- GitHub Actions scheduled runs are not guaranteed: runs at the top of the hour were skipped
  several times, so the workflow runs hourly at an off-peak minute.

## Roadmap

### Phase 1 — Own data
- [x] Ingestion from the official API without duplicates
- [x] PostgreSQL data model with raw JSON
- [x] Automated ingestion in the cloud (GitHub Actions + Supabase)
- [x] Peru and global Path of Legends ranking snapshots
- [x] Real decks of the top players
- [x] Storage monitoring
- [ ] Import old history from CSV

### Phase 2 — Analysis
- [x] Opponent archetype classifier
- [x] Winrate by archetype, deck and variant
- [x] Step tracking in Path of Legends
- [ ] Personal dashboard with login
- [ ] Top-player matches and archetype matchup matrix
- [ ] Deck families (variants of the same deck)
- [ ] Public page "Path of Legends · Peru"
- [ ] Live score widget for streamers

### Phase 3 — Computer vision
- [ ] Recognise cards played in recorded replays
- [ ] Measure elixir trades play by play

### Phase 4 — Decision trainer
- [x] Elixir Lab: costs, elixir tracking and cycle reading
- [ ] Evolution cycles
- [ ] Match situations with reference answers

## Note

This project analyses matches already played and trains skills outside the game.
It does not automate or interact with Clash Royale.

Elixir Lab is unofficial fan content and is not endorsed by Supercell. See
[Supercell's Fan Content Policy](https://www.supercell.com/fan-content-policy).

Developed by **NickolayPaul** ([X](https://x.com/NickolayPaul)).

## License

MIT
