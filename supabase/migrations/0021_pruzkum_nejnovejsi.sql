-- Oprava pasti z migrace 0020: podmínka `p.stav <> 'hotovo'` blokovala
-- schválení, i když EXISTOVAL jakýkoli nehotový průzkum pro kampaň — takže
-- kampaň, jejíž první průzkum selhal a druhý (opakovaný) doběhl do 'hotovo',
-- zůstala zablokovaná navždy, protože ten první, selhaný záznam pořád
-- „existuje". Ven vedl jen ruční zásah do databáze.
--
-- Správně má rozhodovat **nejnovější objednávka pro danou kampaň** podle
-- `pozadano_at` — ne existence jakékoli nehotové:
--   - kampaň bez jediné objednávky      → schválení nic nebrání,
--   - nejnovější objednávka 'hotovo'    → schválení projde, i kdyby
--                                          starší objednávky selhaly,
--   - nejnovější 'ceka'/'bezi'/'selhalo' → schválení neprojde.
--
-- Druhotné kritérium při shodném `pozadano_at` (teoretická možnost, ne
-- pozorovaná v praxi — `timestamptz` má mikrosekundovou přesnost, ale dvě
-- objednávky vytvořené ve stejné transakci/dávce by na ni teoreticky
-- mohly trefit): `id desc`. `id` je náhodné UUID, takže nenese žádný
-- smysl pořadí — je to čistě deterministický rozhodčí pro nepravděpodobný
-- remíz, aby funkce vždy vybrala jeden konkrétní řádek, ne aby "poslední"
-- v tomto okrajovém případě znamenalo něco věcného.
--
-- Migrace 0018, 0019 i 0020 jsou nasazené — needitují se, funkce se mění
-- přes `create or replace`. Styl jako 0020: pevná prázdná `search_path`,
-- `security invoker`, tabulky uvnitř plně kvalifikované schématem, `TG_OP`
-- pro rozlišení INSERT/UPDATE. Druhá pojistka (aspoň jedna vybraná firma
-- s doloženým kontaktem) beze změny.

create or replace function public.kampan_pred_schvalenim() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  posledni_stav text;
begin
  -- Pojistky pro schválení platí na INSERT i UPDATE
  -- Na INSERT: rozlišit TG_OP, protože old není přiřazeno
  if new.stav = 'schvalena' and (
    TG_OP = 'INSERT' or (TG_OP = 'UPDATE' and old.stav is distinct from 'schvalena')
  ) then
    select p.stav into posledni_stav
    from public.pruzkumy p
    where p.kampan_id = new.id
    order by p.pozadano_at desc, p.id desc
    limit 1;

    if posledni_stav is not null and posledni_stav <> 'hotovo' then
      raise exception 'Kampaň nejde schválit, dokud nedoběhl nejnovější objednaný průzkum';
    end if;

    if not exists (
      select 1 from public.kampan_firmy kf
      join public.contacts c on c.ico = kf.ico
      where kf.kampan_id = new.id and kf.stav = 'vybrana'
    ) then
      raise exception 'Kampaň nejde schválit bez jediné firmy s doloženým kontaktem';
    end if;
  end if;
  return new;
end $$;

comment on function public.kampan_pred_schvalenim() is
  'Pojistky před schválením kampaně (INSERT i UPDATE). Pevná search_path '
  '(nález Supabase „Function Search Path Mutable") — viz 0016 role_uzivatele. '
  'O průzkumu rozhoduje nejnovější objednávka (pozadano_at desc, id desc) — '
  'starší selhané objednávky opakování nezablokují, viz 0021.';
