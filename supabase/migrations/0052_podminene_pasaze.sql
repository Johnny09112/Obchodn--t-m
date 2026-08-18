-- Podmíněné věty v šabloně a jedna platná verze.
--
-- **Naléhavý důvod:** dnešní šablona tvrdí každé firmě „s možností obědvat
-- na místě NEBO si jídlo odvážet v jídlonosičích". Jídelna, která umí jen
-- jedno z toho, by tím rozeslala nepravdivé tvrzení o službě — přesně ta
-- kategorie chyby, kvůli které existuje knihovna tvrzení.
--
-- **Proč pořadí odstavce a věty, a ne pozice znaku:** pozice se při psaní
-- posune a podmínka by pak platila pro jinou větu. Nikdo by si toho
-- nevšiml, dokud by mail neodešel. Odstavce se počítají jen ty skutečné,
-- prázdné řádky mezi nimi ne — kdo v editoru klikne na druhý odstavec,
-- myslí druhý odstavec.

create table podminky_pasaze (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  odstavec int not null check (odstavec >= 0),
  veta int not null check (veta >= 0),
  -- Kód parametru nabídky, ne cizí klíč: parametr smí majitel smazat
  -- a podmínka na neexistující parametr prostě neplatí (věta se vypustí).
  parametr_kod text not null,
  -- NULL znamená „parametr je vyplněný", bez ohledu na hodnotu.
  ocekavana_hodnota text,
  unique (template_id, odstavec, veta)
);

comment on table podminky_pasaze is
  'Věta se ukáže, jen když parametr nabídky odpovídá. Pořadí, ne pozice znaku.';

/**
 * Pustí šablonu do provozu.
 *
 * Starší verze téhož segmentu a kanálu se přepnou na „vyrazeno", aby
 * platná byla vždy právě jedna. Řádek zůstává, protože odeslané zprávy
 * se na svou verzi odkazují přes `template_id` (TP-13) a kampaň taky.
 */
create or replace function public.pust_sablonu_do_provozu(p_template_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  s record;
begin
  select segment, kanal into s from templates where id = p_template_id;
  if not found then
    raise exception 'Taková šablona není.';
  end if;

  update templates
     set stav = 'vyrazeno'
   where segment = s.segment and kanal = s.kanal
     and id <> p_template_id and stav = 'schvaleno';

  update templates
     set stav = 'schvaleno', schvaleno_at = now()
   where id = p_template_id;
end $$;

alter table podminky_pasaze enable row level security;

-- Politika hned tady, ne později: tabulka s RLS a bez politiky je pro
-- aplikaci neviditelná, a to mlčky (past „rls-bez-politiky-je-tiche-prazdno").
create policy podminky_pasaze_cteni on public.podminky_pasaze
  for select to authenticated using (true);

create policy podminky_pasaze_sprava on public.podminky_pasaze
  for all to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin'))
  with check (public.role_uzivatele() in ('super-admin', 'admin'));
