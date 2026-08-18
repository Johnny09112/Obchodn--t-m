---
name: rls-bez-politiky-je-tiche-prazdno
description: Tabulka se zapnutým RLS a bez jediné politiky je pro aplikaci neviditelná — nevrátí chybu, vrátí nula řádků
type: pattern
status: active
created: 2026-08-18
updated: 2026-08-18
related: [zamitnuty-zapis-bez-chyby, pravidlo-v-jadru-nehlida-obrazovku, zelene-testy-nejsou-hotova-obrazovka]
---

**Objeveno proklikáním 18. 8. 2026.** Krok „Zpráva" u kampaně ukazoval
prázdno — žádná šablona, žádná pole, žádný náhled. Příkazová řádka přitom
tytéž údaje vypisovala správně.

**Příčina:** `templates` a `claims` mají od migrace 0015 zapnuté RLS, ale
**nikdy nedostaly jedinou politiku**. Do 0015 se dostaly proto, že RLS se
zapínalo plošně; do 0016, které politiky rozdávalo podle výčtu, ne —
tehdy byly prázdné a nikdo je nečetl.

**Proč se to hledá těžko:** chová se to jako prázdná tabulka. Žádná chyba,
žádné varování, jen nula řádků. Je to tentýž tvar zrady jako
[[zamitnuty-zapis-bez-chyby]] — Supabase neřekne „nesmíš", řekne „nic tu
není". A rozdíl mezi jádrem a obrazovkou tomu nahrává: jádro se připojuje
přímo (RLS se ho netýká), aplikace přes datové API.

**Pojistka:** test `test/pravidla.test.ts` → *„bez politiky jsou jen
vyjmenované tabulky, které se ještě nepoužívají"*. Seznam je psaný
výčtem, takže nová tabulka bez politiky test shodí. Dnes jsou v něm
tabulky fáze 3 (`messages`, `consents`, `suppressions`, `events`,
`incidents`, `proposals`, `partneri`) — vědomě, protože se zatím
nepoužívají a jejich přístupový model se rozhodne, až na ně dojde.

**Poznávací otázka u každé nové tabulky:** *sáhne na ni aplikace?*
Pokud ano, patří jí politika hned v téže migraci, ne později.
