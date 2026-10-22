"""Comprueba el tamaño de la base de Supabase en cada ejecución de la ingesta.

El plan gratuito de Supabase tiene 500 MB. Este paso va al final del workflow:
  - más de AVISO_MB  → aviso amarillo en GitHub (planear la limpieza)
  - más de LIMITE_MB → la ejecución termina en rojo (limpiar ya)

Variables de entorno:
  SUPABASE_DB_URL  cadena de conexión de Supabase (Session pooler)
"""
import os
import sys
import psycopg

try:
    from dotenv import load_dotenv
    load_dotenv(".env")
except ImportError:
    pass

AVISO_MB = 350
LIMITE_MB = 400


def main():
    with psycopg.connect(os.environ["SUPABASE_DB_URL"]) as conn:
        total = conn.execute("SELECT pg_database_size(current_database())").fetchone()[0] / 1024**2
        tablas = conn.execute(
            """SELECT relname, pg_total_relation_size(relid) / 1024.0^2
               FROM pg_catalog.pg_statio_user_tables
               ORDER BY 2 DESC LIMIT 3"""
        ).fetchall()

    detalle = ", ".join(f"{t} {mb:.1f} MB" for t, mb in tablas)
    print(f"Base de datos: {total:.0f} MB de 500 MB · más grandes: {detalle}")

    if total > LIMITE_MB:
        print(f"::error::La base ocupa {total:.0f} MB (límite de alerta {LIMITE_MB} MB). Toca limpiar.")
        sys.exit(1)
    if total > AVISO_MB:
        print(f"::warning::La base ocupa {total:.0f} MB. Conviene planear la limpieza.")


if __name__ == "__main__":
    main()
