-- Jugadores seguidos y su historial (Supabase). Si nadie renueva un tag en 30 días, la ingesta deja de descargarlo.
create table if not exists public.tracked_players (
  tag           text primary key,          -- sin '#', en mayúsculas
  nombre        text,
  seguido_desde timestamptz not null default now(),
  renovado_at   timestamptz not null default now()
);
alter table public.tracked_players enable row level security;

-- Partidas en formato compacto: solo lo que usan las estadísticas
create table if not exists public.raw_player_battles (
  tag          text not null references public.tracked_players(tag) on delete cascade,
  battle_key   text not null,               -- hora de la partida + tag del rival
  battle_time  timestamptz not null,
  payload      jsonb not null,
  primary key (tag, battle_key)
);
create index if not exists raw_player_battles_tag_time on public.raw_player_battles (tag, battle_time desc);
alter table public.raw_player_battles enable row level security;

create or replace view public.v_tracked_activos with (security_invoker = on) as
select * from public.tracked_players where renovado_at > now() - interval '30 days';
