---
name: zkusebni-odeslani-na-vlastni-adresu
description: Zkušební zprávy chodí na vlastní adresu majitele, mají vlastní přepínač oddělený od ostrého odesílání a nepočítají se do TP-5
type: decision
status: active
created: 2026-08-20
updated: 2026-08-20
related: [druha-firma-vlastni-instance, odesilaci-domena-a-adresa, spadovy-bod-je-volitelny]
---

**Rozhodl majitel 20. 8. 2026** spolu se souhlasem otevřít fázi 3:

> „Nejprve uděláme nějaké fake tvorby, ale vše na jeden/dva moje účty, ať vím,
> jak to vypadá. Až pak bych to posílal dále."

**Souhlas je se stavbou odesílací cesty, ne s odesíláním.** Vypínač
`sending_enabled` zůstává na člověku (TP-8).

## Co z toho plyne pro návrh

Zkušební zpráva je **skutečná zpráva pro skutečnou firmu**, jen doručená na
vlastní adresu. To je nebezpečnější, než to zní, a plynou z toho dvě pojistky
— obě v databázi, ne v obrazovce (migrace 0058):

1. **Dokud je odesílání vypnuté, smí vzniknout jedině zkušební zpráva na
   zapsanou adresu** (`system_state.zkusebni_prijemce`). Ostrá zpráva se
   při vypnutém vypínači ani neuloží. Ověřeno i na ostré databázi:
   pokus skončil hláškou „Odesílání je vypnuté — ostrou zprávu nejde ani
   uložit (TP-8)", zpráv zůstalo 0.
2. **Zkouška nespálí firmě jediné oslovení** (TP-5). `messages.zkusebni`
   se do pravidla nepočítá; TP-5 drží částečný unikátní index
   `messages_jedno_osloveni` na `ico` **where not zkusebni** — tedy schéma,
   ne kód.

## Proč má zkušební režim VLASTNÍ přepínač

Kdyby se sdílel s ostrým odesíláním, muselo by se kvůli zkoušce zapnout
odesílání naostro — a jediná chyba v kódu by v tu chvíli psala skutečným
firmám. Oddělené přepínače znamenají, že na firmu nedosáhne ani omylem.

## Poznámka k testům

Testy `test/odeslani-zkusebni.test.ts` byly ověřeny proti prázdnu: po dočasném
odebrání migrace 0058 spadlo všech šest. Nejsou naprázdno.

## Co zůstává otevřené

**Ruční kontrola vzorku 30 firem** — majitel na otázku „kdy" odpověděl
zkušebním odesíláním, takže je pořád nerozhodnutá. Připomenout **před prvním
odesláním skutečné firmě**, ne dřív; měří přesně to riziko, které při
odesílání ven nese následky.
