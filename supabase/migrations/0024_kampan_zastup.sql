-- Zástup správce kampaně a zamčení úprav.
--
-- Rozhodnutí majitele 2026-07-31: kampaň upravuje správce (= ten, kdo ji
-- založil), jeho zástup a admin. Dosud do ní směl KDOKOLI přihlášený
-- s rolí `uzivatel` a výš (migrace 0018) a sloupec `spravce` byl jen
-- informativní cedulka — zástup by tedy neměl koho zastupovat.
--
-- Schválení zůstává na adminovi a výš, beze změny. Zástup je pověření ke
-- konkrétní kampani, NE nová role — role zůstávají tři.

alter table kampane add column zastupce text;

comment on column kampane.zastupce is
  'E-mail člověka, který smí kampaň upravovat místo správce (nemoc, dovolená). Neschvaluje.';

-- Bez cizího klíče na `uzivatele` schválně: bezpečnost stojí na pravidle
-- přístupu (`zastupce = email_uzivatele()`), takže překlep znamená jen
-- nefunkční zástup, ne díru. Cizí klíč by naopak vynutil evidenci lidí
-- i ve všech testech a v příkazové řádce, kde se používají volné e-maily.

-- Kdo smí kampaň upravovat. Používá se i pro seznam firem a objednávky.
create or replace function public.smi_do_kampane(kampan uuid) returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.kampane k
    where k.id = kampan
      and (
        public.role_uzivatele() in ('super-admin', 'admin')
        or k.spravce = public.email_uzivatele()
        or k.zastupce = public.email_uzivatele()
      )
  )
$$;

comment on function public.smi_do_kampane(uuid) is
  'Správce, zástup nebo admin. Admin vždy — jinak by kampaň po odchodu správce osiřela a spravit by ji šlo jen ručním zásahem do databáze.';

drop policy kampane_zapis on kampane;

-- Založit smí kdokoli z týmu, ale musí se zapsat jako správce. Jinak by
-- šlo založit kampaň na cizí jméno.
create policy kampane_zalozeni on kampane
  for insert to authenticated
  with check (
    public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel')
    and spravce = public.email_uzivatele()
  );

create policy kampane_uprava on kampane
  for update to authenticated
  using (
    public.role_uzivatele() in ('super-admin', 'admin')
    or spravce = public.email_uzivatele()
    or zastupce = public.email_uzivatele()
  )
  with check (
    (
      public.role_uzivatele() in ('super-admin', 'admin')
      or spravce = public.email_uzivatele()
      or zastupce = public.email_uzivatele()
    )
    -- Beze změny z 0018: do `schvalena` smí jen admin a výš.
    and (stav <> 'schvalena' or public.role_uzivatele() in ('super-admin', 'admin'))
  );

-- Mazat kampaně nejde vůbec (zrušení je stav s důvodem), takže pravidlo
-- pro DELETE schválně nevzniká.

drop policy kampan_firmy_zapis on kampan_firmy;

create policy kampan_firmy_zapis on kampan_firmy
  for all to authenticated
  using (public.smi_do_kampane(kampan_id))
  with check (public.smi_do_kampane(kampan_id));

-- Objednávky průzkumu navázané na kampaň. Objednávka bez kampaně
-- (`kampan_id is null`) se zakládá z příkazové řádky, kde žádný přihlášený
-- člověk není — ta zůstává na roli, jako dosud.
drop policy pruzkumy_zapis on pruzkumy;

create policy pruzkumy_zapis on pruzkumy
  for all to authenticated
  using (
    case when kampan_id is null
      then public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel')
      else public.smi_do_kampane(kampan_id)
    end
  )
  with check (
    case when kampan_id is null
      then public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel')
      else public.smi_do_kampane(kampan_id)
    end
  );
