"""Guarda una vez al día el mazo real del top de Perú y del top global en Supabase.

Toma los tags de la última foto del ranking (raw_ranking_snapshots), pide el historial
de cada jugador y guarda el mazo de su última partida de ranked (Senda de Leyendas).
No se usa el mazo del perfil (currentDeck): los jugadores top suelen dejar seleccionado
otro mazo para no mostrar el que juegan.

Variables de entorno:
  CR_TOKEN         token de la API de Clash Royale (vía proxy de RoyaleAPI)
  SUPABASE_DB_URL  cadena de conexión de Supabase (Session pooler)
  FORZAR_FOTO      "true" para guardar aunque ya haya una foto reciente
"""
import os
import time
from datetime import datetime, timezone
import requests
import psycopg
from psycopg.types.json import Jsonb

try:  # en local se leen del .env; en GitHub vienen de los secrets
    from dotenv import load_dotenv
    load_dotenv(".env")
except ImportError:
    pass

API = "https://proxy.royaleapi.dev/v1"
REINTENTOS = (2, 5, 10)   # segundos de espera ante 429 o errores 5xx
TOPS = [(57000184, "Perú", 50), (0, "Global", 100)]   # (location_id, nombre, cuántos)
INTERVALO_MIN = "20 hours"


def pedir_historial(headers, tag):
    """Pide el historial; reintenta con espera ante límite de peticiones o errores del servidor."""
    for espera in (0,) + REINTENTOS:
        if espera:
            time.sleep(espera)
        r = requests.get(f"{API}/players/{tag.replace('#', '%23')}/battlelog", headers=headers, timeout=30)
        if r.status_code == 200 or (r.status_code != 429 and r.status_code < 500):
            return r
    return r   # último intento: se devuelve con su código


def ultimo_mazo(conn, loc_id, tag):
    """Último mazo guardado de ese jugador en cualquier foto anterior, o None."""
    return conn.execute(
        """SELECT deck, partida_at FROM top_decks
           WHERE location_id = %s AND tag = %s AND deck IS NOT NULL
           ORDER BY snapshot_at DESC LIMIT 1""",
        (loc_id, tag),
    ).fetchone()


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
            guardados = anteriores = sin_datos = 0
            for puesto, tag, nom, rating in jugadores:
                deck, jugada = None, None
                r = pedir_historial(headers, tag)
                if r.status_code != 200:
                    motivo = f"HTTP {r.status_code}"
                else:
                    # la primera partida de ranked del historial es la más reciente
                    ranked = next((b for b in r.json() if b.get("type") == "pathOfLegend"), None)
                    if ranked is None:
                        motivo = "sin ranked en las últimas partidas"
                    else:
                        deck = ranked["team"][0]["cards"]
                        jugada = datetime.strptime(ranked["battleTime"], "%Y%m%dT%H%M%S.%fZ").replace(tzinfo=timezone.utc)
                        motivo = None

                if deck is None:
                    # no hay dato hoy: se conserva el último mazo conocido, con su fecha real de partida
                    previo = ultimo_mazo(conn, loc_id, tag)
                    if previo is None:
                        sin_datos += 1
                        print(f"  {tag} (puesto {puesto}): {motivo}, sin mazo anterior")
                        continue
                    deck, jugada = previo
                    anteriores += 1
                    print(f"  {tag} (puesto {puesto}): {motivo}, se usa el mazo de una foto anterior")
                    if isinstance(deck, str):
                        import json
                        deck = json.loads(deck)
                else:
                    guardados += 1

                conn.execute(
                    """INSERT INTO top_decks (location_id, puesto, tag, nombre, rating, deck, fuente, partida_at)
                       VALUES (%s, %s, %s, %s, %s, %s, 'ranked', %s)""",
                    (loc_id, puesto, tag, nom, rating, Jsonb(deck), jugada),
                )
                time.sleep(0.1)   # sin prisas con la API
            print(f"Mazos del top {nombre}: {guardados} nuevos, {anteriores} de foto anterior, {sin_datos} sin datos (de {len(jugadores)})")


if __name__ == "__main__":
    main()
