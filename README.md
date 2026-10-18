# Elixir Lab — Datos y entrenamiento para Clash Royale

Pipeline ETL que descarga mis partidas y el ranking de Perú desde la API oficial
de Clash Royale, los guarda en PostgreSQL para analizarlos, y un minijuego web
para entrenar las habilidades que los datos muestran que fallan.

🎮 **Pruébalo:** [Elixir Lab](https://nicolay008.github.io/elixir-lab/), un minijuego
para dominar los costes de las cartas, llevar la cuenta del elixir del rival y
leer su ciclo.

## Por qué

La API solo conserva las últimas ~40 partidas de cada jugador. Este proyecto
las acumula sin duplicados para construir un historial propio y responder
preguntas que las herramientas globales no responden: cómo me va **a mí**,
en **mi liga**, contra los mazos que **de verdad** me encuentro.

## Stack

- Python 3 (`requests`, `psycopg`, `python-dotenv`)
- PostgreSQL 18
- API oficial de Clash Royale vía proxy de RoyaleAPI
- HTML, CSS y JavaScript sin dependencias para Elixir Lab, publicado con GitHub Pages

## Estructura

```
elixir-lab/
├── docs/                 # Elixir Lab (GitHub Pages)
│   ├── index.html        # el minijuego
│   ├── cards.json        # catálogo generado desde la API
│   └── nombres_es.json   # nombres de las cartas en español
├── sql/
│   ├── schema.sql        # tablas
│   ├── views.sql         # vistas de análisis
│   └── 04_ranking.sql    # fotos del ranking de Perú y sus vistas
└── src/
    ├── ingest.py         # descarga partidas y la foto del ranking
    └── export_cards.py   # genera docs/cards.json
```

## Modelo de datos

**Partidas**

- `raw_battles`: JSON completo de cada partida, para reprocesar sin volver a la API.
- `battles`: una fila por partida (modo, liga, fecha).
- `battle_players`: los dos jugadores (coronas, vida de torres, elixir desperdiciado).
- `battle_cards`: las 8 cartas de cada lado, con nivel y forma (normal, evolución o héroe).
- `cards`: catálogo de cartas.
- `battle_notes`: etiquetas para partidas atípicas (rival AFK, rendición...).

**Ranking de Perú**

- `raw_ranking_snapshots`: cada foto del ranking de Senda de Leyendas de Perú, en JSON crudo.
- `v_ranking`: una fila por jugador y foto (puesto, nombre, puntuación, clan).
- `v_ranking_movimiento`: cuántos puestos subió o bajó cada jugador desde la foto anterior.

## Instalación

1. **Clave de la API.** Crea una cuenta en
   [developer.clashroyale.com](https://developer.clashroyale.com) y genera una
   clave autorizando la IP `45.79.218.79`, que es la del proxy de RoyaleAPI.
   Así la clave funciona aunque tu IP cambie.

2. **Entorno de Python:**

```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
```

3. **Variables de entorno.** Copia la plantilla y rellena tu token y tu tag:

```bash
   cp .env.example .env
```

4. **Base de datos** (PostgreSQL):

```bash
   createdb deck_ai
   psql deck_ai -f sql/schema.sql
   psql deck_ai -f sql/views.sql
   psql deck_ai -f sql/04_ranking.sql
```

## Uso

```bash
python src/ingest.py
```

Descarga tus últimas partidas, guarda solo las nuevas y añade una foto del
ranking de Senda de Leyendas de Perú. Ejecútalo con regularidad: la API
conserva unas 30-40 partidas por jugador.

### Ingesta automática (Windows + WSL)

Una tarea del Programador de tareas de Windows ejecuta la ingesta cada 4 horas
mientras el PC está encendido. PostgreSQL arranca solo con WSL gracias a
`sudo systemctl enable postgresql`. La acción de la tarea es:

```
wsl.exe -d Ubuntu -u <usuario> -- bash -lc "cd ~/Proyectos/deck-ai && date >> logs/ingest.log && .venv/bin/python src/ingest.py >> logs/ingest.log 2>&1"
```

El resultado de cada ejecución queda en `logs/ingest.log` (excluido de git).

### Consultas útiles

Tus partidas con el mazo rival:

```sql
SELECT * FROM v_partidas ORDER BY battle_time DESC;
```

Quién subió más puestos en el ranking de Perú desde la foto anterior:

```sql
SELECT puesto, nombre, rating, cambio
FROM v_ranking_movimiento
WHERE snapshot_at = (SELECT max(snapshot_at) FROM raw_ranking_snapshots)
  AND cambio > 0
ORDER BY cambio DESC
LIMIT 10;
```

## Elixir Lab

Mis datos mostraban que gran parte de mis derrotas venía de malas decisiones
de elixir. Elixir Lab entrena esas habilidades con tres modos:

- **Maestría de cartas:** sale una carta y marcas su coste antes de que se
  agote el tiempo. Tres torres como vidas, coronas por rachas y tres dificultades.
- **Controla a tu rival:** el rival juega cartas y pasa el tiempo; calculas
  cuánto elixir le queda. Tres etapas, desde sin reloj hasta una partida real
  con doble elixir.
- **Lee su ciclo:** el rival juega cartas de su mano y tienes que saber cuáles
  tiene disponibles. Tres etapas, de todo a la vista a solo memoria.

Cada modo guarda trofeos, récords, insignias y un gráfico de progreso. Funciona
en español e inglés, y en móvil.

Los costes salen de la API oficial: para actualizarlos, ejecuta
`python src/export_cards.py` y añade a `docs/nombres_es.json` el nombre en
español de las cartas nuevas que indique.

## Hallazgos de los datos

- `elixirLeaked` vale siempre 0 en las batallas de barco: se excluyen del análisis de elixir.
- `evolutionLevel` distingue la forma de la carta: 0 normal, 1 evolución, 2 héroe.
- Los niveles usan una escala distinta por rareza: una carta está al máximo cuando `level = maxLevel`.
- El ranking de trofeos de Perú llega vacío: en la liga alta cuenta la Senda de
  Leyendas, que devuelve todo el ranking local (708 jugadores en la primera foto).

## Hoja de ruta

### Fase 1 — Datos propios (en curso)
- [x] Ingesta desde la API oficial sin duplicados
- [x] Modelo de datos en PostgreSQL con JSON crudo
- [x] Vista de partidas con evoluciones y héroes del rival
- [x] Etiquetado de partidas atípicas
- [x] Automatizar la ingesta
- [x] Fotos del ranking de Senda de Leyendas de Perú
- [ ] Importar historial antiguo desde CSV

### Fase 2 — Análisis
- [ ] Clasificador de arquetipos rivales (carta ancla + coste medio de elixir)
- [ ] Winrate y elixir desperdiciado por arquetipo, modo y variante de mazo
- [ ] Dashboard de progreso
- [ ] Página pública "Senda de Leyendas · Perú": movimientos, récords y tiempo en el top

### Fase 3 — Visión por computadora
- [ ] Reconocer cartas jugadas en repeticiones grabadas
- [ ] Medir intercambios de elixir jugada a jugada

### Fase 4 — Entrenador de decisiones
- [x] Elixir Lab: costes, conteo de elixir y lectura del ciclo
- [ ] Ciclo de evolución: saber cuándo sale evolucionada una carta
- [ ] Situaciones de partida con respuestas de referencia
      (decisiones de jugadores top y reglas propias)
- [ ] Puntuación por intercambio de elixir

## Nota

Este proyecto analiza partidas ya jugadas y entrena habilidades fuera del juego.
No automatiza ni interactúa con Clash Royale.

Elixir Lab es material no oficial y no está respaldado por Supercell. Consulta la
[política de contenido de fans de Supercell](https://www.supercell.com/fan-content-policy).

Desarrollado por **Inka Lobby GG**.

## Licencia

MIT