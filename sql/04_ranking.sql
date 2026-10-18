CREATE TABLE IF NOT EXISTS raw_ranking_snapshots (
    snapshot_at  timestamptz PRIMARY KEY DEFAULT now(),
    location_id  int   NOT NULL,
    payload      jsonb NOT NULL
);

-- una fila por jugador y foto
CREATE OR REPLACE VIEW v_ranking AS
SELECT s.snapshot_at,
       (p->>'rank')::int        AS puesto,
       p->>'tag'                AS tag,
       p->>'name'               AS nombre,
       (p->>'eloRating')::int   AS rating,
       p->'clan'->>'name'       AS clan
FROM raw_ranking_snapshots s,
     jsonb_array_elements(s.payload->'items') AS p;

-- movimiento respecto a la foto anterior
CREATE OR REPLACE VIEW v_ranking_movimiento AS
SELECT *,
       LAG(puesto) OVER (PARTITION BY tag ORDER BY snapshot_at) - puesto AS cambio
FROM v_ranking;