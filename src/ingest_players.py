"""Guarda cada hora las partidas nuevas de los jugadores seguidos (tracked_players).

Solo descarga los tags renovados en los últimos 30 días (v_tracked_activos).
Caducidad: los tags que nadie renueva en 6 meses se borran, con todas sus partidas.
Usa el mismo formato compacto que las funciones "seguir" y "consultar".

Variables de entorno:
  CR_TOKEN         token de la API de Clash Royale (vía proxy de RoyaleAPI)
  SUPABASE_DB_URL  cadena de conexión de Supabase (Session pooler)
"""
import os
import time
from datetime import datetime, timezone
import psycopg
from psycopg.types.json import Jsonb

try:
    from dotenv import load_dotenv
    load_dotenv(".env")
except ImportError:
    pass

from api import get, tag_url


def carta(c):
    return {"name": c["name"], "evolutionLevel": c.get("evolutionLevel", 0),
            "level": c.get("level"), "maxLevel": c.get("maxLevel"), "used": c.get("used")}


def lado(p):
    return {
        "tag": p.get("tag"), "name": p.get("name"), "crowns": p.get("crowns"),
        "elixirLeaked": p.get("elixirLeaked"),
        "startingTrophies": p.get("startingTrophies"), "trophyChange": p.get("trophyChange"),
        "globalRank": p.get("globalRank"),
        "kingTowerHitPoints": p.get("kingTowerHitPoints"), "princessTowersHitPoints": p.get("princessTowersHitPoints"),
        "cards": [carta(c) for c in p.get("cards", [])],
        "rounds": [{"crowns": r.get("crowns"), "elixirLeaked": r.get("elixirLeaked"),
                    "kingTowerHitPoints": r.get("kingTowerHitPoints"),
                    "princessTowersHitPoints": r.get("princessTowersHitPoints"),
                    "cards": [carta(c) for c in r.get("cards", [])]} for r in p["rounds"]] if p.get("rounds") else None,
    }


def compactar(b):
    """Mismo formato compacto que las funciones "seguir" y "consultar"."""
    return {"battleTime": b["battleTime"], "type": b.get("type"),
            "gameMode": (b.get("gameMode") or {}).get("name"), "leagueNumber": b.get("leagueNumber"),
            "challengeTitle": b.get("challengeTitle"), "challengeWinCountBefore": b.get("challengeWinCountBefore"),
            "team": [lado(b["team"][0])], "opponent": [lado(b["opponent"][0])]}


def main():
    with psycopg.connect(os.environ["SUPABASE_DB_URL"]) as conn:
        # caducidad automática: privacidad por diseño y menos espacio ocupado
        borrados = conn.execute(
            "DELETE FROM tracked_players WHERE renovado_at < now() - interval '6 months' RETURNING tag"
        ).fetchall()
        if borrados:
            print(f"Caducados (6 meses sin renovar): {len(borrados)} tags borrados con su historial")
        tags = [r[0] for r in conn.execute("SELECT tag FROM v_tracked_activos ORDER BY tag").fetchall()]
        nuevas = 0
        for tag in tags:
            r = get(f"/players/{tag_url(tag)}/battlelog")
            if r.status_code != 200:
                print(f"  #{tag}: HTTP {r.status_code}, se omite")
                continue
            for b in r.json():
                if len(b.get("team", [])) != 1 or len(b.get("opponent", [])) != 1:
                    continue  # 2 contra 2 no entra en las estadísticas
                hora = datetime.strptime(b["battleTime"], "%Y%m%dT%H%M%S.%fZ").replace(tzinfo=timezone.utc)
                cur = conn.execute(
                    """INSERT INTO raw_player_battles (tag, battle_key, battle_time, payload)
                       VALUES (%s, %s, %s, %s)
                       ON CONFLICT (tag, battle_key) DO UPDATE SET payload = EXCLUDED.payload
                       WHERE raw_player_battles.payload IS DISTINCT FROM EXCLUDED.payload
                       RETURNING (xmax = 0) AS nueva""",
                    (tag, f"{b['battleTime']}|{b['opponent'][0]['tag']}", hora, Jsonb(compactar(b))),
                )
                fila = cur.fetchone()
                nuevas += 1 if fila and fila[0] else 0
            time.sleep(0.1)
    print(f"Jugadores seguidos: {len(tags)} · partidas nuevas guardadas: {nuevas}")


if __name__ == "__main__":
    main()
