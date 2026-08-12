# Podklad pro advokáta — Cantinero

**Připraveno:** 11. 8. 2026 · **Pro:** advokát se specializací na e-privacy
a ochranu osobních údajů · **Stav systému:** sbírá data, **nikdy nic
neodeslal**

> Tenhle dokument napsal agent jako podklad k jednání. **Není to právní
> stanovisko** a nenahrazuje ho. Účelem je, aby advokát nemusel systém
> zjišťovat z rozhovoru — a aby otázky byly konkrétní.

---

## 1. Co systém dělá

Cantinero hledá firmy, kterým by dávalo smysl nabídnout **obědy
z partnerských školních jídelen** (a v druhém use-casu **docházkové
systémy** pro obce i firmy). Sbírá o nich veřejně dostupné údaje a chystá
individuální oslovení.

**Dnešní stav k 11. 8. 2026:**

| Údaj | Hodnota |
|---|---|
| Firem v kartotéce | 13 919 |
| Záznamů v evidenci (údaj + zdroj + citace) | ~7 300 |
| Kontaktních osob | ~1 100 |
| **Odeslaných zpráv** | **0** |
| Partnerských jídelen | 5 |

Odesílání je vypnuté přepínačem v databázi a **žádný kód dosud napsaný ho
neumí zapnout ani implementovat**. Zapnout ho smí pouze člověk, a to až po
této konzultaci.

## 2. Jaké údaje se sbírají a odkud

**Vždy s uvedením zdroje a doslovné citace.** Údaj bez doložení se nezapíše —
je to vynuceno v databázi, ne jen v instrukci.

| Kategorie | Konkrétně | Zdroj |
|---|---|---|
| Identifikace firmy | název, IČO, adresa, právní forma, obor činnosti | ARES (veřejný rejstřík) |
| Velikost | kategorie počtu zaměstnanců | registr ČSÚ |
| Kontaktní osoba | jméno, pozice, e-mail, telefon | otevřená data úřadu práce (inzeráty), web firmy, veřejný rejstřík (statutární orgán) |
| Provozní údaje | vlastní jídelna, způsob stravování, směnný provoz | web firmy, otevřená data úřadu práce |
| Popis činnosti | čím se firma živí, web firmy | web firmy, firemní katalogy |

**Co se nesbírá nikdy:** sociální sítě (ani ke čtení), finanční údaje
z účetních závěrek, recenze a hodnocení firmy, jakýkoli odhad nebo dopočet.

**Osobní údaje**, které v systému jsou: jméno, příjmení, pracovní pozice,
pracovní e-mail a telefon fyzických osob v roli zaměstnanců či statutárních
orgánů. Zdrojem je vždy zveřejnění samotným subjektem nebo veřejný rejstřík.

## 3. Vestavěná omezení

Tahle omezení jsou v systému vynucená kódem a databází, ne pokynem:

1. **Firma vzniká jen po ověření IČO v ARES.**
2. **Každý údaj má zdroj a doslovnou citaci**, jinak se nezapíše.
3. **Do zprávy smí jen užší, schválený seznam údajů.** Znalost z pracovních
   inzerátů (směnnost, benefity) se smí sbírat, ale **do zprávy se nedostane
   ani narážkou**.
4. **Jedna firma = jedno oslovení.** Žádné sekvence, žádné připomínání.
5. **Denní limit 10 zpráv**, zvýšit ho smí jen člověk.
6. **Prvních 50 zpráv schvaluje člověk** jednu po druhé.
7. **Priorita poptávkových adres**: adresa výslovně zveřejněná pro nabídky
   má přednost před jmennou adresou konkrétního člověka. U každé adresy se
   eviduje, k jakému účelu byla zveřejněna.
8. **Sledování otevření zpráv se nepoužívá** — první oslovení neobsahuje
   sledovací pixel.
9. **Okamžité vyřazení** na žádost, včetně celé domény.
10. **Každý běh agenta je zaznamenaný.**

## 4. Právní kontext, jak mu rozumíme

Shrnutí z našeho zadání, **k ověření a opravě**:

- Rozesílání obchodních sdělení bez předchozího souhlasu je přestupkem,
  pokud probíhá **hromadně nebo opakovaně**. Riziko roste s objemem,
  opakováním a s nespokojeností příjemců.
- Zveřejnění kontaktu firmou samo o sobě souhlas nenahrazuje; podle
  společného výkladového stanoviska ČTÚ, ÚOOÚ a MPO je u kontaktu
  zveřejněného samotným subjektem potřeba posuzovat účel zveřejnění.
- Výkladová stanoviska nejsou závazná.
- Sankce u právnických osob až 10 000 000 Kč, odpovědnost objektivní,
  dopadá i na zprostředkovatele. Automatizace není polehčující okolnost.

## 5. Otázky

### A. Oslovování

1. **Je náš výklad „hromadně nebo opakovaně" správný?** Je 10 individuálních
   zpráv denně, každé firmě právě jednou, bez sekvencí, mimo tenhle pojem —
   nebo rozhoduje součet za delší období?
2. **Jaký význam prakticky má, že adresa byla zveřejněna výslovně pro
   nabídky** (`poptavky@`, „pro nabídky dodavatelů")? Stačí to jako opora,
   nebo je to jen polehčující okolnost?
3. **Adresný dopis** (papírová pošta na firmu) — jaký je jeho režim proti
   e-mailu? Zvažujeme ho u firem, kde máme jen jmennou adresu.
4. **Telefon** — nepoužíváme ho a nechceme. Je důvod to změnit?
5. **Co má obsahovat každá zpráva**, aby byla v pořádku (identifikace
   odesílatele, způsob odmítnutí, poučení)?
6. **Podepsaná osoba** — jaké povinnosti a odpovědnost na sebe bere člověk,
   pod jehož jménem zprávy odejdou?

### B. Sběr a zpracování osobních údajů

7. **Je oprávněný zájem správnou právní titulaturou** pro tenhle sběr?
   Pokud ano, jak má vypadat vyvažovací test a musí být písemný?
8. **Informační povinnost** vůči osobám, jejichž jméno a pracovní kontakt
   máme z veřejných zdrojů — v jakém rozsahu a kdy?
9. **Doba uchování.** Jak dlouho smíme držet kontakt firmy, která
   nereagovala, a jak dlouho záznam o tom, že si nepřála být oslovena?
10. **Registr smluv** (`data.smlouvy.gov.cz`) chceme použít jako zdroj —
    obsahuje osobní údaje a při stažení se stáváme jejich správcem.
    **Jaké povinnosti tím vznikají** a je to při našem účelu přiměřené?
11. **Údaje z pracovních inzerátů** (otevřená data úřadu práce) — smíme
    z nich brát provozní informace o firmě, když je do zprávy nikdy
    nepoužijeme?

### C. Produktizace — nabízení systému dalším firmám

12. **Co se mění, když systém nabídneme jiným firmám?** Naše zadání říká,
    že správa souhlasů pak musí být nevypnutelnou součástí produktu.
13. **Jaké je rozdělení odpovědnosti** mezi nás jako dodavatele nástroje
    a zákazníka, který ho použije? Jsme zpracovatel, správce, nebo jen
    dodavatel software?
14. **Co musí být ve smlouvě se zákazníkem** a co v jeho vlastní
    dokumentaci?
15. Je nějaká podoba produktu, kterou **nedoporučujete vůbec**?

### D. Míra rizika

16. **Kde na rizikové škále** se náš postup nachází? Zajímá nás upřímný
    odhad, ne ujištění.
17. **Co bychom měli změnit jako první**, kdybyste měl vybrat jedinou věc?

## 6. Co potřebujeme jako výstup

1. Písemné stanovisko k bodům A a B — postačí stručné.
2. **Jasné ano/ne k zahájení fáze 3** (prvních 10 zpráv denně se schvalováním).
3. Seznam změn, které musíme udělat před odesláním první zprávy.
4. Rozhodnutí, jestli otevřít bod C hned, nebo až bude o produktizaci
   rozhodnuto.

## 7. Přílohy k jednání

| Co | Kde |
|---|---|
| Závazné zadání systému včetně tvrdých pravidel | `SPEC.md` |
| Právní kapitola zadání | `SPEC.md`, kap. 13 |
| Datový model | `supabase/migrations/0001_init.sql` |
| Jak systém funguje, lidsky | `docs/JAK-TO-FUNGUJE.md` |
| Pravidla pro sběr údajů | `SPEC.md`, kap. 5 |

---

**Kontakt za projekt:** majitel projektu Cantinero.
**Termín:** před zahájením fáze 3; dřív, pokud se rozhodne o produktizaci.
