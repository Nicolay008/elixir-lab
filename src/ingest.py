import os
from datetime import datetime, timezone

import psycopg
from dotenv import load_dotenv
from psycopg.types.json import Jsonb

load_dotenv()
PLAYER_TAG = os.getenv("PLAYER_TAG", "#92CP0QJVG")

from api import get, tag_url


def fetch_battlelog(tag):
    r = get(f"/players/{tag_url(tag)}/battlelog", timeout=15)
    r.raise_for_status()
    return r.json()


def battle_id(b):
    return f"{b['battleTime']}_{b['team'][0]['tag']}_{b['opponent'][0]['tag']}"


def parse_time(s):
    return datetime.strptime(s, "%Y%m%dT%H%M%S.%fZ").replace(tzinfo=timezone.utc)


def save(conn, b):
    bid = battle_id(b)
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO raw_battles (battle_id, payload) VALUES (%s, %s) "
            "ON CONFLICT DO NOTHING",
            (bid, Jsonb(b)),
        )
        if cur.rowcount == 0:
            return False  # ya estaba guardada

        cur.execute(
            "INSERT INTO battles VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (bid, parse_time(b["battleTime"]), b.get("type"),
             b.get("gameMode", {}).get("name"), b.get("leagueNumber"),
             b.get("arena", {}).get("name"), b.get("isHostedMatch")),
        )

        for side, key in (("me", "team"), ("opponent", "opponent")):
            p = b[key][0]
            cur.execute(
                "INSERT INTO battle_players VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (bid, side, p.get("tag"), p.get("name"), p.get("crowns"),
                 p.get("kingTowerHitPoints"), p.get("princessTowersHitPoints"),
                 p.get("elixirLeaked"), p.get("globalRank")),
            )
            for slot, c in enumerate(p.get("cards", [])):
                cur.execute(
                    "INSERT INTO cards VALUES (%s, %s, %s, %s, %s) "
                    "ON CONFLICT DO NOTHING",
                    (c["id"], c["name"], c.get("rarity"),
                     c.get("elixirCost"), c.get("maxLevel")),
                )
                cur.execute(
                    "INSERT INTO battle_cards VALUES (%s, %s, %s, %s, %s, %s)",
                    (bid, side, slot, c["id"], c.get("level"),
                     c.get("evolutionLevel", 0)),
                )
    return True

PERU = 57000184

def main():
    battles = fetch_battlelog(PLAYER_TAG)
    new = 0
    with psycopg.connect(os.getenv("DATABASE_URL", "dbname=deck_ai")) as conn:
        for b in battles:
            if save(conn, b):
                new += 1  
    print(f"Recibidas: {len(battles)} | Nuevas guardadas: {new}")


if __name__ == "__main__":
    main()