# Dodatečné rozšíření kampaně o firmy bez známé velikosti — zadání

**Stav:** k odsouhlasení · **Datum:** 2026-08-03

> Navazuje na `docs/superpowers/specs/2026-07-31-pruvodce-kampani-obrazovky-design.md`
> (průvodce, kroky 1–4). Při rozporu platí `SPEC.md`.

## 1. K čemu to je

Při zakládání kampaně se ve 2. kroku rozhoduje, jestli vzít i firmy, u kterých
registr neuvádí velikost. Majitel to rozhodnutí potřebuje udělat **i potom** —
typicky když uvidí, že kampaň má pět firem a dalších osmašedesát leží stranou.

Dnes to prakticky nejde. Formálně ano (zpět na 2. krok, zaškrtnout, zase
dopředu, „Doplnit z území"), ale:

1. **Zaškrtnutí se nepamatuje.** `zahrnoutNezname` je jen stav Reactu
   (`PruvodceKampani.tsx`, `useState(false)`). Po znovuotevření rozdělané
   kampaně je odškrtnuté — i když ty firmy v kampani dávno jsou.
2. **Hláška ve 4. kroku posílá o dva kroky zpět** místo aby akci nabídla.
3. **Hláška zmizí.** `preskoceno` se plní jen z výsledku `naplnKampanZOblasti`,
   takže se ukáže hned po stisku a po znovuotevření už ne. Kampaň pak mlčí
   o tom, že něco čeká.

Bod 3 je stejná vada, kterou popisuje [[sber-neukladal-velikost]]: prázdný
výsledek bez důvodu vypadá jako rozbitá aplikace.

## 2. Rozhodnutí majitele (2026-08-03)

- **Volba patří ke 4. kroku**, k seznamu firem — tam, kde je následek vidět.
  Zaškrtnutí ve 2. kroku zůstává jako předvolba při zakládání.
- **Počet se nikam neukládá**, dopočítá se z dat. Žádná migrace, žádný sloupec
  `kampane.zahrnuje_nezname`, který by se mohl rozejít se skutečností.
- **Přidání je jednosměrné.** Hromadné odebrání nebude. Kdo nesedí, vyřadí se
  jednotlivě s důvodem, jak to jde dnes — jinak by se smazala i rozhodnutí
  udělaná mezitím.

### 2.1 Doplněno po revizi 2. úkolu (2026-08-03)

Revize odhalila, že přepis mění, které firmy se vypíšou jako vyřazené. Při
dotazu na to majitel řekl: *„mě zajímají především také firmy do 24
zaměstnanců, nezajímají mě společenství."* Kontrola SPEC.md tomu dala za
pravdu — a odhalila rozpor:

- **SPEC.md kap. 10.2 zná mikropodnik (do 25) jako plnohodnotný segment**
  s vlastním úhlem oslovení („krátce, cena, jednoduchost, žádná
  administrativa"). `src/score.ts` jim přiděluje body, ne nulu.
- **Aplikace je přesto zahazovala.** Pravidlo „mikro se do kampaně neberou
  nikdy" v SPEC nikde není; bylo zadrátované v `naplnKampanZOblasti`
  s komentářem „obědy pro pět lidí nedávají smysl ani jedné straně".

Rozhodnutí majitele:

- **Firmy do 24 zaměstnanců jde přibrat stejně jako firmy bez známé
  velikosti** — vlastní nabídkou a vlastním potvrzením, ne jedním tlačítkem
  pro obojí. Segmenty se rozhodují zvlášť, protože jsou to různá rozhodnutí.
- **Společenství vlastníků se tím nepřibírají.** Vyhazuje je síto jako bytový
  dům (`jeBytovyDum`, kódy 145 a 233) bez ohledu na velikost — tedy skončí
  v koši `sito`, ne v koši `mikro`. Tohle je přesně ten rozdíl, který majitel
  pojmenoval, a drží se sám od sebe.
- **Výpis vyřazených se omezí na prvních 50** a pod nimi bude „… a dalších N
  firem". Kampaň nad Plzní by jinak vypsala přes tisíc řádků na jednu
  obrazovku.

## 3. Co uvidí majitel

Ve 4. kroku přibude panel, který se ukáže **při každém otevření kampaně**, ne
jen po stisku tlačítka. Nabídky jsou **dvě, každá zvlášť** — přibrat firmy bez
známé velikosti a přibrat malé firmy jsou dvě různá rozhodnutí a slučovat je
do jednoho tlačítka by majiteli sebralo volbu:

> V území čeká **68 firem, u kterých registr neuvádí velikost**.
> Dohledání kontaktů u nich zabere navíc ~2 hodiny.
> `[ Přidat 68 firem s neznámou velikostí ]`
>
> A dál **23 firem do 24 zaměstnanců**. Dohledání kontaktů ~1 minutu.
> `[ Přidat 23 malých firem ]`

Každá nabídka se zobrazí jen tehdy, když v ní něco čeká. Když nečeká nic,
panel není vidět vůbec.

**Když je kampaň prázdná**, začne panel důrazněji — *„Do kampaně se zatím
nedostala žádná firma."* Přesně tohle se stalo u Čachrova a vypadalo to jako
rozbitá aplikace.

Odhad práce navíc počítá `odhadKontaktu` ze `src/odhady.ts` — tentýž, jaký
používá 2. krok. Dvě různá čísla o téže věci nikde nebudou.

**Výpis vyřazených** („V území leží, ale do kampaně nepatří") se omezí na
**prvních 50 firem**; pod nimi bude „… a dalších N firem". Počet v nadpisu
zůstává úplný.

## 4. Co tlačítka udělají

Obě stejně, liší se jen tím, který koš přiberou:

1. Otevřou potvrzení (`zaclona`/`dialog`, jako „Vyřadit" a „Schválit"): kolik
   firem, kolik práce navíc, a že zpátky to jde jen po jedné s důvodem.
2. Po potvrzení zavolají `naplnKampanZOblasti` s příslušným rozsahem.
3. Znovu načtou seznam i počty.

Rozsah se předává výslovně, ne záporem — `jenCilove` zmizí:

```ts
opts: { zahrnoutNezname?: boolean; zahrnoutMikro?: boolean }
```

Cílová velikost se bere vždycky. „Přidat firmy s neznámou velikostí" pošle
`{ zahrnoutNezname: true }`, „Přidat malé firmy" pošle `{ zahrnoutMikro: true }`.
Volba ve 2. kroku pošle `{ zahrnoutNezname: zahrnoutNezname }`.

**Žádné tlačítko nikdy nepřidá míň než „Doplnit z území".** Je to totéž
doplnění, jen širší — případné chybějící firmy v cílové velikosti se přiberou
taky. To je správně a nepřekvapí to.

**Pole `preskoceno` z `NaplneniKampane` mizí.** Bylo tam jen pro hlášku, kterou
panel nahrazuje; panel čte `spocitejCekajici`, které platí i po znovuotevření.
Ponechat obojí by znamenalo dvě čísla o téže věci. Volá to jediné místo
(`PruvodceKampani.tsx:288`), takže odstranění nic dalšího nerozbije.

## 5. Proč se číslo nemůže rozejít s tlačítkem

Panel a plnění musí používat **jedno pravidlo**, ne dvě podobná. Dnes to
pravidlo žije uvnitř `naplnKampanZOblasti` (`app/src/data.ts`) jako cyklus,
který zároveň klasifikuje i vkládá.

Vytáhne se do **nového modulu bez databáze** `src/kampan-kandidati.ts`:

```ts
export type Kosik = "cilova" | "bez_velikosti" | "mikro" | "sito";

export interface Kandidat {
  ico: string;
  nazev: string;
  kosik: Kosik;
  /** Vyplněné jen u koše `sito` — proč firma neprojde. */
  duvod: { duvod: string; detail: string } | null;
}

/** Roztřídí firmy z území podle toho, proč (ne)patří do kampaně. */
export function roztridKandidaty(vstup: {
  firmy: readonly FirmaProTrideni[];
  vUzemi: ReadonlySet<string>;
  jizVKampani: ReadonlySet<string>;
  sito: { partnerskaIca: ReadonlySet<string>; blacklist: readonly Pravidlo[] };
}): Kandidat[];
```

`FirmaProTrideni` nese jen to, co třídění potřebuje: `ico`, `nazev`,
`velikost_kategorie`, `cz_nace`, `pravni_forma`, `ma_vlastni_jidelnu` — tedy
vstup síta plus velikost. Je to podmnožina `Firma` z `app/src/data.ts`, aby
šla předat beze změny.

Modul je čistý výpočet — žádné `db.js`, žádný Supabase. Splňuje tím hranici,
kterou hlídá `test/hranice-aplikace.test.ts` ([[vercel-instaluje-jen-app-zavislosti]]),
a dá se testovat offline jako `src/sito.ts` nebo `src/pruzkum-postup.ts`.

`app/src/data.ts` pak dělá dvě věci nad týmž výpočtem:

- `naplnKampanZOblasti(...)` — vloží koš `cilova` vždycky, `bez_velikosti` při
  `zahrnoutNezname`, `mikro` při `zahrnoutMikro`. Předává **prázdnou**
  `jizVKampani`: duplicity odchytí `on conflict do nothing` a seznam
  `vynechano` musí dál vypisovat všechny firmy zadržené sítem, ne jen ty nové.
  Návratový tvar je `{ pridano, vynechano }` — `preskoceno` mizí (viz kap. 4).
- `spocitejCekajici(kampanId, oblastiIds)` — vrátí `{ cilova, bezVelikosti,
  mikro }`, počty firem, **které v kampani ještě nejsou**. Tady se `jizVKampani`
  naopak předává vyplněná; jinak by panel sliboval víc, než tlačítko přidá.

Klíčové: `jizVKampani` obsahuje i firmy vyřazené ručně. Ty se nevzkřísí
(vkládá se `on conflict do nothing`), takže se nesmějí počítat mezi čekající —
jinak by panel sliboval 68 a tlačítko přidalo 60.

## 6. Změna ve 2. kroku

Zaškrtnutí zůstává. Mění se jen poznámka pod ním, která dnes lže u kampaně,
kde ty firmy už jsou:

- **dnes:** „Zbylých 68 firem zůstane stranou — mezi nimi jsou i skutečné
  firmy, u kterých registr velikost prostě neuvádí."
- **nově:** „Naplnění vezme jen firmy s doloženými 25 a více zaměstnanci.
  Zbylých 68 mezi nimi má i skutečné firmy, u kterých registr velikost prostě
  neuvádí — **přibrat je můžete i potom**, tlačítkem v posledním kroku."

Rozdíl je v čase: stará věta tvrdí, jak to dopadne natrvalo, nová mluví
o nejbližším naplnění a říká, že rozhodnutí není konečné.

Zaškrtnutí se dál nikam neukládá. Následek je nulový: plnění nikdy nic
neodebírá, takže odškrtnuté políčko po znovuotevření nemůže nic pokazit —
jen se z panelu ve 4. kroku dozvíš, že už nic nečeká.

## 7. Co se nemění

- **Cílová velikost se bere vždycky**, bez ptaní. Přibírá se jen to ostatní.
- **Společenství vlastníků a bytová družstva se nepřibírají** za žádného
  rozsahu — vyhazuje je síto, ne velikost.
- Ručně vyřazené firmy se doplněním nevzkřísí.
- Schválená kampaň zůstává zamčená — panel se v ní neukáže.
- Síto `duvodNeoslovovat` platí beze změny; vyřazené se dál vypisují i s důvodem.
- **Nic se neodesílá** (TP-8).

## 8. Testy

Nové v `test/kampan-kandidati.test.ts` (PGlite/offline, čistý výpočet):

1. Firma v cílové velikosti → koš `cilova`.
2. Firma bez známé velikosti → koš `bez_velikosti`, ne `cilova`.
3. Firma do 24 zaměstnanců → koš `mikro`.
4. Firma na blacklistu → koš `sito` i s důvodem, i když je v cílové velikosti.
4b. **Společenství vlastníků (právní forma 145) → koš `sito`, ne `mikro`** —
   i když je malé. Tohle je ten rozdíl, o který majiteli šlo: malé firmy ano,
   společenství ne. Kdyby se to rozbilo, tlačítko „přidat malé firmy" by
   začalo tahat do kampaně bytové domy.
5. **Firma už v kampani se mezi čekající nepočítá.**
6. **Firma ručně vyřazená z kampaně se mezi čekající nepočítá** — tohle je ta
   past z kapitoly 5.
7. Firma mimo území se neobjeví vůbec.

Rozšířit `test/hranice-aplikace.test.ts` není třeba — nový modul projde
stávající kontrolou automaticky, protože `db` ani `repo` neimportuje.

## 9. Co znamená „hotovo"

1. `npm test` a `npm run typecheck` zeleně.
2. `npm run build --prefix app` projde ([[vercel-instaluje-jen-app-zavislosti]]).
3. **Proklikáno v prohlížeči na kampani nad Čachrovem** — ověřit, že čísla
   v panelu sedí s tím, kolik firem tlačítka doopravdy přidají, že po přidání
   nabídka zmizí, a že mezi přidanými malými firmami **není ani jedno
   společenství vlastníků** ([[zelene-testy-nejsou-hotova-obrazovka]]).

## 10. Co tahle práce neřeší

**Objednání rešerše z aplikace.** Majitel si dnes může objednat průzkum (sběr
firem z rejstříků), ale ne rešerši Čmuchalem — ta běží jen na vyžádání v chatu,
protože pro ni neexistuje fronta ani hlídka. Po přidání 68 firem bez známé
velikosti je to přirozený další krok, ale je to **vlastní úkol**, ne součást
tohoto zadání.
