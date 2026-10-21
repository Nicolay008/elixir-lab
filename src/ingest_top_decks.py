"""Guarda una vez al día el mazo actual del top de Perú y del top global en Supabase.

Toma los tags de la última foto del ranking (raw_ranking_snapshots), pide el perfil
de cada jugador y guarda solo su mazo actual (currentDeck), su nombre y su puesto.

Variables de entorno:
  CR_TOKEN         token de la API de Clash Royale (vía proxy de RoyaleAPI)
  SUPABASE_DB_URL  cadena de conexión de Supabase (Session pooler)
  FORZAR_FOTO      "true" para guardar aunque ya haya una foto reciente
"""
import os
import time
import requests
import psycopg
from psycopg.types.json import Jsonb

try:  # en local se leen del .env; en GitHub vienen de los secrets
    from dotenv import load_dotenv
    load_dotenv(".env")
except ImportError:
    pass

API = "https://proxy.royaleapi.dev/v1"
TOPS = [(57000184, "Perú", 50), (0, "Global", 100)]   # (location_id, nombre, cuántos)
INTERVALO_MIN = "20 hours"


def main():
    forzar = os.getenv("FORZAR_FOTO", "").lower() == "true"
    headers = {"Authorization": f"Bearer {os.environ['CR_TOKEN']}"}
    with psycopg.connect(os.environ["SUPABASE_DB_URL"]) as conn:
        if not forzar:
            reciente = conn.execute(
                "SELECT max(snapshot_at) > now() - %s::interval FROM top_decks",
                (INTERVALO_MIN,),
            ).fetchone()[0]
            if reciente:
                print("Ya hay una foto de mazos de hoy: no se guarda otra.")
                return

        for loc_id, nombre, n in TOPS:
            # jugadores de la última foto del ranking de esa ubicación
            jugadores = conn.execute(
                """SELECT puesto, tag, nombre, rating FROM v_ranking
                   WHERE location_id = %s
                     AND snapshot_at = (SELECT max(snapshot_at) FROM raw_ranking_snapshots WHERE location_id = %s)
                     AND puesto <= %s
                   ORDER BY puesto""",
                (loc_id, loc_id, n),
            ).fetchall()
            guardados = 0
            for puesto, tag, nom, rating in jugadores:
                r = requests.get(f"{API}/players/{tag.replace('#', '%23')}", headers=headers, timeout=30)
                if r.status_code != 200:
                    print(f"  {tag}: HTTP {r.status_code}, se omite")
                    continue
                deck = r.json().get("currentDeck", [])
                conn.execute(
                    """INSERT INTO top_decks (location_id, puesto, tag, nombre, rating, deck)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    (loc_id, puesto, tag, nom, rating, Jsonb(deck)),
                )
                guardados += 1
                time.sleep(0.1)   # sin prisas con la API
            print(f"Mazos del top {nombre} guardados: {guardados} de {len(jugadores)}")


if __name__ == "__main__":
    main()
