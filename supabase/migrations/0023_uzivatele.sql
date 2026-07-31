-- Evidence lidí, kteří mají do aplikace přístup.
--
-- K čemu: správce kampaně smí pověřit zástup (migrace 0024) a ten se musí
-- dát vybrat ze seznamu. Vypsat rovnou `auth.users` ale aplikace nesmí —
-- šlo by to jen servisním klíčem, který obchází všechna pravidla přístupu,
-- a ten do programu běžícího v prohlížeči nepatří (kdokoli si ho tam
-- přečte). Držíme proto vlastní opis, ve kterém není žádné tajemství.
--
-- ROLE SE SEM NEKOPÍRUJE. Mění se do `app_metadata` příkazem
-- `cli uzivatel role` a druhý opis by se dřív nebo později rozešel s pravdou.

-- Lokální náhrada Supabase Auth. Stejný postup jako v 0016: na Supabase
-- `auth.users` existuje a NESMÍ se přepsat, lokálně (PGlite, testy) chybí.
do $$
begin
  if to_regnamespace('auth') is null then
    execute 'create schema auth';
  end if;
  if to_regclass('auth.users') is null then
    execute $t$
      create table auth.users (
        id uuid primary key default gen_random_uuid(),
        email text unique
      )
    $t$;
  end if;
end $$;

create table uzivatele (
  id uuid primary key,
  email text not null unique
);

comment on table uzivatele is
  'Opis e-mailů z auth.users, aby šel vybrat zástup správce kampaně. Role se sem nekopíruje — ta žije v app_metadata.';

alter table uzivatele enable row level security;

-- Číst smí každý přihlášený: jsou to lidé, které stejně vidí v kartotéce.
-- Zápis nemá pravidlo ŽÁDNÉ — plní se jen spouští. Kdyby šla evidence měnit
-- přes API, zapsal by si kdokoli cizí e-mail a získal práva k cizí kampani.
create policy uzivatele_cteni on uzivatele
  for select to authenticated using (true);

-- E-mail přihlášeného. Stejný postup jako `role_uzivatele()` v 0016 —
-- čte se z tokenu, ne z tabulky, takže to funguje i v pravidlech přístupu.
create or replace function public.email_uzivatele() returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select auth.jwt() ->> 'email'
$$;

comment on function public.email_uzivatele() is
  'E-mail přihlášeného z tokenu. Bez přihlášení NULL.';

-- Spoušť: nový nebo přejmenovaný účet se propíše do evidence.
create or replace function public.uzivatele_sync() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.uzivatele (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

drop trigger if exists uzivatele_sync on auth.users;
create trigger uzivatele_sync
  after insert or update of email on auth.users
  for each row execute function public.uzivatele_sync();

-- Účty, které vznikly dřív než tahle migrace. Lokálně je náhrada prázdná.
insert into uzivatele (id, email)
select id, email from auth.users where email is not null
on conflict (id) do update set email = excluded.email;
