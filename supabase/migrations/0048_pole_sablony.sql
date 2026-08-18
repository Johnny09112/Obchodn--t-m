-- Pole šablony a jejich nastavení u kampaně.
--
-- Rozhodl majitel 18. 8. 2026: „Nastavení parametrů e-mailů musí být
-- principielně vždy ke kampani. Mohu si vybrat šablonu, ale reálně mohu
-- mít vícero produktů a každý zaměřovat a specifikovat zvlášť pro danou
-- oblast." Šablona je tedy společná, nastavení polí patří kampani — dvě
-- kampaně nad týmž územím můžou říkat jiné věci, aniž by se přepsaly.

create table pole_sablony (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  kod text not null,
  nazev text not null,
  -- Chybí-li povinné pole, firma se do kampaně nezahrne (rozhodnutí
  -- majitele 18. 8.). Nepovinné pole má náhradu — dnes jen oslovení,
  -- kterému se doplní „Dobrý den,".
  povinne boolean not null default true,
  poradi int not null default 0,
  unique (template_id, kod)
);

comment on table pole_sablony is
  'Zástupné údaje v šabloně. Vznikají z jejího textu, neudržují se ručně.';

create table nastaveni_pole (
  kampan_id uuid not null references kampane(id) on delete cascade,
  pole_id uuid not null references pole_sablony(id) on delete cascade,
  rezim text not null check (rezim in ('z_dat', 'pevne', 'vynechat')),
  -- U 'z_dat' kód zdroje, u 'pevne' text platný pro celou kampaň.
  hodnota text,
  primary key (kampan_id, pole_id)
);

alter table kampane add column template_id uuid references templates(id);

-- Pátý krok průvodce: Zpráva.
alter table kampane drop constraint kampane_krok_check;
alter table kampane add constraint kampane_krok_check check (krok between 1 and 5);

-- Pole se zakládají ze zástupných údajů v textu šablony.
--
-- Jediná funkce, kterou volá spoušť i zpětné doplnění — kdyby to byly dvě
-- cesty, rozejdou se (past „tri-kopie-seznamu-atributu"). A spoušť proto,
-- že bez ní by vznikla šablona bez polí a ta by se tiše vyplnila prázdnem.
--
-- Pořadí pole = kde v textu stojí. Tím sedí pořadí na obrazovce s pořadím
-- ve zprávě a nikdo ho nemusí udržovat.
create or replace function public.zaloz_pole_sablony_pro(p_template_id uuid, p_telo text)
returns void language plpgsql as $$
declare
  nalez text;
  nazvy jsonb := '{
    "osloveni": "Oslovení",
    "vzdalenost": "Vzdálenost k jídelně",
    "od_vasi_firmy": "Obor firmy",
    "cena": "Cena"
  }'::jsonb;
begin
  for nalez in
    select distinct (regexp_matches(p_telo, '\[([a-z_]+)\]', 'g'))[1]
  loop
    insert into pole_sablony (template_id, kod, nazev, povinne, poradi)
      values (
        p_template_id,
        nalez,
        coalesce(nazvy ->> nalez, nalez),
        nalez <> 'osloveni',
        position('[' || nalez || ']' in p_telo)
      )
      on conflict (template_id, kod) do nothing;
  end loop;
end $$;

create or replace function public.zaloz_pole_sablony()
returns trigger language plpgsql as $$
begin
  perform public.zaloz_pole_sablony_pro(new.id, new.telo);
  return new;
end $$;

create trigger templates_pole
  after insert on templates
  for each row execute function public.zaloz_pole_sablony();

-- Šablony uložené před touhle migrací pole nemají — doplní se touž cestou.
do $$
declare t record;
begin
  for t in select id, telo from templates loop
    perform public.zaloz_pole_sablony_pro(t.id, t.telo);
  end loop;
end $$;

-- Přístup: čte kdokoli přihlášený, mění admin a výš (migrace 0016).
alter table pole_sablony enable row level security;
alter table nastaveni_pole enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pole_sablony', 'nastaveni_pole'] loop
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

create index nastaveni_pole_kampan_idx on nastaveni_pole (kampan_id);
