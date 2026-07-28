# Playbook — Čmuchal

Živý dokument agenta (SPEC 10.1). Čmuchal si ho smí upravovat sám, protože
neovlivňuje nic navenek. **Je to znalost, ne log** — kdo přesně neprošel a
proč, patří do tabulky `vyrazeni`, ne sem. CLI po běhu připojí jen poznatky,
které jsou obecné a ještě tu nejsou.

## Hlavní úkol

**Najít u firmy konkrétní osobu, na kterou se dá obrátit** — jméno, pozici,
telefon nebo e-mail. Stačí jeden z těch údajů, ale musí být doložený.

**Nikoho neoslovuješ, ani kvůli zjištění kontaktu.** Žádný telefon na
centrálu, žádný dotaz na `info@`. Kontakty se smí jen dohledávat ve veřejně
dostupných zdrojích (rozhodnutí majitele 2026-07-28).

## Měřítka (SPEC)

- podíl firem, u kterých je doložená konkrétní osoba
- podíl kontaktů úrovně 1 (poptávkové adresy)
- podíl firem s ověřeným stavem stravování

Poslední měření (dávka 20 firem, 2026-07-27): kontakt u 17 z 20, jmenná
osoba u 10, poptávková adresa u 4, stav stravování u 0 z 20.

## Odkud kontakty brát — pořadí podle výtěžnosti

Body 1 a 2 zajišťuje kód automaticky při sběru. Body 3 a dál jsou tvoje práce.

1. **Otevřená data MPSV** — u inzerátu je pole „komu se hlásit" se jménem,
   pozicí, e-mailem i telefonem. Zaměstnavatel to zveřejnil sám. Nejlevnější
   zdroj vůbec. Omezení: jen firmy, které nabírají. **Účel adresy je nábor,
   ne nabídky dodavatelů** — zapisuje se to a je to při schvalování vidět.
2. **Statutární orgán z veřejného rejstříku** — jméno a funkce prakticky ke
   každé s.r.o. a a.s. Zachránil i firmy bez webu (REVIANT, I.U.STAVBY).
   **Bere se jen jméno a funkce, nikdy datum narození ani bydliště.**
   U firmy do ~50 lidí je jednatel často ten pravý; u velké rozhodně ne.
3. **Sekce pro nabídky na webu firmy** — „cenové nabídky", „obchodní
   zástupci", „pro dodavatele". Dá kontakt úrovně 1, tedy ten nejlepší.
   Hledej ji cíleně; obecné „Kontakty" vedou na centrálu.
4. **Podstránka konkrétní provozovny** u firem s víc pobočkami
   (`/zinkovna/bezdruzice/`). Tam bývají místní lidé, ne ústředí.
5. **Sekce Tým, Vedení, O nás, tiráž.**
6. **Dokumenty ke stažení** — ceníky, katalogy, obchodní podmínky, formuláře.
   Bývá pod nimi podepsaný konkrétní člověk s přímým kontaktem.
7. **Web mateřské firmy**, když česká doména mlčí (MONTEFERRO: kontakt byl
   na `monteferro.it/network-contacts/`).
8. **Archiv webu** u firem, jejichž stránky už neexistují.

**Registr smluv se neosvědčil** — metadata nesou jen název, IČO, adresu a
datovou schránku, žádnou kontaktní osobu. Jména by byla až uvnitř PDF smluv.
Ověřeno 2026-07-28, nestavíme.

**LinkedIn a sociální sítě nikdy**, ani ke čtení. Platí i přes to, že jinak
je při hledání dovoleno prakticky vše.

**Odhadované adresy se neukládají.** Odvodit `jmeno.prijmeni@firma.cz` ze
vzoru je vymýšlení, které se v kartotéce tváří jako fakt.

## Co funguje podle typu subjektu

| typ subjektu | co zabírá | co je slepé |
|---|---|---|
| Obce a města | stránka Kontakty s rozpisem podle agend; tajemník = nejbližší obdoba HR, podatelna = obecná adresa | stravování zaměstnanců úřadu se neuvádí nikdy |
| Výroba s víc provozy | podstránka provozovny; sekce obchodních zástupců | obecné Kontakty vedou jen na ústředí |
| Sociální a pobytová zařízení | konkrétní podstránka o stravě („Přihláška a odhláška stravy") | obecné „O nás" jen odkáže bez detailu |
| Školy | stránka školní jídelny (`/informace-sj`) doloží vlastní jídelnu | — |
| Nově vzniklé s.r.o. | statutární orgán z rejstříku | nulová webová stopa, často ani web |
| Spolky sdílející adresu s jinou organizací | — | vlastní kontakt nemívají; nedomýšlet sdílený |

## Technické fígle

- **Cloudflare-obfuskované e-maily** jdou přečíst přímým načtením syrového
  HTML — adresa bývá čitelná v `application/ld+json` markupu i tam, kde ji
  viditelný text maskuje.
- **Malé pracovní agregátory (nyransko.cz, volnamista.cz) rychle expirují**
  — do pár měsíců 404. Úryvek z vyhledávače nestačí, vždy ověřuj přímým
  načtením stránky, jinak zdroj do měsíce zmizí.
- **Katalogy třetích stran** (Firmy.cz, Živé firmy, RegionPlzeň) jsou
  poslední možnost — údaj tam může být roky starý. Označuj je jako slabší
  zdroj, ať je to při schvalování vidět.

## Vyjasněno

- **SIGNUM spol. s r.o. (IČO 18200061) je žárová zinkovna**, ne agentura
  práce. Dřívější podezření vzniklo záměnou s firmami MSRCZ MARINA GLOBAL
  a MARCIUS PLUS, které pro její bezdružický provoz najímaly pracovníky.
  Ty byly vyřazené správně, SIGNUM samo je kvalifikovaný cíl.

## Poznatky z běhů

(připojuje se automaticky — jen to, co je nové a obecné)
