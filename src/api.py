"""Función compartida para llamar al proxy de RoyaleAPI con reintentos.

Todos los scripts de ingesta usan el mismo proxy, que a veces responde
con 429, 500, 502, 520 o 525. En vez de repetir la lógica en cada uno,
se centraliza aquí.
"""
import os
import time
import requests

try:
    from dotenv import load_dotenv
    load_dotenv(".env")
except ImportError:
    pass

API = "https://proxy.royaleapi.dev/v1"
REINTENTOS = (2, 5, 10)   # segundos de espera entre intentos


def headers():
    return {"Authorization": f"Bearer {os.environ['CR_TOKEN']}"}


def get(ruta, *, timeout=30, reintentar=True):
    """GET al proxy con reintentos ante 429 o 5xx.

    ruta: ruta relativa (sin la base), por ejemplo "/players/%23TAG/battlelog".
    Devuelve el objeto Response. No lanza excepción: el llamador decide qué hacer
    con el código de estado.
    """
    url = f"{API}{ruta}"
    esperas = (0,) + REINTENTOS if reintentar else (0,)
    r = None
    for espera in esperas:
        if espera:
            time.sleep(espera)
        r = requests.get(url, headers=headers(), timeout=timeout)
        if r.status_code == 200 or (r.status_code != 429 and r.status_code < 500):
            break
    return r


def tag_url(tag):
    """Convierte '#TAG' o 'TAG' en el formato URL '%23TAG'."""
    return tag.replace("#", "%23") if "#" in tag else f"%23{tag}"
