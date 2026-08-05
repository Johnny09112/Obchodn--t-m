# ADR 0002 — Dvě vrstvy (znalost vs. zpráva) a nastavitelnost produktu

**Stav:** K ODSOUHLASENÍ · **Datum:** 2026-08-04

> Návrh změny **SPEC kap. 5**. Dokud ho majitel neschválí, platí SPEC beze
> změny a nic z tohohle se nestaví.

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

**Jiný LLM než Claude** je legitimní přání, ale je to vlastní práce.
Navrhuju **připravit švy** (jedno místo, které volá model, jasně
oddělené) a **implementovat zatím jen Claude**. Stavět tři adaptéry pro
poskytovatele, které nikdo neověřil, je předčasné.

**Pozor na náklady:** dnes je 0 USD, protože placená cesta neběžela.
Jakmile se produkt postaví na API klíč, **rešerše začne stát peníze** —
u zákazníka jeho vlastní, u nás naše při testování. Je to čisté rozhodnutí
majitele a patří do rozpočtu, ne do technického návrhu.

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

## Co potřebuje majitel rozhodnout

1. Souhlasí se **změnou TP-3** popsanou výš?
2. Souhlasí s tím, že **produktová cesta poběží na API klíč**, a tedy že
   rešerše u nás při testování **začne stát peníze**?
3. Má se **jiný LLM než Claude** připravit jen jako šev, nebo ho chce
   rovnou funkční?
