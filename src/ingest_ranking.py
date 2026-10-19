"""Guarda una foto del ranking de Senda de Leyendas (Perú y global) en Supabase.

Lo ejecuta GitHub Actions cada 4 horas. Necesita dos variables de entorno:
  CR_TOKEN         token de la API de Clash Royale (vía proxy de RoyaleAPI)
  SUPABASE_DB_URL  cadena de conexión de Supabase (Session pooler)
"""
import os
import requests
import psycopg
from psycopg.types.json import Jsonb

try:  # en local se leen del .env; en GitHub vienen de los secrets
    from dotenv import load_dotenv
    load_dotenv(".env")
except ImportError:
    pass

BASE = "https://proxy.royaleapi.dev/v1/locations"
# location_id en la tabla: el id de la API para países; 0 para el ranking global
RANKINGS = [
    (57000184, "Perú", f"{BASE}/57000184/pathoflegend/players"),
    (0, "Global", f"{BASE}/global/pathoflegend/players"),
]


def main():
    headers = {"Authorization": f"Bearer {os.environ['CR_TOKEN']}"}
    fotos = []
    for loc_id, nombre, url in RANKINGS:
        r = requests.get(url, headers=headers, timeout=30)
        r.raise_for_status()
        fotos.append((loc_id, nombre, r.json()))

    with psycopg.connect(os.environ["SUPABASE_DB_URL"]) as conn:
        for loc_id, nombre, data in fotos:
            conn.execute(
                "INSERT INTO raw_ranking_snapshots (location_id, payload) VALUES (%s, %s)",
                (loc_id, Jsonb(data)),
            )
            print(f"Foto del ranking {nombre} guardada: {len(data.get('items', []))} jugadores")


if __name__ == "__main__":
    main()
