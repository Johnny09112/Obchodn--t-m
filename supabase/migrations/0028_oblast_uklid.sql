-- Úklid oblastí: mazání nepoužitých a ochrana toho, co se mazat nemá.
--
-- Majitel 31. 7.: „oblast je jen plocha, pro kterou bude spuštěna analýza,
-- takže nevnímám jako rizikové si ji nechat z jiného důvodu, než pro účel
-- kampaně." Souhlas — s jednou opravou, kterou přinesla tahle migrace.
--
-- Dvě věci byly špatně a obojí tiše:
--
-- 1. `pruzkumy.oblast_id` byl `on delete cascade`. Smazání oblasti by tedy
--    smazalo i záznam o tom, jaké území se kdy analyzovalo a s jakým
--    výsledkem. To není odvozenina, to je evidence — a evidence se nemaže
--    jako vedlejší účinek něčeho jiného.
--
-- 2. `oblasti_zapis` bylo pravidlo pro `ALL`, tedy včetně mazání, a platilo
--    pro roli `uzivatel`. Kdokoli z týmu tak mohl přes API smazat oblast
--    i s historií průzkumů. Rozhraní to nenabízelo, ale pravidlo ano —
--    a pravidlo je to, co platí.
--
-- `oblast_firmy` zůstává kaskádou schválně: to JE odvozenina z tvaru
-- a dá se kdykoli spočítat znovu.

-- ── 1. průzkum oblast ochrání

alter table pruzkumy drop constraint pruzkumy_oblast_id_fkey;

alter table pruzkumy
  add constraint pruzkumy_oblast_id_fkey
  foreign key (oblast_id) references oblasti(id) on delete restrict;

comment on column pruzkumy.oblast_id is
  'Území, které se analyzovalo. `restrict` — smazání oblasti nesmí vzít s sebou doklad o průzkumu.';

-- ── 2. mazat smí jen admin, kreslit celý tým

drop policy oblasti_zapis on oblasti;

create policy oblasti_zalozeni on oblasti
  for insert to authenticated
  with check (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'));

create policy oblasti_uprava on oblasti
  for update to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'))
  with check (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'));

-- Mazání dat rozhoduje majitel — stejné pravidlo jako u kampaní.
-- Co oblast drží naživu (kampaň, průzkum), hlídají cizí klíče výš; tohle
-- řeší jen to, kdo o smazání vůbec smí požádat.
create policy oblasti_mazani on oblasti
  for delete to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin'));
