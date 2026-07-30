-- Bezpečnostní kontrola Supabase hlásí u public.kampan_pred_schvalenim
-- nález „Function Search Path Mutable" — funkce z migrace 0018 nemá pevně
-- nastavenou search_path. Ve stylu public.role_uzivatele() (migrace 0016):
-- `set search_path = ''` a všechny odkazy na tabulky uvnitř plně
-- kvalifikované schématem, jinak by funkce s prázdnou cestou tabulky
-- nenašla.
--
-- Migrace 0018 je už nasazená ve sdílené databázi, takže se needituje —
-- změna by se tam nikdy neuplatnila. Proto nová migrace, která tělo funkce
-- nahrazuje (`create or replace`).
--
-- Spoušť (`kampan_schvaleni`) se znovu nezakládá: je navázaná na funkci
-- podle jména, ne podle jejího obsahu, takže `create or replace function`
-- funkci pod běžící spouští prostě vymění.
--
-- Chování zůstává úplně stejné jako v 0018: hlídá při INSERT i UPDATE,
-- že kampaň nejde do stavu 'schvalena', dokud má nedokončenou objednávku
-- průzkumu nebo nemá jedinou vybranou firmu s kontaktem. Rozlišení operace
-- je přes TG_OP (na INSERT je `old` nepřiřazené).

create or replace function public.kampan_pred_schvalenim() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Pojistky pro schválení platí na INSERT i UPDATE
  -- Na INSERT: rozlišit TG_OP, protože old není přiřazeno
  if new.stav = 'schvalena' and (
    TG_OP = 'INSERT' or (TG_OP = 'UPDATE' and old.stav is distinct from 'schvalena')
  ) then
    if exists (
      select 1 from public.pruzkumy p
      where p.kampan_id = new.id and p.stav in ('ceka', 'bezi')
    ) then
      raise exception 'Kampaň nejde schválit, dokud neproběhl objednaný průzkum';
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
  '(nález Supabase „Function Search Path Mutable") — viz 0016 role_uzivatele.';
