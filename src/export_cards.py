"""Exporta el catálogo de cartas desde la API oficial a docs/.

Uso:  python src/export_cards.py
Lee CR_TOKEN de .env. El token nunca llega a la web: solo los JSON generados.

  docs/cards.json        cartas de coste fijo (las usa Elixir Lab)
  docs/cards_extra.json  cartas de coste variable, como el Espejo (solo imagen y nombre,
                         para la lista de partidas de la página del jugador)
"""
import json
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

BASE_URL = "https://proxy.royaleapi.dev/v1"
ROOT = Path(__file__).resolve().parent.parent
NOMBRES = ROOT / "docs" / "nombres_es.json"
SALIDA = ROOT / "docs" / "cards.json"
EXTRA = ROOT / "docs" / "cards_extra.json"

RAREZA_ES = {
    "common": "Común", "rare": "Especial", "epic": "Épica",
    "legendary": "Legendaria", "champion": "Campeón",
}


def main() -> None:
    load_dotenv(ROOT / ".env")
    token = os.environ["CR_TOKEN"]
    resp = requests.get(f"{BASE_URL}/cards", headers={"Authorization": f"Bearer {token}"}, timeout=20)
    resp.raise_for_status()
    items = resp.json()["items"]

    nombres = json.loads(NOMBRES.read_text(encoding="utf-8")) if NOMBRES.exists() else {}
    cartas, extra, sin_traducir = [], [], []

    for c in items:
        es = nombres.get(c["name"])
        if es is None:
            sin_traducir.append(c["name"])
        icons = c.get("iconUrls", {})
        fila = {
            "id": c["id"],
            "nombre": es or c["name"],
            "nombre_en": c["name"],
            "coste": c.get("elixirCost"),
            "rareza": RAREZA_ES.get(c.get("rarity", ""), c.get("rarity", "")),
            "icono": icons.get("medium"),
            "icono_evo": icons.get("evolutionMedium"),
            "icono_heroe": icons.get("heroMedium"),
        }
        # las cartas de coste variable (p. ej. Espejo) no sirven para Maestría de cartas
        (cartas if c.get("elixirCost") is not None else extra).append(fila)

    cartas.sort(key=lambda x: (x["coste"], x["nombre"]))
    SALIDA.write_text(json.dumps(cartas, ensure_ascii=False, indent=1), encoding="utf-8")
    EXTRA.write_text(json.dumps(extra, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"{len(cartas)} cartas exportadas a {SALIDA.relative_to(ROOT)}")
    print(f"{len(extra)} cartas de coste variable en {EXTRA.relative_to(ROOT)}")
    if sin_traducir:
        print(f"\nSin nombre en español ({len(sin_traducir)}), añádelas a docs/nombres_es.json:")
        for n in sorted(sin_traducir):
            print(f"  {n}")


if __name__ == "__main__":
    main()
