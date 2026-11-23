-- El pastillero pasa de 5 a 4 compartimentos (se quitó el LED naranja, GPIO 16).
-- Compartimentos válidos: 0..3 (LED GPIO 23, 19, 18, 17).

alter table public.alarms drop constraint alarms_slot_check;
alter table public.alarms add constraint alarms_slot_check check (slot between 0 and 3);

alter table public.events drop constraint events_slot_check;
alter table public.events add constraint events_slot_check check (slot between 0 and 3);

comment on column public.alarms.slot is 'Compartimento 0..3 (LED GPIO 23 verde, 19 rojo, 18 azul, 17 amarillo).';
