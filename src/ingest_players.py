"""Guarda cada hora las partidas nuevas de los jugadores seguidos (tracked_players).

Solo descarga los tags renovados en los últimos 30 días (v_tracked_activos).
Usa el mismo formato compacto que las funciones "seguir" y "consultar".

Variables de entorno:
  CR_TOKEN         token de la API de Clash Royale (vía proxy de RoyaleAPI)
  SUPABASE_DB_URL  cadena de conexión de Supabase (Session pooler)
"""
import os
import time
from datetime import datetime, timezone
import requests
import psycopg
from psycopg.types.json import Jsonb

try:
    from dotenv import load_dotenv
    load_dotenv(".env")
except ImportError:
    pass

API = "https://proxy.royaleapi.dev/v1"


def lado(p):
    return {
        "tag": p.get("tag"), "name": p.get("name"), "crowns": p.get("crowns"),
        "elixirLeaked": p.get("elixirLeaked"),
        "cards": [{"name": c["name"], "evolutionLevel": c.get("evolutionLevel", 0)} for c in p.get("cards", [])],
    }


def compactar(b):
    return {"battleTime": b["battleTime"], "type": b.get("type"),
            "gameMode": (b.get("gameMode") or {}).get("name"),
            "challengeTitle": b.get("challengeTitle"),
            "challengeWinCountBefore": b.get("challengeWinCountBefore"),
            "team": [lado(b["team"][0])], "opponent": [lado(b["opponent"][0])]}


def main():
    headers = {"Authorization": f"Bearer {os.environ['CR_TOKEN']}"}
    with psycopg.connect(os.environ["SUPABASE_DB_URL"]) as conn:
        tags = [r[0] for r in conn.execute("SELECT tag FROM v_tracked_activos ORDER BY tag").fetchall()]
        nuevas = 0
        for tag in tags:
            r = requests.get(f"{API}/players/%23{tag}/battlelog", headers=headers, timeout=30)
            if r.status_code != 200:
                print(f"  #{tag}: HTTP {r.status_code}, se omite")
                continue
            for b in r.json():
                if len(b.get("team", [])) != 1 or len(b.get("opponent", [])) != 1:
                    continue  # 2 contra 2 no entra en las estadísticas
                hora = datetime.strptime(b["battleTime"], "%Y%m%dT%H%M%S.%fZ").replace(tzinfo=timezone.utc)
                cur = conn.execute(
                    """INSERT INTO raw_player_battles (tag, battle_key, battle_time, payload)
                       VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING""",
                    (tag, f"{b['battleTime']}|{b['opponent'][0]['tag']}", hora, Jsonb(compactar(b))),
                )
                nuevas += cur.rowcount
            time.sleep(0.1)
    print(f"Jugadores seguidos: {len(tags)} · partidas nuevas guardadas: {nuevas}")


if __name__ == "__main__":
    main()
