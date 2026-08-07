# Profil produktu — co se o kom zjišťuje

**Stav:** k odsouhlasení · **Datum:** 2026-08-07

> Provádí rozhodnutí z `docs/adr/0002-dve-vrstvy-a-nastavitelnost.md`
> (schváleno 6. 8.). Při rozporu platí `SPEC.md`.

## 1. K čemu to je

Systém se má dát přenastavit pro jinou cílovku, aniž by se sahalo do kódu.
Majitel ho chce použít pro tři další vlastní projekty a případně prodat.

Dnes profil umí **jen koho brát** (velikost, právní formy, obory) a je
**globální** — právě jeden aktivní pro celý systém. Kampaň o profilu neví nic.

Tahle práce přidá dvě věci:

1. **Profil říká, co se má o firmě zjišťovat.**
2. **Profil visí na kampani**, takže tři projekty můžou běžet vedle sebe.

Třetí část z ADR 0002 — „čím oslovit" — se **nedělá**. Odesílání je
zablokované na tvrzeních, šablonách, doméně a právní konzultaci; pole pro
zadání ke zprávě by teď nemělo co ovlivňovat.

## 2. Co ukázala data (2026-08-07)

| Atribut | Řádků v evidenci |
|---|---|
| velikost_kategorie | 5 908 |
| kontakt | 1 042 |
| adresa | 167 |
| ucel_adresy | 129 |
| obor | 7 |
| **ma_vlastni_jidelnu** | **2** |
| **zpusob_stravovani** | **1** |

Celkem 7 256 řádků, 2 profily (`cantinero` aktivní, `cantinero-business`).

**Dvě věci z toho plynou.** Za prvé: přechod na rejstřík je čistý — všech
sedm hodnot je v dnešním whitelistu, nic se nemusí převádět ani uklízet.
Za druhé, a to je varování: **na dva „zajímavé" atributy připadají tři
záznamy.** Stavíme mechanismus na sbírání dalších atributů nad atributy,
které se prakticky nikdy nepodařilo dohledat. Nové (směnný provoz,
provozovny) můžou být na webech snáz k nalezení, ale je to sázka.

**Důsledek pro tuhle práci:** hotovo neznamená „mechanismus funguje", ale
**„na skutečné dávce se novým atributem něco dohledalo, i s citací"**.
Když se nedohledá nic, je to zpráva o výtěžnosti, ne o kódu — ale majitel
ji musí dostat, ne ji zjistit sám za měsíc.

## 3. Rejstřík atributů

Seznam povolených atributů je dnes napevno na dvou místech: `src/whitelist.ts`
a podmínka `check` na `evidence.atribut`. Nově vznikne tabulka:

| Sloupec | K čemu |
|---|---|
| `kod` | `zpusob_stravovani`, `smenny_provoz`, … |
| `nazev` | lidsky, do obrazovky |
| `popis` | **co se u toho hledá** — jde rovnou agentovi |
| `do_zpravy` | smí se objevit v oslovení? |

Osm dnešních atributů se nasype s `do_zpravy = true`. Nové ho mít nebudou.

**Tím se TP-3 rozdělí přesně tak, jak ADR 0002 schválilo:** `do_zpravy` hlídá
**zprávu**, profil hlídá **sběr**.

`evidence.atribut` se z pevné podmínky změní na **cizí klíč do rejstříku**.
Záruka „vymyšlený atribut neprojde" tím zůstává v databázi, jen se
přestěhuje. Je slabší než dnes v tom, že rejstřík jde rozšířit — ale jen
záměrně a jen adminem, ne agentem.

### Popis je to nejcennější

Dnes agent dostane holé `"zpusob_stravovani"` a musí si domyslet, co s tím.
Nově dostane i větu: *„jak firma řeší obědy — stravenky, příspěvek, dovoz,
vlastní jídelna"*. Podle měření z 2. 8. (stravování dohledáno u 1 z 20) je
to nejpravděpodobnější zdroj zlepšení v celé téhle práci.

## 4. Profil říká, co sbírat

Vazební tabulka profil ↔ atributy. Profil „obědy z jídelen" dostane dnešních
osm; profil pro restaurace může mít jiné.

`firmyKObohaceni` počítá pole `chybi` **podle profilu**, ne podle pevného
seznamu jako dnes. Do souboru s prací se ke každému chybějícímu atributu
přidá i jeho `popis`.

## 5. Kampaň nese profil

Nový sloupec `kampane.profil_kod`, nepovinný. Když je prázdný, padá se na
globálně aktivní profil — stávající kampaně tím fungují dál beze změny.

Rešerše bere profil **z kampaně objednávky**. Sběr (`cmuchal`, `cmuchal-oblast`)
zůstává na globálním profilu: běží nad územím, kde kampaň ještě není.

**Dvě mechaniky vedle sebe jsou záměr, ne opomenutí** — a je to místo, kde se
dá splést. Proto: kdo čte profil, ať vždycky řekne, který bere.

## 6. Co se nemění

- **Každý údaj má zdroj a doslovnou citaci** (TP-2). Bez toho se nezapíše.
- **Sociální sítě nikdy**, ani ke čtení.
- **Nic se neodesílá** (TP-8).
- **Whitelist pro zprávu** platí dál — nově jako `do_zpravy` v rejstříku.
- Do sloupců v `companies` se propisuje dál jen těch pár atributů, které tam
  sloupec mají. **Vlastní atributy žijí jen v evidenci.**
- Sběr firem se nedotýká — 13 858 firem stojí na dnešním chování profilů,
  takže se do nich jen přidává, nikdy nemění.

## 7. Testy

1. Vymyšlený atribut mimo rejstřík **neprojde** — ani přes `zapisAtribut`,
   ani přímým zápisem do evidence.
2. Atribut v rejstříku, ale **mimo profil**, se do `chybi` nedostane.
3. `chybi` odpovídá profilu kampaně, ne globálnímu, když kampaň profil má.
4. Kampaň **bez** profilu padá na globálně aktivní.
5. Popis atributu dorazí do souboru s prací.
6. Atribut s `do_zpravy = false` **se nedostane do whitelistu pro zprávu**.
7. Osm dnešních atributů má po migraci `do_zpravy = true` a evidence
   (7 256 řádků) migraci přežije beze ztráty.

## 8. Co znamená „hotovo"

1. `npm test` a `npm run typecheck` zeleně, `npm run build --prefix app` projde.
2. Migrace nasazená.
3. **Ostrá dávka na Hrobcích s novým atributem** (návrh: směnný provoz).
   Ověřit, že se dohledal aspoň u jedné firmy **a má citaci** — nebo že se
   nedohledal a majitel to ví.

## 9. Rizika

**Slabší záruka u TP-3.** Dnes seznam nejde změnit bez zásahu do kódu; nově
jde. Pořád je to pojistka v databázi, ne v promptu.

**Sběr stojí na profilech.** Rozbít ho by znamenalo rozbít to, co funguje.
Proto jen přidávat.

**Výtěžnost je sázka** — viz kap. 2.

**Širší sběr = víc dat o firmách.** Pravidla (zdroj, citace, zákaz sociálních
sítí) platí dál, ale objem roste. Právní konzultace před ostrým odesíláním
zůstává otevřená.

## 10. Co tahle práce neřeší

- **Zadání ke zprávě** (ADR 0002, „čím oslovit") — až s fází 3.
- **Obrazovka pro správu profilů.** Profily se zatím spravují příkazovou
  řádkou jako dnes; kampaň dostane jen výběr z existujících.
- **Zámek schváleného seznamu v databázi** — samostatný otevřený bod.
