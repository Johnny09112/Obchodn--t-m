-- Kdo co smí.
--
-- Role (rozhodnutí majitele 2026-07-29):
--   super-admin  janlaub@icloud.com     všechno včetně správy uživatelů
--   admin        laub@cantinero.cz      všechno kromě správy uživatelů
--   uzivatel     sasek@, prokop@        prohlížet, kreslit oblasti, chystat kampaně
--
-- **Role se čte z `app_metadata`, ne z `user_metadata`.** To druhé si smí
-- uživatel sám přepsat, takže by se kdokoli mohl povýšit na admina.
--
-- Lokální databáze (PGlite, testy) nemá Supabase Auth, takže `auth.jwt()`
-- tam neexistuje. Migrace to musí přežít — jinak by přestaly fungovat testy
-- bez sítě, což je pravidlo projektu. Řešeno náhradou, která se vytvoří
-- jen tam, kde ta pravá chybí.

do $$
begin
  if to_regnamespace('auth') is null then
    execute 'create schema auth';
  end if;
  -- Pozor: na Supabase tahle funkce existuje a NESMÍ se přepsat.
  if to_regprocedure('auth.jwt()') is null then
    execute $f$
      create function auth.jwt() returns jsonb
      language sql stable as 'select null::jsonb'
    $f$;
  end if;

  -- Role, které Supabase přidává sám. Lokálně chybí, a bez nich by se
  -- pravidla nedala ani zapsat.
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'create role authenticated';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'create role anon';
  end if;
end $$;

/**
 * Role přihlášeného uživatele. Bez přihlášení „host" — ten nesmí nic.
 */
create or replace function public.role_uzivatele() returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'host')
$$;

comment on function public.role_uzivatele() is
  'Role z app_metadata (ne user_metadata — to si uživatel může přepsat sám)';

-- ------------------------------------------------------------- pravidla
--
-- Čtení: kdokoli přihlášený. Kartotéka je pracovní nástroj týmu.
-- Zápis: podle role. Nepřihlášený nevidí nic — RLS bez pravidla zakazuje.

do $$
declare
  t text;
  -- Tabulky, které tým jen prohlíží. Zapisuje do nich agent, ne člověk.
  jen_cteni text[] := array[
    'companies', 'contacts', 'evidence', 'dosah', 'vyrazeni',
    'agent_runs', 'kategorie', 'kategorie_nace', 'kategorie_forma',
    'oblast_firmy', 'system_state'
  ];
  -- Tabulky, se kterými tým pracuje.
  tymove text[] := array['oblasti'];
  -- Tabulky, které mění jen správci — pravidla hry, ne data.
  spravcovske text[] := array['jidelny', 'blacklist', 'profily', 'profil_formy', 'profil_obory'];
begin
  foreach t in array jen_cteni loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_cteni', t);
  end loop;

  foreach t in array tymove loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_cteni', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.role_uzivatele() in (''super-admin'', ''admin'', ''uzivatel''))
         with check (public.role_uzivatele() in (''super-admin'', ''admin'', ''uzivatel''))',
      t || '_zapis', t);
  end loop;

  foreach t in array spravcovske loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_cteni', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.role_uzivatele() in (''super-admin'', ''admin''))
         with check (public.role_uzivatele() in (''super-admin'', ''admin''))',
      t || '_sprava', t);
  end loop;
end $$;

-- `_migrace` zůstává bez pravidel: je to vnitřní evidence schématu,
-- do které nemá přes API sahat vůbec nikdo.
