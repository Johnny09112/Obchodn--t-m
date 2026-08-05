# ADR 0002 — Dvě vrstvy (znalost vs. zpráva) a nastavitelnost produktu

**Stav:** ODSOUHLASENO 2026-08-06 · **Datum:** 2026-08-04

> SPEC kap. 5 a TP-3 podle tohohle rozhodnutí **upraveny**. Kód zatím ne —
> `src/whitelist.ts` a `src/repo.ts` dál odmítají zápis mimo whitelist, takže
> vrstva A je zatím jen na papíře. To je v pořádku: nic se nerozbije, jen se
> zatím nedá zapsat víc, než se dalo dřív.

## Kontext

Majitel upřesnil směr (4. 8. 2026):

1. Systém se má dát **přenastavit pro jinou cílovku** — sám ho chce použít
   pro tři další vlastní projekty, každý s jinou cílovkou a jinými daty.
   Mohl by zajímat i jiné firmy, protože běžné CRM/ERP jsou zbytečně složité,
   drahé a něco jim chybí.
2. **Každé nasazení běží u zákazníka** — jeho server nebo Supabase, jeho data,
   jeho klíč k LLM.
3. Jednotlivé instance mají jít později **připojit do jednoho velkého CRM**
   kvůli přehledu.
4. **Agent má o firmě zjistit hodně** — abychom věděli, co dělá — ale
   **e-mail má být rozumně personalizovaný, ne šitý na míru**.
5. Cíl je **5–10 oslovení denně v nejvyšší kvalitě**, ne objem.

## Jádro sporu

SPEC kap. 5 dnes slučuje dvě různé věci pod jeden pojem „personalizace":

> Cílem je relevance, ne demonstrace toho, kolik jsme toho zjistili.
> Přehnaná personalizace působí jako sledování a snižuje odezvu.

Tahle věta je **správně** a zůstává. Ale whitelist, který ji vynucuje, dnes
omezuje **i sběr** — a tím zakazuje i to, co se do zprávy nikdy nedostane
a slouží jen obchodníkovi na schůzce.

## Rozhodnutí

**Rozdělit na dvě vrstvy s vlastními pravidly.**

### Vrstva A — znalost o firmě

Co o firmě víme. Podklad pro obchod, schůzku, nabídku, pozdější CRM.

- **Rozsah je nastavitelný** podle profilu produktu (viz níž).
- Platí beze změny: **každý údaj má zdroj a doslovnou citaci** (TP-2), jinak
  se nezapíše. Žádné odhady, žádné dopočty.
- Platí beze změny: **sociální sítě nikdy**, ani ke čtení.
- Nově povoleno sbírat i to, co se do zprávy nesmí — protože se do ní nedostane.

### Vrstva B — obsah oslovení

Co firmě napíšeme.

- **Test pohlednice platí dál a beze změny.** Kdyby adresát viděl, odkud
  je každý údaj, musí to působit přirozeně.
- **Nosná věta zůstává** (vzdálenost k jídelně, volná kapacita) — u tohohle
  produktu. U jiného profilu bude jiná, ale pravidlo „jeden konkrétní,
  ověřitelný a užitečný fakt" platí vždycky.
- **Hloubka personalizace je nastavitelná**, ale shora omezená. Není to
  posuvník od nuly do nekonečna; je to volba mezi „střídmě" a „ještě
  střídměji".

**Klíč:** vrstva B smí čerpat jen z podmnožiny vrstvy A, ne z celé.
Sběr se rozšiřuje, zpráva ne.

## Profil produktu

Dnes existují `profily` (`src/profil.ts`), ale umí jen **koho brát** —
minimální velikost, právní formy, obory. Návrh je rozšířit tentýž mechanismus
o zbylé dvě otázky, ne stavět nový:

| Otázka | Dnes | Nově |
|---|---|---|
| Koho bereme? | ano | beze změny |
| Co o něm zjišťujeme? | napevno v kódu | součást profilu |
| Čím ho oslovíme? | napevno v šabloně | součást profilu |

Přepnutí na jinou cílovku (třeba jen restaurace) je pak změna profilu, ne
zásah do kódu. To je celý smysl.

**Prostor pro vlastní zadání ke zprávě** patří do profilu jako pole, které
si uživatel edituje. Není to volný prompt bez hranic — skládá se s pravidly
vrstvy B, která přebít nejde. Uživatel určuje tón a důraz, ne to, jestli
platí test pohlednice.

## Nasazení: víc instancí, ne víc nájemníků

Původně jsem navrhoval vícenájemnost (jedna databáze, oddělená data
zákazníků). **Majitel to upřesnil jinak a je to podstatně jednodušší:**

- Každé nasazení je **vlastní instance** na infrastruktuře zákazníka.
- Data se nemíchají, protože nejsou ve stejné databázi.
- **Vícenájemnost se nestaví vůbec** — ušetří to velkou a špatně vratnou
  práci.

Co z toho naopak plyne jako nová práce:

- **Postavit novou instanci musí být snadné.** Dnes to znamená migrace,
  `.env`, profil, seed jídelny. Zaslouží si to sepsaný postup a ověření, že
  na čisté databázi projde.
- **Propojení instancí do jednoho CRM** je samostatný úkol na později. Teď
  stačí nebránit mu — držet IČO jako klíč a nezavádět nic, co by šlo jen
  lokálně.

## LLM: klíč zákazníka, ne naše předplatné

**Tohle je nejzávažnější důsledek celé změny.**

Dnes rešerši dělá **podagent uvnitř Claude Code** na majitelově počítači,
z jeho předplatného. To se prodat nedá — zákazník Claude Code mít nemusí.

Druhá cesta ale už existuje: `src/enrich.ts` volá **Anthropic SDK přes
`ANTHROPIC_API_KEY`**. Je zadrátovaná na tři atributy a nikdy neběžela
naostro (proto je v přehledu 0 USD).

**Návrh:** cesta přes API klíč se stane cestou produktovou. Podagent
v Claude Code zůstane jako pohodlí pro majitele, ne jako základ produktu.

**Rozhodnutí majitele (2026-08-06):** cesta přes API klíč se **připraví**,
ale ostrý provoz zatím jede **z předplatného**. Není to náhrada, je to druhá
možnost vedle stávající.

**Jiný LLM:** neřeší se. Časem přichází v úvahu **lokální model** pro
zájemce o plně interní systém s výkonným serverem — proto se místo, které
volá model, udrží jako **jeden jasně oddělený šev**, ať se do toho
nezabetonujeme. Adaptéry pro cizí poskytovatele se nestavějí.

### Co by API stálo

Odhad z **jediného naměřeného běhu** (20 firem, 201 152 tokenů, 2. 8. 2026),
rozdělení vstup/výstup odhadnuté na 90/10. **Řádový odhad, ne rozpočet.**

Zhruba 10 000 tokenů na firmu:

| Model | Na firmu | Čachrov (91) | Plzeň cílové (620) |
|---|---|---|---|
| Sonnet 5 | ~0,04 USD | ~3,50 USD | ~24 USD |
| Haiku 4.5 | ~0,014 USD | ~1,30 USD | ~9 USD |

**Při cílovém provozu 5–10 oslovení denně** (tedy ~10 firem denně) vychází
Sonnet na **~0,40 USD denně, ~12 USD měsíčně**. Cena je tedy problém jen
u hromadného dohánění, ne u běžného provozu.

Dvě varování: hlubší rešerše (vrstva A) bude stát **dvoj- až trojnásobek**
proti měření, které hledalo jen kontakt. A **ukládání do mezipaměti** to
naopak srazí — instrukce agenta jsou u každé firmy stejné.

## Právní poloha

Původně jsem varoval, že prodej třetím stranám právní nároky násobí.
**Majitel to upřesnil a moje obava byla přehnaná:** když si každý zákazník
provozuje vlastní instanci na vlastních datech a vlastním klíči, je
správcem těch dat on, ne my.

Nezmizí tím ale povinnost, aby **nástroj umožňoval zákonné použití
snadno** — a přesně to dělají pravidla, která už máme: doložený zdroj
u každého údaje, zákaz sociálních sítí, zákaz odhadovaných adres.
Ta pravidla nejsou brzda, jsou to prodejní argument.

Právní konzultace zůstává otevřená a před ostrým odesíláním nutná.

## Co se tímhle NEMĚNÍ

- **Nic se neodesílá** (TP-8). Fáze 3 zůstává zablokovaná na tvrzeních,
  šablonách, odesílací doméně a právní konzultaci.
- **Jedna firma = jedno oslovení** (TP-5).
- **Firma vzniká jen po ověření v ARES** (TP-1).
- **Každý atribut má zdroj a citaci** (TP-2).
- **Sociální sítě nikdy.**
- **Test pohlednice** pro obsah zprávy.

## Které tvrdé pravidlo se mění

**TP-3.** Dnes zní: sbírá a personalizuje se jen whitelist atributů.
Nově by znělo: **personalizuje** se jen whitelist; **sbírá** se podle
profilu produktu, pořád jen s doloženým zdrojem a bez zakázaných kategorií.

Je to jediná změna tvrdého pravidla v tomhle návrhu. Bez souhlasu majitele
se neděje.

## Pořadí prací

1. **Přezacílit kontakt** na HR / vedení / jednatele místo poptávkových
   adres. Nesouvisí se zbytkem, je to levné a měření ukazuje, že současné
   pořadí míří vedle. *(Lze udělat hned, nezávisle na tomhle ADR.)*
2. **Fronta a tlačítko pro AI průzkum** — už odsouhlasené. Postavit tak,
   aby objednávka **nesla zadání, co hledat**; tím je to připravené na
   profily, aniž by se teď stavěly.
3. **Dvě vrstvy a profil produktu** — jádro téhle změny. Vlastní zadání.
4. **Cesta přes API klíč** jako produktová, se švem pro jiné poskytovatele.
5. **Postup pro novou instanci** — ověřený na čisté databázi.

**Nestaví se teď:** vícenájemnost (nebude vůbec), propojení instancí do
jednoho CRM (později), FSM/ERP/účetnictví (směr, ne úkol).

## Rozhodnuto (2026-08-06)

1. **Změna TP-3 schválena.** SPEC kap. 5 rozdělena na vrstvu A (znalost)
   a vrstvu B (zpráva); TP-3 nově výslovně váže zprávu, ne sběr.
2. **API klíč se připraví, ostrý provoz jede z předplatného.**
3. **Jiný LLM se neřeší**, jen se udrží šev kvůli budoucímu lokálnímu modelu.

### Co při úpravě SPEC vyšlo najevo

TP-3 ve SPEC **nikdy neomezoval sběr** — mluvil o rendereru a o zprávě.
Zákaz sbírat cokoli mimo whitelist vznikl až v kódu (`repo.ts` zápis odmítne)
a v projektovém `CLAUDE.md`. Změna je tedy menší, než se zdálo: SPEC se
upřesnil, ale nepřevrátil. Skutečná změna čeká v kódu.
