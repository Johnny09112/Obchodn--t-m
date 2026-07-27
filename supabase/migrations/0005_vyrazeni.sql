-- Deník vyřazených kandidátů.
--
-- Bez něj se systém nedá kalibrovat: dnes víme jen „vyřazeno 471", ale ne
-- KOHO a PROČ. Aby mohl majitel seznam procházet a aby se pravidla dala
-- postupně brousit do autonomního režimu, musí být každé vyřazení dohledatelné.
--
-- Záměrně mimo `companies`: tam smí jen firmy ověřené v ARES (TP-1) a mnoho
-- kandidátů se vyřadí dřív, než k ověření vůbec dojde.

create table vyrazeni (
  id uuid primary key default gen_random_uuid(),
  beh_id uuid references agent_runs(id) on delete set null,
  jidelna_id uuid references jidelny(id) on delete set null,
  ico text,                      -- nemusí být známé (kandidát z mapy bez shody)
  nazev text not null,
  zdroj text not null check (zdroj in ('mpsv', 'osm', 'ares')),
  duvod text not null check (duvod in (
    'neplatne_ico',        -- nesedí kontrolní součet
    'neni_v_ares',         -- rejstřík firmu nezná
    'nesparovano',         -- název z mapy se nepodařilo přiřadit k subjektu
    'agentura',            -- agentura práce, nabírá pro někoho jiného
    'vylouceny_obor',      -- restaurace, agentury (CZ-NACE 56, 78)
    'bez_zamestnancu',     -- registr říká „bez zaměstnanců"
    'neuvedena_velikost',  -- velikost neuvedena a zdroj je slabý (sweep)
    'poloha_neznama',      -- adresu se nepodařilo zaměřit
    'mimo_zonu'            -- příliš daleko od jídelny
  )),
  detail text,                   -- lidsky: co přesně se stalo
  vyrazeno_at timestamptz not null default now()
);

create index vyrazeni_beh_idx on vyrazeni (beh_id);
create index vyrazeni_duvod_idx on vyrazeni (duvod);
