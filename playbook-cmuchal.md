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
