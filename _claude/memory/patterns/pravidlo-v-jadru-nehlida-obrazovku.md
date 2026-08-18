---
name: pravidlo-v-jadru-nehlida-obrazovku
description: Pravidlo napsané v src/ nehlídá obrazovku — aplikace zapisuje do Supabase přímo a na jádro nedosáhne; patří do databáze
type: pattern
status: active
created: 2026-08-18
updated: 2026-08-18
related: [tri-kopie-seznamu-atributu, zamitnuty-zapis-bez-chyby, vercel-instaluje-jen-app-zavislosti, zelene-testy-nejsou-hotova-obrazovka]
---

**Objeveno 18. 8. 2026** při proklikávání obrazovky Jídelny, dvakrát během
deseti minut.

Aplikace **nesmí importovat nic z kořenového `src/`** — Vercel instaluje jen
závislosti `app/` ([[vercel-instaluje-jen-app-zavislosti]]). Zapisuje proto
do Supabase přímo, přes datové API. **Každé pravidlo napsané jen v jádře je
tím pádem pro obrazovku neexistující.**

**Třetí výskyt téhož dne, tentokrát obráceně** — pravidlo v jádru
nehlídalo, co obrazovka SLIBUJE: aplikace nabídla „objednat rešerši pro
20 firem" vlastním výpočtem (razítko + spojení), jádro od 13. 8. filtruje
i stav firmy — a objednávka Hrobců skončila „hotovo, 0 firem" beze slova.
Řešení stejné: pravidlo do DB (funkce `firmy_pro_reserse`, migrace 0054),
jádro deleguje, aplikace počítá z téže funkce, paritu hlídá test.

| Co se stalo | Co pravidlo mělo hlídat |
|---|---|
| Do ostré databáze se uložila **cena −5 Kč** | `zkontrolujHodnotu` v `src/parametry.ts` zápornou hodnotu odmítá |
| Nově zavedený parametr skočil **nad Cenu oběda** | `zavedParametr` dopočítává pořadí na konec |

Testy byly přitom zelené — testovaly jádro, kterým obrazovka neprochází.
Odhalilo to teprve proklikání ([[zelene-testy-nejsou-hotova-obrazovka]]).

**Řešení, které se nabízí první a je špatné:** opsat pravidlo do `app/`.
Vznikne třetí kopie a ty se rozejdou ([[tri-kopie-seznamu-atributu]]).

**Správné řešení: pravidlo patří do databáze** — spouští nebo podmínkou.
Tam projde každý zápis, ať přišel odkud chtěl. Migrace 0046 a 0047 to dělají
takhle a **hlášky píšou česky**, protože je aplikace ukazuje uživateli tak,
jak přijdou.

**Poznávací otázka při každém novém pravidle:** *Projde tudy i zápis
z obrazovky?* Když ne, patří to do DB. Kontrola v TypeScriptu smí zůstat
jako pohodlí (rychlejší odezva, tatáž věta), ale nesmí být jedinou pojistkou.

Totéž říká projektový CLAUDE.md o tvrdých pravidlech: *„vynucují se
v kódu/DB, instrukce v promptu není záruka"*. Tady se ukázalo, že ani
instrukce v jádře není záruka pro obrazovku.
