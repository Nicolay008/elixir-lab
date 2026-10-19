CREATE TABLE IF NOT EXISTS pol_anchor (
    anchor_at  timestamptz PRIMARY KEY DEFAULT now(),
    league     int NOT NULL,
    step       int NOT NULL
);

-- tu recorrido en ranked, partida a partida, desde el último punto de partida
CREATE OR REPLACE VIEW v_escalera AS
WITH RECURSIVE a AS (
    SELECT anchor_at, league, step FROM pol_anchor ORDER BY anchor_at DESC LIMIT 1
), b AS (
    SELECT p.battle_time, p.victoria,
           row_number() OVER (ORDER BY p.battle_time) AS n
    FROM v_partidas p, a
    WHERE p.type = 'pathOfLegend' AND p.battle_time > a.anchor_at
), r AS (
    SELECT 0::bigint AS n, a.anchor_at AS battle_time, NULL::boolean AS victoria,
           a.league, a.step
    FROM a
    UNION ALL
    SELECT b.n, b.battle_time, b.victoria,
           CASE WHEN b.victoria AND r.step = 10 THEN r.league + 1 ELSE r.league END,
           CASE WHEN b.victoria THEN CASE WHEN r.step = 10 THEN 1 ELSE r.step + 1 END
                ELSE GREATEST(1, r.step - 1) END
    FROM r JOIN b ON b.n = r.n + 1
)
SELECT n AS partida, battle_time, victoria, league AS liga, step AS escalon FROM r;