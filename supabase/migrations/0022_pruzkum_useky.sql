-- Průzkum území po úsecích.
--
-- Jeden úsek = jedna územní jednotka. Velká města jsou v registru sama
-- o sobě rozdělená na obvody (Plzeň 10, Praha 57), takže i největší sousto
-- se rozpadne bez další práce. Bez dělení by výpadek uprostřed velkého
-- území znamenal začínat znovu.

create table pruzkum_useky (
  id uuid primary key default gen_random_uuid(),
  pruzkum_id uuid not null references pruzkumy(id) on delete cascade,
  jednotka int not null,
  -- Jen pro čitelný výpis; rozhoduje `jednotka`.
  obec text not null,
  poradi int not null,
  stav text not null default 'ceka'
    check (stav in ('ceka', 'bezi', 'hotovo', 'selhalo')),
  firem_novych int,
  firem_mimo_tvar int,
  chyba text,
  dokonceno_at timestamptz,
  constraint usek_selhani_ma_chybu check (stav <> 'selhalo' or chyba is not null),
  constraint usek_jednou unique (pruzkum_id, jednotka)
);

create index pruzkum_useky_fronta_idx on pruzkum_useky (pruzkum_id, poradi);

-- Nový stav objednávky: tvar nezabírá žádnou obec a čeká se na člověka.
-- Prázdno v obcích neznamená prázdno ve firmách — OpenStreetMap hledá
-- podle souřadnic, takže odloučenou fabriku najde i tam, kde obec není.
--
-- Jméno podmínky ověřeno dotazem na pg_constraint nad public.pruzkumy
-- (migrace 0018 ji založila bez explicitního jména) — vyšlo skutečně
-- `pruzkumy_stav_check`, shoduje se s předpokladem v zadání.
alter table pruzkumy drop constraint pruzkumy_stav_check;
alter table pruzkumy add constraint pruzkumy_stav_check
  check (stav in ('ceka', 'bezi', 'hotovo', 'selhalo', 'ceka_na_rozhodnuti'));

alter table pruzkum_useky enable row level security;

create policy pruzkum_useky_cteni on pruzkum_useky
  for select to authenticated using (true);

create policy pruzkum_useky_zapis on pruzkum_useky
  for all to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'))
  with check (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'));

comment on table pruzkum_useky is
  'Úseky průzkumu po územních jednotkách — aby šel běh přerušit a navázat';
