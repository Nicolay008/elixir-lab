"""Guarda una foto del ranking de Senda de Leyendas de Perú en Supabase.

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

PERU = 57000184
URL = f"https://proxy.royaleapi.dev/v1/locations/{PERU}/pathoflegend/players"


def main():
    r = requests.get(URL, headers={"Authorization": f"Bearer {os.environ['CR_TOKEN']}"}, timeout=30)
    r.raise_for_status()
    data = r.json()
    with psycopg.connect(os.environ["SUPABASE_DB_URL"]) as conn:
        conn.execute(
            "INSERT INTO raw_ranking_snapshots (location_id, payload) VALUES (%s, %s)",
            (PERU, Jsonb(data)),
        )
    print(f"Foto del ranking guardada en Supabase: {len(data.get('items', []))} jugadores")


if __name__ == "__main__":
    main()
