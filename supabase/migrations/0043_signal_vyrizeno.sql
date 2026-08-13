-- Odškrtnutí podnětu: „tímhle už jsem se zabýval".
--
-- Bez toho zmizí podnět z obrazovky až vypršením platnosti, takže seznam
-- ukazuje i to, co má obchodník dávno za sebou — a čím víc se s ním
-- pracuje, tím je nepoužitelnější.
--
-- Nemaže se, jen označuje: kdo a kdy. Smazaný podnět by se při dalším
-- běhu detektoru založil znovu (klíč je stabilní), takže mazání by
-- odškrtnutí ve skutečnosti nezachovalo.

alter table signaly add column vyrizeno_at timestamptz;
alter table signaly add column vyrizeno_kym text;

-- Obrazovka se ptá na nevyřízené a ještě platné. Částečný index proto,
-- že vyřízené podněty se hromadí a dotaz je má přeskočit rovnou.
create index signaly_nevyrizene on signaly (zjisteno_at desc)
  where vyrizeno_at is null;

-- ── Kdo smí odškrtávat ────────────────────────────────────────────────
--
-- Podněty zakládá detektor přes přímé spojení (mimo RLS) a upravovat je
-- nemá nikdo — jsou to doklady, ne text ke správě. Odškrtnutí je ale
-- běžná práce obchodníka, který má roli `uzivatel`.
--
-- Řeší se to sloupcovým oprávněním, ne povolením celého řádku: politika
-- pustí i uživatele, ale zapsat smí **jen ty dva sloupce**. Kdyby se
-- povolil celý řádek, šlo by přes datové API přepsat citaci nebo zdroj —
-- tedy právě to, čím se tenhle systém liší od nástrojů, které tvrdí věci
-- bez doložení.
create policy signaly_vyrizeni on signaly
  for update to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'))
  with check (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'));

revoke update on signaly from authenticated;
grant update (vyrizeno_at, vyrizeno_kym) on signaly to authenticated;

comment on column signaly.vyrizeno_at is
  'Kdy obchodník podnět odškrtl. NULL = ještě čeká. Podnět se nemaže — při dalším běhu detektoru by se založil znovu.';
comment on column signaly.vyrizeno_kym is
  'E-mail toho, kdo podnět odškrtl. Ať jde poznat, kdo s ním pracoval.';
