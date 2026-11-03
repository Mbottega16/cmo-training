-- CMO Training backend for Supabase (free plan).
-- Run this whole file once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: it only creates what is missing and replaces functions/policies.
--
-- Every rule that involves credits, time or roles runs here, on the server, with the server's clock.
-- The browser can't change them. The same rules run in the demo (src/logic.ts); tests/sql.test.ts checks they agree.

-- 1. The owner's e-mail. The account that signs up with this address becomes the "dev" (full control).
create table if not exists public.app_config (
  id int primary key default 1 check (id = 1),
  owner_email text not null
);
insert into public.app_config (id, owner_email) values (1, 'CHANGE-ME@example.com') on conflict (id) do nothing;
-- Then run (with your address):  update public.app_config set owner_email = 'you@example.com';

-- 2. Tables -----------------------------------------------------------------------------------------------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  late_cancel_hours int not null default 6 check (late_cancel_hours between 0 and 168),
  grace_hours int not null default 24 check (grace_hours between 0 and 336),
  late_spot text not null default 'refill' check (late_spot in ('refill', 'lock')),
  check_in_xp int not null default 50 check (check_in_xp between 0 and 1000),
  check_in_opens_minutes int not null default 30 check (check_in_opens_minutes between 0 and 1440),
  check_in_closes_hours int not null default 12 check (check_in_closes_hours between 0 and 168)
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.players (
  id text primary key default ('p_' || replace(gen_random_uuid()::text, '-', '')),
  name text not null check (length(name) between 1 and 80),
  level text not null default '' check (length(level) <= 80),
  focus_areas text[] not null default '{}',
  credits int not null default 0 check (credits >= 0),
  xp int not null default 0 check (xp >= 0),
  phone text not null default '' check (length(phone) <= 40),
  email text not null default '' check (length(email) <= 120),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  role text not null default 'pending' check (role in ('dev', 'coach', 'athlete', 'pending')),
  player_id text unique references public.players (id) on delete set null
);

create table if not exists public.invites (
  code text primary key,
  role text not null check (role in ('coach', 'athlete')),
  player_id text references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  check (role = 'coach' or player_id is not null)
);

create table if not exists public.sessions (
  id text primary key default ('s_' || replace(gen_random_uuid()::text, '-', '')),
  title text not null check (length(title) between 1 and 120),
  court_location text not null default '' check (length(court_location) <= 120),
  court_address text not null default '' check (length(court_address) <= 200),
  start_at timestamptz not null,
  end_at timestamptz not null,
  type text not null check (type in ('one_on_one', 'small_group', 'virtual_live')),
  max_capacity int not null check (max_capacity between 1 and 50),
  price numeric not null default 0 check (price >= 0),
  check (end_at > start_at)
);

create table if not exists public.bookings (
  id text primary key default ('b_' || replace(gen_random_uuid()::text, '-', '')),
  session_id text not null references public.sessions (id) on delete cascade,
  player_id text not null references public.players (id) on delete cascade,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled_early', 'cancelled_late', 'excused', 'forfeited')),
  attendance text not null default 'pending' check (attendance in ('pending', 'present', 'absent')),
  booked_at timestamptz not null default now(),
  cancelled_at timestamptz,
  grace_expires_at timestamptz,
  hours_notice_at_cancel numeric,
  confirmed_at_cancel int,
  decided_at timestamptz,
  decision_reason text check (decision_reason in ('coach', 'expired', 'refilled'))
);
create unique index if not exists bookings_one_active on public.bookings (session_id, player_id) where status = 'confirmed';
create index if not exists bookings_session on public.bookings (session_id);

create table if not exists public.homework (
  id text primary key default ('hw_' || replace(gen_random_uuid()::text, '-', '')),
  player_id text not null references public.players (id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  category text not null default '' check (length(category) <= 60),
  reps_or_minutes text not null default '' check (length(reps_or_minutes) <= 60),
  notes text not null default '' check (length(notes) <= 400),
  assigned_at timestamptz not null default now(),
  completed boolean not null default false
);

create table if not exists public.films (
  id text primary key,
  player_id text not null references public.players (id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  video_url text,
  video_key text,
  uploaded_at timestamptz not null default now(),
  notes jsonb not null default '[]',
  voice_notes jsonb not null default '[]',
  drawings jsonb not null default '[]'
);

create table if not exists public.coach_notes (
  id text primary key default ('c_' || replace(gen_random_uuid()::text, '-', '')),
  player_id text not null references public.players (id) on delete cascade,
  text text not null check (length(text) between 1 and 300),
  created_at timestamptz not null default now()
);

create table if not exists public.notify_prefs (
  player_id text primary key references public.players (id) on delete cascade,
  sms boolean not null default true,
  email boolean not null default true,
  push boolean not null default true
);

-- 3. Who is asking --------------------------------------------------------------------------------------
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where user_id = auth.uid()), 'anon');
$$;

create or replace function public.my_player_id() returns text
language sql stable security definer set search_path = public as $$
  select player_id from public.profiles where user_id = auth.uid();
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.app_role() in ('coach', 'dev');
$$;

-- New accounts start as 'pending' until they enter an invite code. The owner's address becomes 'dev'.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, role)
  values (
    new.id,
    coalesce(new.email, ''),
    case when lower(coalesce(new.email, '')) = (select lower(owner_email) from public.app_config where id = 1) then 'dev' else 'pending' end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public._result(p_ok boolean, p_message text) returns json
language sql immutable as $$ select json_build_object('ok', p_ok, 'message', p_message); $$;

-- 4. The rules (same as src/logic.ts) --------------------------------------------------------------------

-- 'refill' mode: newcomers fill empty spots first. Only once a session is fuller than it could be without the late
-- cancels was a late canceller's spot really needed; then refund them oldest first, one per needed spot. Coach-waived
-- late cancels count as already refunded. Internal: not callable from the app.
create or replace function public._refund_refilled(p_session text) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_settings public.settings;
  v_session public.sessions;
  v_confirmed int;
  v_late int;
  v_excused int;
  v_due int;
  r record;
  v_n int := 0;
begin
  select * into v_settings from public.settings where id = 1;
  if v_settings.late_spot <> 'refill' then return 0; end if;
  select * into v_session from public.sessions where id = p_session;
  if v_session.id is null or now() >= v_session.start_at then return 0; end if;
  select count(*) filter (where status = 'confirmed'),
         count(*) filter (where status in ('cancelled_late', 'forfeited', 'excused')),
         count(*) filter (where status = 'excused')
    into v_confirmed, v_late, v_excused
  from public.bookings where session_id = p_session;
  v_due := greatest(0, v_confirmed - (v_session.max_capacity - v_late)) - v_excused;
  for r in
    select * from public.bookings
    where session_id = p_session and status in ('cancelled_late', 'forfeited')
    order by cancelled_at
  loop
    exit when v_due <= 0;
    update public.bookings set status = 'excused', decided_at = now(), decision_reason = 'refilled' where id = r.id;
    update public.players set credits = credits + 1 where id = r.player_id;
    v_n := v_n + 1;
    v_due := v_due - 1;
  end loop;
  return v_n;
end;
$$;

create or replace function public.book_session(p_session_id text, p_player_id text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.app_role();
  v_player text;
  v_session public.sessions;
  v_settings public.settings;
  v_credits int;
  v_name text;
  v_spots int;
  v_refunded int;
begin
  if v_role in ('coach', 'dev') then
    v_player := coalesce(p_player_id, public.my_player_id());
  elsif v_role = 'athlete' then
    v_player := public.my_player_id();
    if p_player_id is not null and p_player_id is distinct from v_player then
      return public._result(false, 'You can only book for yourself.');
    end if;
  else
    return public._result(false, 'Sign in first.');
  end if;

  select * into v_settings from public.settings where id = 1;
  select * into v_session from public.sessions where id = p_session_id for update; -- one booking at a time per session
  select name, credits into v_name, v_credits from public.players where id = v_player for update;
  if v_session.id is null or v_name is null then return public._result(false, 'That session or athlete no longer exists.'); end if;
  if now() >= v_session.start_at then return public._result(false, 'That session has already started.'); end if;
  if exists (select 1 from public.bookings where session_id = p_session_id and player_id = v_player and status = 'confirmed') then
    return public._result(false, v_name || ' is already booked for this session.');
  end if;
  select v_session.max_capacity - count(*) into v_spots from public.bookings
  where session_id = p_session_id
    and (status = 'confirmed' or (v_settings.late_spot = 'lock' and status in ('cancelled_late', 'forfeited')));
  if v_spots <= 0 then return public._result(false, 'That session is full.'); end if;
  if v_credits < 1 then return public._result(false, 'No session credits left. Ask Coach to add credits.'); end if;

  insert into public.bookings (session_id, player_id) values (p_session_id, v_player);
  update public.players set credits = credits - 1 where id = v_player;
  v_refunded := public._refund_refilled(p_session_id);
  return public._result(true, 'Booked ' || v_session.title || '. 1 credit used.' ||
    case when v_refunded > 0 then ' That filled a late-cancelled spot.' else '' end);
end;
$$;

create or replace function public.cancel_booking(p_booking_id text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.app_role();
  b public.bookings;
  v_start timestamptz;
  v_settings public.settings;
  v_hours numeric;
  v_confirmed int;
begin
  if v_role not in ('athlete', 'coach', 'dev') then return public._result(false, 'Sign in first.'); end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null or b.status <> 'confirmed' then return public._result(false, 'That booking is not active.'); end if;
  if v_role = 'athlete' and b.player_id is distinct from public.my_player_id() then
    return public._result(false, 'That is not your booking.');
  end if;
  select start_at into v_start from public.sessions where id = b.session_id for update;
  select * into v_settings from public.settings where id = 1;
  v_hours := extract(epoch from (v_start - now())) / 3600;
  if v_hours <= 0 then return public._result(false, 'The session has started, so it can no longer be cancelled.'); end if;

  if v_hours >= v_settings.late_cancel_hours then
    update public.bookings set status = 'cancelled_early', cancelled_at = now(), hours_notice_at_cancel = round(v_hours, 1) where id = b.id;
    update public.players set credits = credits + 1 where id = b.player_id;
    return public._result(true, 'Cancelled with ' || round(v_hours, 1) || ' hours'' notice. Your credit is back.');
  end if;

  select count(*) into v_confirmed from public.bookings where session_id = b.session_id and status = 'confirmed';
  update public.bookings
  set status = 'cancelled_late', cancelled_at = now(), grace_expires_at = now() + make_interval(hours => v_settings.grace_hours),
      hours_notice_at_cancel = round(v_hours, 1), confirmed_at_cancel = v_confirmed
  where id = b.id;
  return public._result(true, 'Late cancel (' || round(v_hours, 1) || ' hours'' notice). The credit is held for ' || v_settings.grace_hours ||
    ' hours while Coach reviews it.' ||
    case when v_settings.late_spot = 'refill' then ' If the session fills back up, you get it back automatically.' else '' end);
end;
$$;

create or replace function public.waive_late_cancel(p_booking_id text) returns json
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  if not public.is_staff() then return public._result(false, 'Only Coach can waive a late cancel.'); end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null or b.status <> 'cancelled_late' then return public._result(false, 'Only a pending late cancel can be waived.'); end if;
  update public.bookings set status = 'excused', decided_at = now(), decision_reason = 'coach' where id = b.id;
  update public.players set credits = credits + 1 where id = b.player_id;
  return public._result(true, 'Waived. The credit is restored.');
end;
$$;

create or replace function public.enforce_late_cancel(p_booking_id text) returns json
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  if not public.is_staff() then return public._result(false, 'Only Coach can enforce a late cancel.'); end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null or b.status <> 'cancelled_late' then return public._result(false, 'Only a pending late cancel can be enforced.'); end if;
  update public.bookings set status = 'forfeited', decided_at = now(), decision_reason = 'coach' where id = b.id;
  return public._result(true, 'Enforced. The credit stays used.');
end;
$$;

-- Late cancels whose grace window has run out become forfeits. Runs every 5 minutes (pg_cron) and on app load.
create or replace function public._expire_grace_all() returns int
language sql security definer set search_path = public as $$
  with done as (
    update public.bookings set status = 'forfeited', decided_at = grace_expires_at, decision_reason = 'expired'
    where status = 'cancelled_late' and grace_expires_at <= now()
    returning 1
  )
  select count(*)::int from done;
$$;

create or replace function public.expire_grace() returns json
language plpgsql security definer set search_path = public as $$
begin
  if public.app_role() = 'anon' then return public._result(false, 'Sign in first.'); end if;
  perform public._expire_grace_all();
  return public._result(true, '');
end;
$$;

create or replace function public.set_attendance(p_booking_id text, p_attendance text) returns json
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  s public.sessions;
  v_settings public.settings;
  v_delta int;
begin
  if not public.is_staff() then return public._result(false, 'Only Coach can check athletes in.'); end if;
  if p_attendance not in ('pending', 'present', 'absent') then return public._result(false, 'Unknown attendance.'); end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null or b.status <> 'confirmed' then return public._result(false, 'That booking is not active.'); end if;
  if b.attendance = p_attendance then return public._result(true, ''); end if;
  select * into s from public.sessions where id = b.session_id;
  select * into v_settings from public.settings where id = 1;
  if now() < s.start_at - make_interval(mins => v_settings.check_in_opens_minutes)
     or now() > s.end_at + make_interval(hours => v_settings.check_in_closes_hours) then
    return public._result(false, 'Check-in is not open for this session.');
  end if;
  v_delta := (case when p_attendance = 'present' then v_settings.check_in_xp else 0 end)
           - (case when b.attendance = 'present' then v_settings.check_in_xp else 0 end);
  update public.bookings set attendance = p_attendance where id = b.id;
  update public.players set xp = greatest(0, xp + v_delta) where id = b.player_id;
  return public._result(true, '');
end;
$$;

create or replace function public.toggle_homework(p_id text) returns json
language plpgsql security definer set search_path = public as $$
declare h public.homework;
begin
  select * into h from public.homework where id = p_id for update;
  if h.id is null then return public._result(false, 'That drill no longer exists.'); end if;
  if not public.is_staff() and h.player_id is distinct from public.my_player_id() then return public._result(false, 'That is not your drill.'); end if;
  update public.homework set completed = not completed where id = p_id;
  return public._result(true, '');
end;
$$;

create or replace function public.set_notify_prefs(p_player_id text, p_sms boolean, p_email boolean, p_push boolean) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() and p_player_id is distinct from public.my_player_id() then return public._result(false, 'Not allowed.'); end if;
  insert into public.notify_prefs (player_id, sms, email, push) values (p_player_id, p_sms, p_email, p_push)
  on conflict (player_id) do update set sms = excluded.sms, email = excluded.email, push = excluded.push;
  return public._result(true, '');
end;
$$;

create or replace function public.adjust_credits(p_player_id text, p_delta int) returns json
language plpgsql security definer set search_path = public as $$
declare v_name text; v_credits int;
begin
  if not public.is_staff() then return public._result(false, 'Only Coach can change credits.'); end if;
  if p_delta not between -500 and 500 then return public._result(false, 'Change credits by at most 500 at a time.'); end if;
  update public.players set credits = greatest(0, credits + p_delta) where id = p_player_id returning name, credits into v_name, v_credits;
  if v_name is null then return public._result(false, 'That athlete no longer exists.'); end if;
  return public._result(true, v_name || ': ' || v_credits || ' credits.');
end;
$$;

-- Deleting a session gives every athlete who still holds a credit for it their credit back.
create or replace function public.delete_session(p_session_id text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then return public._result(false, 'Only Coach can delete sessions.'); end if;
  update public.players p set credits = p.credits + x.n
  from (select player_id, count(*)::int as n from public.bookings
        where session_id = p_session_id and status in ('confirmed', 'cancelled_late') group by player_id) x
  where p.id = x.player_id;
  delete from public.sessions where id = p_session_id;
  return public._result(true, 'Session deleted. Booked athletes got their credits back.');
end;
$$;

-- Athletes can't see each other's bookings, so spots left come from here.
create or replace function public.spots_left() returns table (session_id text, spots int)
language sql stable security definer set search_path = public as $$
  select s.id, s.max_capacity - count(b.id)::int
  from public.sessions s
  cross join public.settings st
  left join public.bookings b on b.session_id = s.id
    and (b.status = 'confirmed' or (st.late_spot = 'lock' and b.status in ('cancelled_late', 'forfeited')))
  where st.id = 1 and public.app_role() <> 'anon'
  group by s.id, s.max_capacity;
$$;

-- 5. Accounts and invites -------------------------------------------------------------------------------
create or replace function public.create_invite(p_role text, p_player_id text default null) returns json
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if p_role = 'coach' and public.app_role() <> 'dev' then return json_build_object('error', 'Only the owner can invite a coach.'); end if;
  if p_role = 'athlete' and not public.is_staff() then return json_build_object('error', 'Only Coach can invite athletes.'); end if;
  if p_role not in ('coach', 'athlete') then return json_build_object('error', 'Unknown role.'); end if;
  if p_role = 'athlete' and not exists (select 1 from public.players where id = p_player_id) then return json_build_object('error', 'Pick an athlete first.'); end if;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.invites (code, role, player_id) values (v_code, p_role, case when p_role = 'athlete' then p_player_id end);
  return json_build_object('code', v_code);
end;
$$;

create or replace function public.claim_invite(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare i public.invites;
begin
  if auth.uid() is null then return public._result(false, 'Sign in first.'); end if;
  select * into i from public.invites where code = upper(trim(p_code)) for update;
  if i.code is null or i.used_by is not null then return public._result(false, 'That invite code is not valid or was already used.'); end if;
  if public.app_role() = 'dev' then return public._result(false, 'The owner account does not need an invite.'); end if;
  update public.profiles set role = i.role, player_id = case when i.role = 'athlete' then i.player_id else null end where user_id = auth.uid();
  update public.invites set used_by = auth.uid(), used_at = now() where code = i.code;
  return public._result(true, 'Welcome! Your account is ready.');
end;
$$;

create or replace function public.set_role(p_user_id uuid, p_role text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if public.app_role() <> 'dev' then return public._result(false, 'Only the owner can change roles.'); end if;
  if p_role not in ('coach', 'athlete', 'pending') then return public._result(false, 'Unknown role.'); end if;
  if p_user_id = auth.uid() then return public._result(false, 'You can''t change your own role.'); end if;
  update public.profiles set role = p_role, player_id = case when p_role = 'athlete' then player_id else null end where user_id = p_user_id;
  return public._result(true, 'Role updated.');
end;
$$;

-- 6. Row-level security: who can read and write what -----------------------------------------------------
alter table public.app_config enable row level security;
alter table public.settings enable row level security;
alter table public.players enable row level security;
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.sessions enable row level security;
alter table public.bookings enable row level security;
alter table public.homework enable row level security;
alter table public.films enable row level security;
alter table public.coach_notes enable row level security;
alter table public.notify_prefs enable row level security;

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to authenticated using (true);
drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists players_read on public.players;
create policy players_read on public.players for select to authenticated using (public.is_staff() or id = public.my_player_id());
drop policy if exists players_insert on public.players;
create policy players_insert on public.players for insert to authenticated with check (public.is_staff());
drop policy if exists players_update on public.players;
create policy players_update on public.players for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists players_delete on public.players;
create policy players_delete on public.players for delete to authenticated using (public.is_staff());

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (user_id = auth.uid() or public.is_staff());

drop policy if exists invites_read on public.invites;
create policy invites_read on public.invites for select to authenticated using (public.is_staff());

drop policy if exists sessions_read on public.sessions;
create policy sessions_read on public.sessions for select to authenticated using (true);
drop policy if exists sessions_insert on public.sessions;
create policy sessions_insert on public.sessions for insert to authenticated with check (public.is_staff());
drop policy if exists sessions_update on public.sessions;
create policy sessions_update on public.sessions for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists bookings_read on public.bookings;
create policy bookings_read on public.bookings for select to authenticated using (public.is_staff() or player_id = public.my_player_id());

drop policy if exists homework_read on public.homework;
create policy homework_read on public.homework for select to authenticated using (public.is_staff() or player_id = public.my_player_id());
drop policy if exists homework_insert on public.homework;
create policy homework_insert on public.homework for insert to authenticated with check (public.is_staff());
drop policy if exists homework_delete on public.homework;
create policy homework_delete on public.homework for delete to authenticated using (public.is_staff());

drop policy if exists films_read on public.films;
create policy films_read on public.films for select to authenticated using (public.is_staff() or player_id = public.my_player_id());
drop policy if exists films_insert on public.films;
create policy films_insert on public.films for insert to authenticated with check (public.is_staff());
drop policy if exists films_update on public.films;
create policy films_update on public.films for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists films_delete on public.films;
create policy films_delete on public.films for delete to authenticated using (public.is_staff());

drop policy if exists coach_notes_all on public.coach_notes;
create policy coach_notes_all on public.coach_notes for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists notify_read on public.notify_prefs;
create policy notify_read on public.notify_prefs for select to authenticated using (public.is_staff() or player_id = public.my_player_id());

-- Functions the app may call. Internal helpers are not callable from outside.
revoke execute on function public._refund_refilled(text) from public, anon, authenticated;
revoke execute on function public._expire_grace_all() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 7. File storage: films/<athlete id>/... and memos/<athlete id>/... (free plan: 50 MB per file, 1 GB total)
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 52428800)
on conflict (id) do nothing;

drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects for select to authenticated
  using (bucket_id = 'media' and (public.is_staff() or (storage.foldername(name))[2] = public.my_player_id()));
drop policy if exists media_insert on storage.objects;
create policy media_insert on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_staff());
drop policy if exists media_update on storage.objects;
create policy media_update on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_staff());
drop policy if exists media_delete on storage.objects;
create policy media_delete on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_staff());

-- 8. Live updates and private video-call signalling -------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.players, public.sessions, public.bookings, public.homework,
    public.films, public.coach_notes, public.notify_prefs, public.settings;
exception when others then
  raise notice 'Realtime publication not changed (%). Re-running is fine.', sqlerrm;
end $$;

-- Call channels are named call-<athlete id>: the athlete and staff may use theirs, nobody else.
do $$
begin
  execute 'drop policy if exists call_signal_read on realtime.messages';
  execute $p$create policy call_signal_read on realtime.messages for select to authenticated
    using (realtime.topic() like 'call-%' and (public.is_staff() or realtime.topic() = 'call-' || public.my_player_id()))$p$;
  execute 'drop policy if exists call_signal_write on realtime.messages';
  execute $p$create policy call_signal_write on realtime.messages for insert to authenticated
    with check (realtime.topic() like 'call-%' and (public.is_staff() or realtime.topic() = 'call-' || public.my_player_id()))$p$;
exception when others then
  raise notice 'Realtime call policies not created (%).', sqlerrm;
end $$;

-- 9. Expire grace windows every 5 minutes even when nobody has the app open (Supabase Cron, free).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('cmo-expire-grace') where exists (select 1 from cron.job where jobname = 'cmo-expire-grace');
  perform cron.schedule('cmo-expire-grace', '*/5 * * * *', 'select public._expire_grace_all()');
exception when others then
  raise notice 'pg_cron not available (%); grace windows expire whenever the app is opened.', sqlerrm;
end $$;
