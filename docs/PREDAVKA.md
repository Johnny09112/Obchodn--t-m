# Předávka — začni tady

> Psáno 31. 7. 2026 na konci dlouhé session. Účel: aby další session mohla
> navázat bez ptaní na věci, které už jsou rozhodnuté.
>
> **Pořadí čtení:** tenhle soubor → `memory/stav.md` → podle tématu
> `memory/rozhodnuti.md` a `memory/poznatky.md`.

## Kde projekt je (čísla z ostré databáze, 31. 7. 2026)

| Údaj | Hodnota |
|---|---|
| Firem v kartotéce | **13 767** (ráno jich bylo 167) |
| Z toho se spojením | **104** |
| Vyřazených kandidátů, s důvodem | 4 044 |
| Oblastí · kampaní · průzkumů | 8 · 4 · 2 (oba hotové) |
| Běhů agenta | 15 |
| **Náklady na API** | **0 USD** — placené API nikdy neběželo |
| Poslední migrace | `0027_pruzkum_urgentni.sql` |
| Odesílání | **vypnuté** (`system_state.sending_enabled = false`) |
| Testy | 416 zelených, 45 souborů |

Aplikace běží na `https://cantinero-find.vercel.app`, staví se z `main`.

## Co se povedlo dnes (etapy B, B+, C)

- **Průvodce kampaní je celý.** Založení se zástupem → území s dvěma počty
  firem → objednání průzkumu a jeho postup → seznam firem, vyřazení,
  schválení.
- **Hlídka Čmuchala** — ikona u hodin (`skripty/Cmuchal.vbs`), bere si
  objednávky z fronty sama. 3× denně + urgentní každých 10 minut.
- **Archivace a mazání kampaní**, zámek úprav na správce/zástup/admina.
- **Provozní deník** (obrazovka Provoz, jen admin) — průzkumy, chyby,
  běhy agenta, možnost vrátit neúspěšný průzkum do fronty.
- **Ověřeno naostro celým řetězcem:** aplikace objednala průzkum, hlídka
  ho vzala, Čmuchal sebral 13 600 firem, kampaň se z nich naplnila.

## Co majitel vyžádal a NENÍ postavené

Seřazeno tak, jak to spolu souvisí — ne podle důležitosti.

### 1. Oblasti: úklid, výběr, více oblastí na kampaň

Majitel (31. 7.): *„potřeboval bych mít možnost smazat, případně slučovat
oblasti… chci kampaň přes více oblastí — s možností volby oblastí,
přehledněji než na té mapě, i s nějakým detailem (poslední kampaň atd.)…
oblasti se časem mění (Plzeň se rozšiřuje)… a poslední je úklid."*

Tři kusy práce:

1. **Mazání nepoužitých oblastí.** Oblast je jen plocha — smazat nepoužitou
   riziko není. **ALE vazba `pruzkumy.oblast_id` je `on delete cascade`**,
   takže by se smazal i záznam průzkumu. Srovnat na `restrict` a mazání
   povolit jen u oblasti bez kampaně i průzkumu. Vyhradit adminovi.
2. **Seznam oblastí s detailem** místo klikání do mapy — kdy naposled
   prozkoumaná, kolik firem, v jakých kampaních je.
3. **Kampaň nad více oblastmi** (`kampan_oblasti`, vztah mnoho k mnoha).
   Skutečné geometrické slučování tvarů se NESTAVÍ — majitel potvrdil, že
   mu jde o tohle.

### 2. Tvar oblasti se uloží k průzkumu

**Rozhodnuto a odsouhlaseno, jen nepostavené.** Oblast se překresluje, takže
starý průzkum by tvrdil „analyzovali jsme Plzeň", ale ta Plzeň by mezitím
znamenala něco jiného. Uložit k objednávce snímek tvaru.

### 3. Oznámení o dokončení průzkumu

Majitel chtěl e-mail. **Teď to nejde** (TP-8 — fáze 0–2 nesmí odesílání ani
implementovat) a majitel upřesnil, že mu jde hlavně o **zamezení nechtěného
odeslání**; ve fázi 3 e-maily chce, včetně těchto upozornění.

Nabídl jsem náhradu: **oznámení Windows z hlídky u hodin** — běží u majitele
na počítači, takže nic neodesílá. **Majitel zatím neodpověděl.**

### 4. Asymetrie ve sbírání kontaktů

Sběr **kolem jídelny** zapisuje kontakt z otevřených dat MPSV.
Sběr **nad oblastí** ne — je to štíhlejší cesta. Nikdo to nerozhodl, jen
tak vzniklo. Proto má 13 767 firem jen 104 spojení. Stojí za srovnání.

### 5. Etapa D průvodce

Nezávislá kritika obrazovek (`design:design-critique`), přístupnost
(`design:accessibility-review`). Naplánované, nezahájené.

## Pasti, na které se dnes přišlo (a stály čas)

Všechny jsou i v `memory/poznatky.md`, tohle je jen rozcestník:

- **Kořenový `npm run typecheck` nekontroloval `app/`.** Opraveno — pouští
  teď obojí. Než se odvoláš na kontrolu, ověř, co doopravdy kontroluje.
- **Sestavení na Vercelu padalo od etapy B**, protože si aplikace přes
  `kvalifikace.ts` tahala `db.ts` a s ním ovladače Postgresu. Vyřešeno
  čistým modulem `src/sito.ts`; hlídá `test/hranice-aplikace.test.ts`.
  Reprodukce: kopie `src/` a `app/` do prázdné složky + `npm install --prefix app`.
- **Server má strop na počet řádků a `.limit()` ho nepřebije.** Aplikace
  tiše viděla 1 000 firem z 13 767. Čte se po stránkách.
- **Zamítnutý zápis Supabase nehlásí jako chybu** — jen změní nula řádků.
  Každý zápis proto `.select("id")` a kontrola počtu.
- **PowerShell 5.1 čte `.ps1` jako ANSI** — soubory s diakritikou musí mít
  UTF-8 BOM, jinak se rozsypou i řetězce.
- **`CANTINERO_DATA_DIR` neplatí, když je nastavené `DATABASE_URL`.**
- **Skript, který jen vypíše „hotovo", nic nedokazuje.** U automatických
  úprav textu porovnávat před a po — a hlídat KAŽDOU náhradu zvlášť, ne
  celý soubor najednou (jedna povedená zamaskuje druhou nepovedenou).

## Co čeká na majitele (nezměněno z dřívějška)

- Licence otevřených dat ČSÚ — právní věc před ostrým provozem.
- Rozhodnutí o SVJ a živnostnících v kartotéce.
- Návrh Čmuchala: registry zadávacích řízení u mikrofirem bez webu.
- Kapacity jídelen ve Zbůchu, Tlučné a Hrádku.
- V archivu leží zkušební kampaně z dnešního testování.

## Čemu při psaní kódu odpovídá „hotovo"

1. `npm test` (416 zelených) **a** `npm run typecheck` (obojí, i `app/`).
2. U frontendu **proklikat v prohlížeči** — testy ani typy nechytí vady
   toku a pořadí.
3. U migrací **nasadit** (`npm run cli -- migrate`) — do předávky patří
   „co je nasazené", ne jen „co je otestované".
4. Před tvrzením o nasazení pustit `npm run build --prefix app`.
