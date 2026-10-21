"""Guarda una foto del ranking de Senda de Leyendas (Perú y global) en Supabase.

Lo ejecuta GitHub Actions cada hora, pero solo guarda una foto nueva si han
pasado al menos 3,5 horas desde la anterior (cada foto ocupa unos 250 KB).
Al lanzarlo a mano (FORZAR_FOTO=true) la guarda siempre.

Variables de entorno:
  CR_TOKEN         token de la API de Clash Royale (vía proxy de RoyaleAPI)
  SUPABASE_DB_URL  cadena de conexión de Supabase (Session pooler)
  FORZAR_FOTO      "true" para guardar aunque no haya pasado el intervalo
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
INTERVALO_MIN = "3 hours 30 minutes"


def main():
    forzar = os.getenv("FORZAR_FOTO", "").lower() == "true"
    with psycopg.connect(os.environ["SUPABASE_DB_URL"]) as conn:
        if not forzar:
            reciente = conn.execute(
                "SELECT max(snapshot_at) > now() - %s::interval FROM raw_ranking_snapshots",
                (INTERVALO_MIN,),
            ).fetchone()[0]
            if reciente:
                print("Última foto hace menos de 3,5 horas: no se guarda otra.")
                return

        headers = {"Authorization": f"Bearer {os.environ['CR_TOKEN']}"}
        for loc_id, nombre, url in RANKINGS:
            r = requests.get(url, headers=headers, timeout=30)
            r.raise_for_status()
            data = r.json()
            conn.execute(
                "INSERT INTO raw_ranking_snapshots (location_id, payload) VALUES (%s, %s)",
                (loc_id, Jsonb(data)),
            )
            print(f"Foto del ranking {nombre} guardada: {len(data.get('items', []))} jugadores")


if __name__ == "__main__":
    main()
