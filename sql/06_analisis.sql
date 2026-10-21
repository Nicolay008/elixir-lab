-- Análisis de partidas en Supabase: protección, arquetipos rivales y mis mazos.
-- Este archivo refleja el estado de Supabase; no ejecutar en la base local.

-- 1. Tablas de partidas privadas: seguridad activada y sin políticas (solo conexión directa)
alter table public.raw_battles    enable row level security;
alter table public.battles        enable row level security;
alter table public.battle_players enable row level security;
alter table public.battle_cards   enable row level security;
alter table public.cards          enable row level security;
alter table public.battle_notes   enable row level security;
alter table public.pol_anchor     enable row level security;
alter view public.v_partidas set (security_invoker = on);
alter view public.v_escalera set (security_invoker = on);

-- 2. Reglas de arquetipo: carta ancla (y segunda carta opcional) + rango de coste medio.
--    Menor prioridad = se aplica antes; a igual prioridad, gana la combinación de dos cartas.
create table if not exists public.archetype_rules (
  id          serial primary key,
  card_name   text    not null,
  card_name_2 text,
  arquetipo   text    not null,
  prioridad   int     not null,
  elixir_min  numeric,
  elixir_max  numeric
);
alter table public.archetype_rules enable row level security;

insert into public.archetype_rules (card_name, card_name_2, arquetipo, prioridad, elixir_min, elixir_max) values
  ('X-Bow',null,'Asedio',1,null,null), ('Mortar',null,'Asedio',1,null,null),
  ('Giant','Graveyard','Gigante Cementerio',2,null,null),
  ('Golem',null,'Beatdown',3,null,null), ('Giant',null,'Beatdown',3,null,null), ('Electro Giant',null,'Beatdown',3,null,null),
  ('Lava Hound',null,'Beatdown',3,null,null), ('Elixir Golem',null,'Beatdown',3,null,null), ('Goblin Giant',null,'Beatdown',3,null,null),
  ('Royal Giant',null,'Gigante real',4,null,null), ('Graveyard',null,'Cementerio',4,null,null), ('Balloon',null,'Globo',4,null,null),
  ('Battle Ram',null,'Bridge spam',5,null,null), ('Bandit',null,'Bridge spam',5,null,null), ('Royal Ghost',null,'Bridge spam',5,null,null),
  ('P.E.K.K.A',null,'Bridge spam',5,null,null), ('Ram Rider',null,'Bridge spam',5,null,null),
  ('Goblin Barrel','Hog Rider','Bait con Montapuercos',6,null,null),
  ('Goblin Barrel',null,'Bait',7,null,null),
  ('Hog Rider',null,'Ciclo de Montapuercos',8,null,3.6), ('Hog Rider',null,'Montapuercos pesado',8,3.6,null),
  ('Royal Hogs',null,'Cerdos reales',8,null,null), ('Goblin Drill',null,'Taladro',8,null,null),
  ('Miner',null,'Control con Minero',9,null,null),
  ('Mega Knight',null,'Control con Megacaballero',10,null,null);

-- 3. Amenazas que se vigilan aparte del arquetipo
create table if not exists public.watched_cards (
  card_name text primary key,
  etiqueta  text not null
);
alter table public.watched_cards enable row level security;
insert into public.watched_cards values ('Mega Knight','Megacaballero') on conflict do nothing;

-- 4. Mazo rival por partida: coste medio, arquetipo, amenazas, carta más cara y formas (Evo / Héroe)
create or replace view public.v_mazos_rivales with (security_invoker = on) as
with m as (
  select bc.battle_id,
         array_agg(c.name order by bc.slot) as cartas,
         round(avg(c.elixir_cost)::numeric, 1) as elixir_medio,
         string_agg(c.name || case bc.evolution_level when 1 then ' (Evo)' when 2 then ' (Héroe)' else '' end,
                    ', ' order by bc.slot) as mazo_forma,
         count(*) filter (where bc.evolution_level = 1) as n_evo,
         count(*) filter (where bc.evolution_level = 2) as n_heroe
  from public.battle_cards bc join public.cards c on c.card_id = bc.card_id
  where bc.side = 'opponent'
  group by bc.battle_id
)
select m.battle_id, m.cartas, m.elixir_medio,
  coalesce((
    select r.arquetipo from public.archetype_rules r
    where r.card_name = any(m.cartas)
      and (r.card_name_2 is null or r.card_name_2 = any(m.cartas))
      and (r.elixir_min is null or m.elixir_medio >= r.elixir_min)
      and (r.elixir_max is null or m.elixir_medio <  r.elixir_max)
    order by r.prioridad, (r.card_name_2 is null) limit 1
  ), case when m.elixir_medio <= 3.0 then 'Ciclo (otro)' else 'Otros' end) as arquetipo,
  (select string_agg(w.etiqueta, ', ') from public.watched_cards w where w.card_name = any(m.cartas)) as amenazas,
  (select c.name || ' (' || c.elixir_cost || ')'
     from public.battle_cards bc join public.cards c on c.card_id = bc.card_id
     where bc.battle_id = m.battle_id and bc.side = 'opponent'
     order by c.elixir_cost desc nulls last limit 1) as carta_mas_cara,
  m.mazo_forma,
  nullif(concat_ws(' · ',
    case when m.n_evo   > 0 then m.n_evo   || ' Evo' end,
    case when m.n_heroe > 0 then m.n_heroe || ' Héroe' end), '') as formas
from m;

-- 5. Partidas con el arquetipo del rival
create or replace view public.v_partidas_arquetipo with (security_invoker = on) as
select b.battle_time, b.type, me.crowns > op.crowns as victoria, me.elixir_leaked,
       v.arquetipo, v.amenazas, v.elixir_medio, v.mazo_forma as mazo,
       v.carta_mas_cara, v.formas
from public.battles b
join public.battle_players me on me.battle_id = b.battle_id and me.side = 'me'
join public.battle_players op on op.battle_id = b.battle_id and op.side = 'opponent'
join public.v_mazos_rivales v on v.battle_id = b.battle_id;

-- 6. Mis mazos: firma estable (cartas ordenadas + forma), nombres y resumen
create or replace view public.v_mi_mazo with (security_invoker = on) as
select bc.battle_id,
       string_agg(c.name || case bc.evolution_level when 1 then ' (Evo)' when 2 then ' (Héroe)' else '' end,
                  ', ' order by c.name) as firma
from public.battle_cards bc join public.cards c on c.card_id = bc.card_id
where bc.side = 'me'
group by bc.battle_id;

create table if not exists public.deck_labels (
  firma  text primary key,
  nombre text not null
);
alter table public.deck_labels enable row level security;

insert into public.deck_labels (firma, nombre) values
 ('Barbarian Barrel (Héroe), Electro Spirit, Fireball, Fisherman, Hunter, Royal Ghost (Evo), Royal Giant (Evo), Skeletons','RG Fantasma'),
 ('Electro Spirit, Fireball, Fisherman, Hunter (Evo), Monk, Royal Giant (Evo), Skeletons, The Log','RG Monje Esqueletos'),
 ('Electro Spirit, Fireball, Fisherman, Guards, Hunter (Evo), Monk, Royal Giant (Evo), The Log','RG Monje Guardias')
on conflict (firma) do update set nombre = excluded.nombre;

create or replace view public.v_mis_mazos with (security_invoker = on) as
select m.firma, l.nombre, count(*) as partidas,
       min(b.battle_time) as desde, max(b.battle_time) as hasta
from public.v_mi_mazo m
join public.battles b on b.battle_id = m.battle_id
left join public.deck_labels l on l.firma = m.firma
where b.type not in ('boatBattle','riverRaceDuel')
group by m.firma, l.nombre;
