-- Ranking de Senda de Leyendas (Perú y global) — esquema de Supabase.
-- location_id: id de la API para países (Perú = 57000184); 0 = ranking global.

create table if not exists public.raw_ranking_snapshots (
  snapshot_at  timestamptz not null default now(),
  location_id  int         not null,
  payload      jsonb       not null,
  primary key (snapshot_at, location_id)
);

-- Seguridad: lectura pública, escritura solo desde la ingesta (conexión directa)
alter table public.raw_ranking_snapshots enable row level security;
create policy "lectura publica del ranking"
  on public.raw_ranking_snapshots for select
  to anon, authenticated using (true);

-- Una fila por jugador y foto
create or replace view public.v_ranking with (security_invoker = on) as
select s.snapshot_at,
       s.location_id,
       (p->>'rank')::int      as puesto,
       p->>'tag'              as tag,
       p->>'name'             as nombre,
       (p->>'eloRating')::int as rating,
       p->'clan'->>'name'     as clan
from public.raw_ranking_snapshots s,
     jsonb_array_elements(s.payload->'items') as p;

-- Movimiento respecto a la foto anterior y su motivo
create or replace view public.v_ranking_movimiento with (security_invoker = on) as
select snapshot_at, location_id, puesto, tag, nombre, rating, clan,
       cambio_puesto as cambio,
       cambio_rating,
       case
         when cambio_puesto is null then 'nuevo'
         when cambio_puesto < 0 and cambio_rating < 0 then 'perdió partidas'
         when cambio_puesto < 0 and cambio_rating > 0 then 'le adelantaron'
         when cambio_puesto < 0 then 'no jugó'
         when cambio_puesto > 0 and cambio_rating > 0 then 'ganó partidas'
         when cambio_puesto > 0 then 'otros cayeron'
         when cambio_rating > 0 then 'ganó y mantiene puesto'
         when cambio_rating < 0 then 'perdió y mantiene puesto'
         else 'no jugó'
       end as motivo
from (
  select *,
         lag(puesto) over w - puesto as cambio_puesto,
         rating - lag(rating) over w as cambio_rating
  from public.v_ranking
  window w as (partition by location_id, tag order by snapshot_at)
) t;