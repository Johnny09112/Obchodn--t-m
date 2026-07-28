-- Zamknout tabulky před veřejným API.
--
-- V Supabase je schéma `public` vystavené přes datové API. Bez zapnutého
-- řízení přístupu (RLS) by si kdokoli s veřejným klíčem projektu mohl
-- stáhnout celou kartotéku — včetně tabulky `contacts`, kde jsou jména,
-- e-maily a telefony konkrétních lidí. Kontrola Supabase to hlásila jako
-- chybu u 28 tabulek.
--
-- Zapínáme RLS BEZ pravidel, což znamená „nikdo zvenčí nesmí nic".
-- Náš vlastní přístup to neomezí: připojujeme se jako vlastník tabulek
-- a ten RLS obchází. Frontend dostane výslovná pravidla, až bude jasné,
-- kdo co smí — vymýšlet je dopředu by znamenalo hádat.
--
-- Platí i pro lokální databázi. Tam je to bez účinku (jsme vlastník),
-- ale schéma musí být na obou stranách stejné.

do $$
declare t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- Funkce bez pevně daného vyhledávacího seznamu jde zneužít podstrčením
-- vlastní tabulky. Tahle sahá jen na `now()` z pg_catalog, takže prázdný
-- seznam ničemu nevadí.
alter function public.nastav_updated_at() set search_path = '';
