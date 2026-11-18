-- Pastillero Santos: esquema inicial (modelo de alarmas)
-- Proyecto Supabase: ylhflnfqmeywktasmdda
--
-- Acceso: RLS activado SIN políticas. Solo la secret key (rol service_role),
-- que vive en las funciones de Vercel, puede leer y escribir.
-- La publishable key (anon) no ve nada.

-- ---------------------------------------------------------------------------
-- alarms: cada alarma enciende el LED de un compartimento a una hora y días
-- ---------------------------------------------------------------------------
create table public.alarms (
  id          bigint generated always as identity primary key,
  slot        smallint    not null check (slot between 0 and 4),             -- compartimento 1..5 (LED GPIO 23,19,18,17,16)
  alarm_time  text        not null check (alarm_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),  -- 'HH:MM' hora de Bogotá
  label       text        not null default '' check (char_length(label) <= 40),            -- nombre del medicamento
  days        smallint[]  not null default '{1,2,3,4,5,6,7}'
              check (cardinality(days) between 1 and 7 and days <@ '{1,2,3,4,5,6,7}'::smallint[]),  -- ISO: 1 = lunes ... 7 = domingo
  active      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint alarms_slot_time_unique unique (slot, alarm_time)
);
comment on table public.alarms is 'Alarmas del pastillero. Las crea el portal; el ESP32 las descarga en /api/device/sync.';

-- ---------------------------------------------------------------------------
-- events: historial de lo que pasó en el pastillero
-- ---------------------------------------------------------------------------
create table public.events (
  id          bigint generated always as identity primary key,
  alarm_id    bigint      references public.alarms (id) on delete set null,
  slot        smallint    not null check (slot between 0 and 4),
  type        text        not null check (type in ('triggered', 'silenced', 'missed')),
  device_time text        check (device_time is null or char_length(device_time) <= 32),  -- hora según el ESP32
  created_at  timestamptz not null default now()
);
comment on table public.events is 'triggered = sonó, silenced = tomada (confirmada en el celular), missed = 10 min sin confirmar.';
create index events_created_at_idx on public.events (created_at desc);
create index events_alarm_id_idx on public.events (alarm_id);

-- ---------------------------------------------------------------------------
-- commands: órdenes del portal al ESP32 (por ahora solo silenciar)
-- ---------------------------------------------------------------------------
create table public.commands (
  id          bigint generated always as identity primary key,
  command     text        not null check (command in ('silence')),
  created_at  timestamptz not null default now(),
  consumed_at timestamptz                                                     -- null = pendiente
);
comment on table public.commands is 'Cola de órdenes. Un comando con más de 2 minutos se descarta sin ejecutarse.';
create index commands_pending_idx on public.commands (created_at) where consumed_at is null;

-- ---------------------------------------------------------------------------
-- device_status: una sola fila con el último contacto del ESP32
-- ---------------------------------------------------------------------------
create table public.device_status (
  id           smallint    primary key default 1 check (id = 1),
  last_seen_at timestamptz,
  ringing      boolean     not null default false,
  firmware     text        check (firmware is null or char_length(firmware) <= 40)
);
insert into public.device_status (id) values (1);

-- ---------------------------------------------------------------------------
-- updated_at automático en alarms
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger alarms_set_updated_at
  before update on public.alarms
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seguridad
-- ---------------------------------------------------------------------------
alter table public.alarms        enable row level security;
alter table public.events        enable row level security;
alter table public.commands      enable row level security;
alter table public.device_status enable row level security;

-- Nadie con la publishable key ni usuarios logueados
revoke all on public.alarms, public.events, public.commands, public.device_status from anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Solo las funciones de Vercel (secret key = service_role)
grant select, insert, update, delete on public.alarms, public.events, public.commands, public.device_status to service_role;
grant usage, select on all sequences in schema public to service_role;
