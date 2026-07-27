# Playbook — Čmuchal

Živý dokument agenta (SPEC 10.1). Čmuchal si ho smí upravovat sám, protože
neovlivňuje nic navenek. Zapisují se sem strategie vyhledávání a jejich
úspěšnost; CLI po každém běhu připojí poznámky z běhu.

## Měřítka (SPEC)

- podíl firem s ověřeným stavem stravování
- podíl kontaktů úrovně 1 (poptávkové adresy)
- počet ověřených kontaktů na firmu

## Strategie vyhledávání

1. Výčet firem: ARES `/ekonomicke-subjekty/vyhledat` dle `kodObce` jídelny.
   (Pozn.: kód obce je hrubé síto — Praha je jedna obec; jemnější filtr řeší
   geocoding + zóna.)
2. Stav stravování: nejlépe kariérní stránka a sekce benefitů na webu firmy;
   pracovní inzeráty jen jako zdroj údaje, nikdy do obsahu zpráv.
3. Účel adresy: kontaktní stránka firmy — hledat explicitní text u adresy
   („pro nabídky", „poptávky posílejte…").

## Poznatky z běhů

(zatím žádné — připojují se automaticky po každém běhu)

## Běh 2026-07-27 (b861f246-d097-47d0-b562-0d91d42dd608)
- nespárováno s rejstříkem: Léčebný Hotel Prusík
- nespárováno s rejstříkem: Konstantinovy Lázně
- nespárováno s rejstříkem: Vyšetřovací ústav
- nespárováno s rejstříkem: Bezdružice
- nespárováno s rejstříkem: COOP Potraviny
- nespárováno s rejstříkem: Rekreační středisko Bezdružice
- nespárováno s rejstříkem: Staré Lázně
- nespárováno s rejstříkem: U Zlaté koruny
- nespárováno s rejstříkem: Na Vsi
- nespárováno s rejstříkem: V Aleji
- nespárováno s rejstříkem: Penzion Flora
- nespárováno s rejstříkem: Obecní úřad
- nespárováno s rejstříkem: LD Mánes
- nespárováno s rejstříkem: Lázeňský hotel Jirásek
- nespárováno s rejstříkem: Jirásek
- nespárováno s rejstříkem: V Pohodě
- nespárováno s rejstříkem: Kadeřnický salon Hanka
- nespárováno s rejstříkem: Lázeňský penzion Mír
- nespárováno s rejstříkem: Lázeňský penzion Palacký
- nespárováno s rejstříkem: Lázeňský penzion Marie
- nespárováno s rejstříkem: Zdeněk Adamec
- nespárováno s rejstříkem: Kavárna a cukrárna Bellissima
- nespárováno s rejstříkem: Zdravotní středisko
- nespárováno s rejstříkem: Prášková lakovna

## Běh 2026-07-27 (00de26f3-566a-4618-a2e8-56fa874dc55d)
- nespárováno s rejstříkem: Léčebný Hotel Prusík
- nespárováno s rejstříkem: Konstantinovy Lázně
- nespárováno s rejstříkem: Vyšetřovací ústav
- nespárováno s rejstříkem: Bezdružice
- nespárováno s rejstříkem: COOP Potraviny
- nespárováno s rejstříkem: Rekreační středisko Bezdružice
- nespárováno s rejstříkem: Staré Lázně
- nespárováno s rejstříkem: U Zlaté koruny
- nespárováno s rejstříkem: Na Vsi
- nespárováno s rejstříkem: V Aleji
- nespárováno s rejstříkem: Penzion Flora
- nespárováno s rejstříkem: Obecní úřad
- nespárováno s rejstříkem: LD Mánes
- nespárováno s rejstříkem: Lázeňský hotel Jirásek
- nespárováno s rejstříkem: Jirásek
- nespárováno s rejstříkem: V Pohodě
- nespárováno s rejstříkem: Kadeřnický salon Hanka
- nespárováno s rejstříkem: Lázeňský penzion Mír
- nespárováno s rejstříkem: Lázeňský penzion Palacký
- nespárováno s rejstříkem: Lázeňský penzion Marie
- nespárováno s rejstříkem: Zdeněk Adamec
- nespárováno s rejstříkem: Kavárna a cukrárna Bellissima
- nespárováno s rejstříkem: Zdravotní středisko
- nespárováno s rejstříkem: Prášková lakovna

## Rešerše 2026-07-27 — první běh přes agenta (ne API)

- **SIGNUM spol. s r.o. = žárová zinkovna v Bezdružicích** (Úterská 291,
  provoz od 2021). Firma sídlí v Hustopečích — provozovnu odhalila až
  otevřená data MPSV. Hledání podle sídla ji najít nemohlo.
- **Firmy s více provozovnami mívají podstránku na provozovnu**
  (`/zinkovna/<obec>/`) a právě tam jsou místní kontakty i jména vedoucích.
  Obecná stránka Kontakty vede jen na centrálu — hledat tu konkrétní.
- Stravování nebývá na webu doložené ani u firem s kariérní stránkou.
  Nechávat prázdné, netipovat.

## Běh 2026-07-27 (332187a1-755b-4751-bd51-3e5ba15fd7d3)
- polohu se nepodařilo určit: SANITACE SERVIS s.r.o.
- polohu se nepodařilo určit: Habla CZ, s.r.o.
- polohu se nepodařilo určit: ROLDECO, spol. s r.o.
- polohu se nepodařilo určit: Marcel Skácel

## Běh 2026-07-27 (793c1850-5947-42e0-a350-0e51f12e060b)
- agentura práce vyřazena: MSRCZ MARINA GLOBAL. s.r.o. (nabírala pro SIGNUM s.r.o.)
- agentura práce vyřazena: MARCIUS PLUS s.r.o. (nabírala pro Signum s.r.o.)
- nespárováno s rejstříkem: SIGNUM s.r.o.
- nespárováno s rejstříkem: Léčebný Hotel Prusík
- nespárováno s rejstříkem: Konstantinovy Lázně
- nespárováno s rejstříkem: Vyšetřovací ústav
- nespárováno s rejstříkem: Bezdružice
- nespárováno s rejstříkem: COOP Potraviny
- nespárováno s rejstříkem: Rekreační středisko Bezdružice
- nespárováno s rejstříkem: Staré Lázně
- nespárováno s rejstříkem: U Zlaté koruny
- nespárováno s rejstříkem: Na Vsi
- nespárováno s rejstříkem: V Aleji
- nespárováno s rejstříkem: Penzion Flora
- nespárováno s rejstříkem: Obecní úřad
- nespárováno s rejstříkem: LD Mánes
- nespárováno s rejstříkem: Lázeňský hotel Jirásek
- nespárováno s rejstříkem: Jirásek
- nespárováno s rejstříkem: V Pohodě
- nespárováno s rejstříkem: Kadeřnický salon Hanka
- nespárováno s rejstříkem: Lázeňský penzion Mír
- nespárováno s rejstříkem: Lázeňský penzion Palacký
- nespárováno s rejstříkem: Lázeňský penzion Marie
- nespárováno s rejstříkem: Zdeněk Adamec
- nespárováno s rejstříkem: Kavárna a cukrárna Bellissima
- nespárováno s rejstříkem: Zdravotní středisko
- nespárováno s rejstříkem: Prášková lakovna
- polohu se nepodařilo určit: SANITACE SERVIS s.r.o.
- polohu se nepodařilo určit: Habla CZ, s.r.o.
- polohu se nepodařilo určit: ROLDECO, spol. s r.o.
- polohu se nepodařilo určit: Marcel Skácel

## Běh 2026-07-27 (c578851a-3de8-4f74-b8c8-4b3d0904a0f2)
- agentura práce vyřazena: MSRCZ MARINA GLOBAL. s.r.o. (nabírala pro SIGNUM s.r.o.)
- agentura práce vyřazena: MARCIUS PLUS s.r.o. (nabírala pro Signum s.r.o.)
- nespárováno s rejstříkem: SIGNUM s.r.o.
- nespárováno s rejstříkem: Léčebný Hotel Prusík
- nespárováno s rejstříkem: Konstantinovy Lázně
- nespárováno s rejstříkem: Vyšetřovací ústav
- nespárováno s rejstříkem: Bezdružice
- nespárováno s rejstříkem: COOP Potraviny
- nespárováno s rejstříkem: Rekreační středisko Bezdružice
- nespárováno s rejstříkem: Staré Lázně
- nespárováno s rejstříkem: U Zlaté koruny
- nespárováno s rejstříkem: Na Vsi
- nespárováno s rejstříkem: V Aleji
- nespárováno s rejstříkem: Penzion Flora
- nespárováno s rejstříkem: Obecní úřad
- nespárováno s rejstříkem: LD Mánes
- nespárováno s rejstříkem: Lázeňský hotel Jirásek
- nespárováno s rejstříkem: Jirásek
- nespárováno s rejstříkem: V Pohodě
- nespárováno s rejstříkem: Kadeřnický salon Hanka
- nespárováno s rejstříkem: Lázeňský penzion Mír
- nespárováno s rejstříkem: Lázeňský penzion Palacký
- nespárováno s rejstříkem: Lázeňský penzion Marie
- nespárováno s rejstříkem: Zdeněk Adamec
- nespárováno s rejstříkem: Kavárna a cukrárna Bellissima
- nespárováno s rejstříkem: Zdravotní středisko
- nespárováno s rejstříkem: Prášková lakovna

## Běh 2026-07-27 (a6ef959b-f622-4c33-808d-0ae46c8a1e96)
- agentura práce vyřazena: OT KOVO METAL, s.r.o. (nabírala pro s.r.o. Zbůch)
- nespárováno s rejstříkem: s.r.o. Zbůch
- nespárováno s rejstříkem: Líně
- nespárováno s rejstříkem: ZŠ Líně, druhý stupeň
- nespárováno s rejstříkem: ZŠ Líně, první stupeň
- nespárováno s rejstříkem: Mateřská škola
- nespárováno s rejstříkem: Obecní úřad Líně
- nespárováno s rejstříkem: Zbůch
- nespárováno s rejstříkem: Obecní úřad Zbůch
- nespárováno s rejstříkem: Obecní úřad Úherce
- nespárováno s rejstříkem: Kavárna
- nespárováno s rejstříkem: Základní škola

## Běh 2026-07-27 (d3edaa5d-7817-458b-b40c-926c457d2f6c)
- agentura práce vyřazena: MSRCZ MARINA GLOBAL. s.r.o. (nabírala pro SIGNUM s.r.o.)
- agentura práce vyřazena: MARCIUS PLUS s.r.o. (nabírala pro Signum s.r.o.)
- nespárováno s rejstříkem: SIGNUM s.r.o.

## Běh 2026-07-27 (5a8d5233-3930-4b91-9c8d-ac29b88a2905)
- agentura práce vyřazena: OT KOVO METAL, s.r.o. (nabírala pro s.r.o. Zbůch)
- nespárováno s rejstříkem: s.r.o. Zbůch
- nespárováno s rejstříkem: Líně
- nespárováno s rejstříkem: ZŠ Líně, druhý stupeň
- nespárováno s rejstříkem: ZŠ Líně, první stupeň
- nespárováno s rejstříkem: Mateřská škola
- nespárováno s rejstříkem: Obecní úřad Líně
- nespárováno s rejstříkem: Zbůch
- nespárováno s rejstříkem: Obecní úřad Zbůch
- nespárováno s rejstříkem: Obecní úřad Úherce
- nespárováno s rejstříkem: Kavárna
- nespárováno s rejstříkem: Základní škola
- polohu se nepodařilo určit: DOM Plzeň, s.r.o.

## Běh 2026-07-27 (aa9baeb2-0d87-467a-9e3d-a234e54f8223)
- nespárováno s rejstříkem: Restaurace a penzion Hamrovka
- nespárováno s rejstříkem: František Babický
- nespárováno s rejstříkem: Hrádek u Rokycan
- nespárováno s rejstříkem: COOP TIP
- nespárováno s rejstříkem: Městská knihovna Hrádek
- nespárováno s rejstříkem: Na Statku
- nespárováno s rejstříkem: Pneuservis Lavička
- nespárováno s rejstříkem: Hospůdka U Kozlerů
- nespárováno s rejstříkem: Dobřív
- nespárováno s rejstříkem: František Pejsar
- nespárováno s rejstříkem: Můj obchod
- nespárováno s rejstříkem: Pavel Kreisinger
- nespárováno s rejstříkem: Sádky VLS v Mirošově u Rokycan
- nespárováno s rejstříkem: Na Svobodě
- nespárováno s rejstříkem: Pneuservis Brynda
- nespárováno s rejstříkem: Městský úřad Hrádek
- nespárováno s rejstříkem: Obecní úřad Kamenný Újezd
- nespárováno s rejstříkem: Pod Jasanem
- nespárováno s rejstříkem: Opravy karoserií Kunc
- nespárováno s rejstříkem: Stavebniny
- nespárováno s rejstříkem: Modell
- nespárováno s rejstříkem: Mirošov 1
- nespárováno s rejstříkem: Městská knihovna Mirošov
- nespárováno s rejstříkem: Autobaterie Mechanol
- nespárováno s rejstříkem: B.A.F.
- nespárováno s rejstříkem: COOP
- nespárováno s rejstříkem: Huong Le Minh
- nespárováno s rejstříkem: Květiny
- nespárováno s rejstříkem: Bac Bui Van
- nespárováno s rejstříkem: Jaromír Jelínek
- nespárováno s rejstříkem: Pivovar LOUŽEK
- nespárováno s rejstříkem: Základní škola Hrádek
- nespárováno s rejstříkem: Městský úřad Mirošov
- nespárováno s rejstříkem: Zdavotní středisko Mirošov
- nespárováno s rejstříkem: Obecní úřad Dobřív
- nespárováno s rejstříkem: ČS Kamenný Újezd
- nespárováno s rejstříkem: Léčebna TRN Janov
- nespárováno s rejstříkem: halda dolu Antonín
- nespárováno s rejstříkem: Vojenské lesy a statky
- nespárováno s rejstříkem: ČOV
- nespárováno s rejstříkem: Perfekt kámen
- nespárováno s rejstříkem: Mateřská školka respirační
- nespárováno s rejstříkem: Mateřská školka Hrádek

## Běh 2026-07-27 (013204c4-ab43-4a0e-80db-d896b605dd54)
- agentura práce vyřazena: MSRCZ MARINA GLOBAL. s.r.o. (nabírala pro SIGNUM s.r.o.)
- agentura práce vyřazena: MARCIUS PLUS s.r.o. (nabírala pro Signum s.r.o.)
- nespárováno s rejstříkem: SIGNUM s.r.o.

## Běh 2026-07-27 (2db73757-756d-4f4d-9de8-3c7ad747e50c)
- kapacita jídelny ZŠ Zbůch není známá — pro sběr nevadí, před oslovením ji bude potřeba doplnit
- agentura práce vyřazena: OT KOVO METAL, s.r.o. (nabírala pro s.r.o. Zbůch)
- nespárováno s rejstříkem: s.r.o. Zbůch
- nespárováno s rejstříkem: Líně
- nespárováno s rejstříkem: ZŠ Líně, druhý stupeň
- nespárováno s rejstříkem: ZŠ Líně, první stupeň
- nespárováno s rejstříkem: Mateřská škola
- nespárováno s rejstříkem: Obecní úřad Líně
- nespárováno s rejstříkem: Zbůch
- nespárováno s rejstříkem: Obecní úřad Zbůch
- nespárováno s rejstříkem: Obecní úřad Úherce
- nespárováno s rejstříkem: Kavárna
- nespárováno s rejstříkem: Základní škola
- polohu se nepodařilo určit: DOM Plzeň, s.r.o.

## Běh 2026-07-27 (14661176-625a-4456-9702-c77c2f3d6f03)
- kapacita jídelny ZŠ a MŠ Tlučná není známá — pro sběr nevadí, před oslovením ji bude potřeba doplnit
- nespárováno s rejstříkem: Vejprnice
- nespárováno s rejstříkem: Obecní úřad Tlučná
- nespárováno s rejstříkem: Realitni kancelar
- nespárováno s rejstříkem: Sokolovna
- nespárováno s rejstříkem: Nýřany
- nespárováno s rejstříkem: Tlučná
- nespárováno s rejstříkem: Holýšovská lékárna
- nespárováno s rejstříkem: Obecní úřad Vejprnice
- nespárováno s rejstříkem: Pohostinství Salon
- nespárováno s rejstříkem: Lidl
- nespárováno s rejstříkem: Billa
- nespárováno s rejstříkem: PENNY
- nespárováno s rejstříkem: Městský úřad Nýřany
- nespárováno s rejstříkem: KiK
- nespárováno s rejstříkem: Můj obchod
- nespárováno s rejstříkem: Benu
- nespárováno s rejstříkem: Pokladna ČD
- nespárováno s rejstříkem: čistírna odpadních vod Tlučná
- nespárováno s rejstříkem: Česká spořitelna
- nespárováno s rejstříkem: Mateřská škola
- nespárováno s rejstříkem: Základní škola
- nespárováno s rejstříkem: Metrans
- nespárováno s rejstříkem: La Lorraine Bakery Group

## Běh 2026-07-27 (3b43a317-5514-4724-a3c4-d6f669de587d)
- kapacita jídelny ZŠ a MŠ Hrádek není známá — pro sběr nevadí, před oslovením ji bude potřeba doplnit
- nespárováno s rejstříkem: Restaurace a penzion Hamrovka
- nespárováno s rejstříkem: František Babický
- nespárováno s rejstříkem: Hrádek u Rokycan
- nespárováno s rejstříkem: COOP TIP
- nespárováno s rejstříkem: Městská knihovna Hrádek
- nespárováno s rejstříkem: Na Statku
- nespárováno s rejstříkem: Pneuservis Lavička
- nespárováno s rejstříkem: Hospůdka U Kozlerů
- nespárováno s rejstříkem: Dobřív
- nespárováno s rejstříkem: František Pejsar
- nespárováno s rejstříkem: Můj obchod
- nespárováno s rejstříkem: Pavel Kreisinger
- nespárováno s rejstříkem: Sádky VLS v Mirošově u Rokycan
- nespárováno s rejstříkem: Na Svobodě
- nespárováno s rejstříkem: Pneuservis Brynda
- nespárováno s rejstříkem: Městský úřad Hrádek
- nespárováno s rejstříkem: Obecní úřad Kamenný Újezd
- nespárováno s rejstříkem: Pod Jasanem
- nespárováno s rejstříkem: Opravy karoserií Kunc
- nespárováno s rejstříkem: Stavebniny
- nespárováno s rejstříkem: Modell
- nespárováno s rejstříkem: Mirošov 1
- nespárováno s rejstříkem: Městská knihovna Mirošov
- nespárováno s rejstříkem: Autobaterie Mechanol
- nespárováno s rejstříkem: B.A.F.
- nespárováno s rejstříkem: COOP
- nespárováno s rejstříkem: Huong Le Minh
- nespárováno s rejstříkem: Květiny
- nespárováno s rejstříkem: Bac Bui Van
- nespárováno s rejstříkem: Jaromír Jelínek
- nespárováno s rejstříkem: Městský úřad Mirošov
- nespárováno s rejstříkem: Zdavotní středisko Mirošov
- nespárováno s rejstříkem: Obecní úřad Dobřív
- nespárováno s rejstříkem: Základní škola Hrádek
- nespárováno s rejstříkem: ČS Kamenný Újezd
- nespárováno s rejstříkem: Léčebna TRN Janov
- nespárováno s rejstříkem: halda dolu Antonín
- nespárováno s rejstříkem: Vojenské lesy a statky
- nespárováno s rejstříkem: ČOV
- nespárováno s rejstříkem: Perfekt kámen
- nespárováno s rejstříkem: Mateřská školka respirační
- nespárováno s rejstříkem: Mateřská školka Hrádek

## Rešerše 2026-07-27 — dávka 20 firem (Zbůch/Tlučná/Bezdružice/Hrádek, běh c12acbba-7f70-4972-ad30-24cc413e5972)

Výsledek: 26 kontaktů, 5 nálezů (2× ma_vlastni_jidelnu, 3× ucel_adresy) u 17 z 20
firem; 3 firmy bez nálezu (REVIANT s.r.o., I.U.STAVBY s.r.o., Centrum Zbůch z.s.).
Žádná položka nebyla při zápisu odmítnuta.

**Co neslo ovoce:**
- **Stránka Kontakty obcí a měst** je nejspolehlivější zdroj u veřejné správy —
  jmenný rozpis podle agend (tajemník/tajemnice = nejbližší obdoba HR kontaktu,
  podatelna/evidence = obecná adresa). Fungovalo u všech 4 obcí/měst v dávce.
  Stravování zaměstnanců úřadu se na těchto stránkách nikdy neuvádí.
- **Specializovaná podstránka pro konkrétní provozovnu** (ne obecná firemní
  Kontakty) je klíčová u firem s víc pobočkami — potvrzeno znovu u SIGNUM
  (`/zinkovna/bezdruzice/`) a u MONTEFERRO (síťová stránka mateřské firmy
  `monteferro.it/network-contacts/` obsahovala český kontakt, když `.cz`
  doména sama o sobě nešla načíst).
- **Sekce "cenové nabídky" / "obchodní zástupci" na firemním webu** = přímý
  zdroj kontaktu úrovně 1 (B & BC nabidky@babc.cz, BBS richardbayer@bbs.eu,
  Vochoc martin.vochoc@vochoc.cz, Signum pavel.prochazka@signumcz.com) —
  hledat cíleně tuto sekci, ne jen obecné "Kontakty".
- **U sociálních/pobytových zařízení hledat konkrétní podstránku o stravě**
  (ne obecné "O nás") — u CPTS Zbůch teprve stránka "Přihláška a odhláška
  stravy v jídelně" obsahovala doslovnou frázi "Jídelně CPTS Zbůch" a potvrdila
  vlastní jídelnu; u ZŠ a MŠ Vejprnice podobně stránka "/informace-sj".
  Obecná stránka jen odkazovala na "Poskytování stravy" bez detailu.
- **Cloudflare-obfuskované e-maily** (zivefirmy.cz, babc.cz) se dají obejít
  přímým `curl` na syrové HTML — adresa bývá čitelná v `application/ld+json`
  schema.org markupu i tam, kde viditelný text stránky e-mail maskuje.

**Co bylo slepé:**
- **Firmy bez vlastního webu** (REVIANT s.r.o. — jen jenprace.cz inzerát bez
  jména kontaktu a benefitů; I.U.STAVBY s.r.o. — žádná stopa mimo rejstřík).
  Nově vzniklé s.r.o. (IČO začínající řadou 1x) mívají nulovou webovou stopu.
- **Malé pracovní agregátory (nyransko.cz, volnamista.cz) rychle expirují**
  (404 do pár měsíců) — Google/WebSearch snippet s citací ze zaniklé stránky
  nelze použít jako `zdrojUrl`. U Elkamet s.r.o. tak zůstala nedoložená
  nadějná zmínka o "stravování zdarma v nové denní místnosti" — ověřovat vždy
  přímým fetchem, ne jen souhrnem z vyhledávání.
- **Organizace sdílející adresu/vedení s jinou firmou nemusí mít vlastní
  publikovaný kontakt** — Centrum Zbůch, z.s. (zapsaný spolek) sídlí na stejné
  adrese a se stejným vedením jako CPTS Zbůch, ale nemá dohledatelnou vlastní
  kontaktní stránku; nedomýšlet sdílený kontakt bez přímého dokladu.

**Vyjasněno k dřívějšímu podezření:**
- **SIGNUM spol. s r.o. (IČO 18200061) je žárová zinkovna** (síť 11 provozů,
  Bezdružice v provozu od podzimu 2021), NE agentura práce. Dřívější záznamy
  v tomto playbooku o "agentuře práce" se týkaly firem MSRCZ MARINA GLOBAL a
  MARCIUS PLUS, které pro provoz SIGNUM v Bezdružici najímaly pracovníky —
  ty byly správně vyřazeny jako agentury, SIGNUM samo je výrobní firma a
  kvalifikovaný cíl.
