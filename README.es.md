# Elixir Lab — Datos y entrenamiento para Clash Royale

🇬🇧 [Read in English](README.md)

Pipeline de datos que recoge mis partidas de Clash Royale, el ranking de la Senda de
Leyendas de Perú y del mundo, y los mazos que de verdad usan los mejores jugadores; los
guarda en PostgreSQL en la nube y los analiza. Además, un minijuego web para entrenar
las habilidades que los datos muestran que debo mejorar.

🎮 **Pruébalo:** [Elixir Lab](https://nicolay008.github.io/elixir-lab/), un minijuego para
dominar los costes de las cartas, llevar la cuenta del elixir del rival y leer su ciclo.

## Por qué

La API oficial solo conserva las últimas ~30-40 partidas de cada jugador. Este proyecto
las acumula sin duplicados para construir un historial completo y responder preguntas que
las herramientas globales no responden: cómo me va **a mí**, en **mi liga**, contra los
mazos que **de verdad** me encuentro, y qué juegan realmente los mejores.

## Stack

- Python 3 (`requests`, `psycopg`, `python-dotenv`)
- PostgreSQL: Supabase en la nube (PostgreSQL local para desarrollo)
- GitHub Actions para la ingesta programada
- API oficial de Clash Royale vía el proxy de RoyaleAPI
- HTML, CSS y JavaScript sin dependencias para Elixir Lab, publicado con GitHub Pages

## Estructura

```
elixir-lab/
├── .github/workflows/
│   └── ranking.yml          # ingesta cada hora: partidas, rankings, mazos del top, espacio
├── docs/                    # Elixir Lab (GitHub Pages)
│   ├── index.html           # el minijuego
│   ├── cards.json           # catálogo de cartas generado desde la API
│   └── nombres_es.json      # nombres de las cartas en español
├── sql/
│   ├── schema.sql           # tablas de partidas
│   ├── views.sql            # vistas de análisis
│   ├── 04_ranking.sql       # fotos del ranking y su movimiento (Supabase)
│   ├── 05_escalera.sql      # seguimiento de escalones en la Senda de Leyendas
│   └── 06_analisis.sql      # arquetipos rivales, mis mazos y seguridad (Supabase)
└── src/
    ├── ingest.py            # mis partidas
    ├── ingest_ranking.py    # fotos del ranking de Perú y global
    ├── ingest_top_decks.py  # mazos reales del top
    ├── check_db_size.py     # control del espacio
    └── export_cards.py      # genera docs/cards.json
```

## Cómo funciona

Un workflow de GitHub Actions se ejecuta **cada hora**, en el minuto 23 para evitar la
congestión de las horas en punto, en los servidores de GitHub, así que nada depende de mi PC:

1. **Partidas:** descarga mis últimas partidas y guarda solo las nuevas.
2. **Rankings:** una foto del ranking de la Senda de Leyendas de Perú (top 1000) y del
   mundo (top 1000), como mucho cada 3,5 horas. Al lanzarlo a mano, siempre guarda una.
3. **Mazos del top:** una vez al día, el mazo de la última partida de ranked del top 50
   de Perú y del top 100 global.
4. **Tamaño de la base:** informa del espacio usado y avisa antes del límite del plan gratuito.

Necesita dos secrets en el repositorio: `CR_TOKEN` (token de la API) y `SUPABASE_DB_URL`
(cadena de conexión de Supabase en modo **Session pooler**: GitHub Actions no tiene IPv6,
que es lo que usa la conexión directa).

## Modelo de datos

**Mis partidas** (privadas)

- `raw_battles`: JSON completo de cada partida, para reprocesar sin volver a la API.
- `battles`, `battle_players`, `battle_cards`: una fila por partida, por jugador y por carta,
  con su nivel y su forma (normal, evolución o héroe).
- `cards`, `battle_notes`: catálogo de cartas y etiquetas para partidas atípicas.
- `pol_anchor` + `v_escalera`: mi escalón en la liga, partida a partida (cada victoria +1,
  cada derrota −1).

**Análisis**

- `archetype_rules`: reglas editables (carta ancla, segunda carta opcional y rango de coste
  medio) que clasifican cada mazo rival: Beatdown, Bridge spam, Ciclo de Montapuercos, Bait…
- `watched_cards`: amenazas que se vigilan aparte del arquetipo, como el Megacaballero.
- `v_partidas_arquetipo`: cada partida con el arquetipo del rival, sus amenazas, su coste
  medio, su carta más cara y cuántas evoluciones y héroes llevaba.
- `deck_labels` + `v_mis_mazos`: mis mazos, reconocidos por una firma estable y con el nombre
  que les doy, para comparar winrate y elixir desperdiciado entre mazos y variantes.

**Rankings y top** (lectura pública)

- `raw_ranking_snapshots`: cada foto del ranking, en crudo.
- `v_ranking_movimiento`: cambio de puesto y de rating desde la foto anterior, y su motivo
  ("ganó partidas", "le adelantaron", "no jugó"…).
- `top_decks` + `v_top_decks`: los mazos que usan los mejores en ranked, con su firma.

Las tablas privadas tienen la seguridad a nivel de fila activada y sin políticas: solo la
conexión directa, la mía y la de GitHub Actions, puede leerlas.

## Gestión del espacio

El plan gratuito de Supabase tiene 500 MB, y varias decisiones de diseño mantienen el
proyecto dentro de ese límite:

- **Medir, no adivinar:** cada ejecución informa del tamaño de la base; por encima de 350 MB
  lanza un aviso, y por encima de 400 MB la ejecución falla, con tiempo para limpiar.
- **Detalle donde aporta:** fotos del ranking cada 3,5 horas en lugar de cada hora; mis
  partidas, que ocupan poco, cada hora.
- **Resumir al cerrar cada temporada** (previsto): conservar la clasificación final y un top
  100 diario, y archivar el resto.

Estimación actual de crecimiento: unos 80 MB al mes.

## Elixir Lab

Mis datos mostraban que muchas de mis derrotas venían de errores de elixir y de decisión.
Elixir Lab entrena esas habilidades:

- **Maestría de cartas:** sale una carta y marcas su coste antes de que se agote el tiempo.
- **Controla a tu rival:** el rival juega cartas y pasa el tiempo; calculas cuánto elixir le queda.
- **Lee su ciclo:** un camino por etapas, desde seguir una carta objetivo hasta saber qué
  cartas tiene disponibles tu rival.

Trofeos, récords, insignias y gráficos de progreso, en español e inglés y adaptado al móvil.
Los costes salen de la API oficial: para actualizarlos, ejecuta `python src/export_cards.py`
y añade a `docs/nombres_es.json` el nombre en español de las cartas nuevas.

## Hallazgos de los datos

- `elixirLeaked` vale siempre 0 en las batallas de barco: se excluyen del análisis de elixir.
- `evolutionLevel` distingue la forma de la carta: 0 normal, 1 evolución, 2 héroe.
- Los niveles usan una escala distinta por rareza: una carta está al máximo cuando `level = maxLevel`.
- El ranking de trofeos de Perú llega vacío: en lo más alto cuenta la Senda de Leyendas, que
  devuelve hasta 1000 jugadores.
- **El mazo del perfil (`currentDeck`) no es fiable** en los jugadores top: muchos dejan
  seleccionado otro mazo para que no les copien el suyo. El mazo real sale de su última
  partida de ranked.
- Las ejecuciones programadas de GitHub Actions no tienen hora garantizada: las de las horas
  en punto se saltaron varias veces, por eso el workflow corre cada hora en un minuto poco
  habitual.

## Hoja de ruta

### Fase 1 — Datos propios
- [x] Ingesta desde la API oficial sin duplicados
- [x] Modelo de datos en PostgreSQL con JSON crudo
- [x] Ingesta automática en la nube (GitHub Actions + Supabase)
- [x] Fotos del ranking de la Senda de Leyendas de Perú y global
- [x] Mazos reales del top
- [x] Control del espacio
- [ ] Importar historial antiguo desde CSV

### Fase 2 — Análisis
- [x] Clasificador de arquetipos rivales
- [x] Winrate por arquetipo, mazo y variante
- [x] Seguimiento de escalones en la Senda de Leyendas
- [ ] Panel personal con inicio de sesión
- [ ] Partidas del top y matriz de enfrentamientos por arquetipo
- [ ] Familias de mazos (variantes de un mismo mazo)
- [ ] Página pública "Senda de Leyendas · Perú"
- [ ] Widget de marcador en vivo para streamers

### Fase 3 — Visión por computadora
- [ ] Reconocer cartas jugadas en repeticiones grabadas
- [ ] Medir intercambios de elixir jugada a jugada

### Fase 4 — Entrenador de decisiones
- [x] Elixir Lab: costes, conteo de elixir y lectura del ciclo
- [ ] Ciclos de evolución
- [ ] Situaciones de partida con respuestas de referencia

## Nota

Este proyecto analiza partidas ya jugadas y entrena habilidades fuera del juego.
No automatiza ni interactúa con Clash Royale.

Elixir Lab es material no oficial y no está respaldado por Supercell. Consulta la
[política de contenido de fans de Supercell](https://www.supercell.com/fan-content-policy).

Desarrollado por **NickolayPaul** ([X](https://x.com/NickolayPaul)).

## Licencia

MIT
