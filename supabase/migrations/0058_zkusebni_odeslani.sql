-- Zkušební odeslání na vlastní adresu.
--
-- Majitel 20. 8. 2026: „nejprve uděláme nějaké fake tvorby, ale vše na jeden
-- dva moje účty, ať vím, jak to vypadá. Až pak bych to posílal dále."
--
-- Zkušební zpráva je SKUTEČNÁ zpráva pro skutečnou firmu, jen doručená na
-- vlastní adresu. Z toho plynou dvě nebezpečí a obojí hlídá databáze, ne
-- obrazovka — obrazovka se dá obejít, spoušť ne:
--
-- 1. Zkouška se nesmí dostat ke skutečné firmě. Dokud je `sending_enabled`
--    false (TP-8), smí být příjemcem jedině zapsaná zkušební adresa.
-- 2. Zkouška nesmí spálit jediné oslovení firmy (TP-5). Kdyby ho vyčerpala
--    zpráva poslaná majiteli, firma by se už nikdy neoslovila a nikdo by
--    nevěděl proč.
--
-- Zkušební režim má schválně **vlastní** přepínač (zapsaná adresa), oddělený
-- od ostrého odesílání. Kdyby se sdílel, muselo by se kvůli zkoušce zapnout
-- ostré odesílání — a jediná chyba by pak psala skutečným firmám.

alter table system_state add column zkusebni_prijemce text;

comment on column system_state.zkusebni_prijemce is
  'Adresa, na kterou chodí zkušební zprávy místo firmám. Dokud je prázdná, neprojde ani zkouška.';

-- Komu zpráva doopravdy odešla. U zkoušky je to vlastní adresa, ne adresa
-- firmy — a musí to být vidět, nikdy tiché přesměrování.
alter table messages add column prijemce text;
alter table messages add column zkusebni boolean not null default false;

-- Pro koho byla zpráva složená. `contact_id` říká komu se psalo, ale TP-5 se
-- počítá na firmu, ne na kontakt: firma se osloví jednou, i kdyby měla pět
-- kontaktů.
alter table messages add column ico text references companies(ico);

comment on column messages.zkusebni is
  'Zkouška na vlastní adresu: nepočítá se do TP-5 a firma zůstává neoslovená.';

-- TP-5 vynucené schématem, ne kódem: jedna firma = jedno ostré oslovení.
-- Zkoušek smí být kolik chce, ty se do pravidla nepočítají.
create unique index messages_jedno_osloveni
  on messages (ico) where not zkusebni;

create or replace function public.zprava_pred_ulozenim() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  stav record;
begin
  select sending_enabled, zkusebni_prijemce into stav from system_state where id;

  if new.zkusebni then
    if stav.zkusebni_prijemce is null or btrim(stav.zkusebni_prijemce) = '' then
      raise exception 'Zkušební zpráva nemá kam jít — v nastavení není zkušební adresa';
    end if;
    if new.prijemce is distinct from stav.zkusebni_prijemce then
      raise exception 'Zkušební zpráva smí jít jedině na zkušební adresu (%), ne na %',
        stav.zkusebni_prijemce, coalesce(new.prijemce, '(prázdné)');
    end if;
  else
    if not stav.sending_enabled then
      raise exception 'Odesílání je vypnuté — ostrou zprávu nejde ani uložit (TP-8)';
    end if;
  end if;

  return new;
end $$;

create trigger messages_pred_ulozenim before insert or update on messages
  for each row execute function public.zprava_pred_ulozenim();

comment on function public.zprava_pred_ulozenim is
  'TP-8 a zkušební režim: dokud je odesílání vypnuté, smí vzniknout jedině zkušební zpráva na zapsanou vlastní adresu.';
