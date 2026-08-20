# Druhá firma — vlastní instance, produkt bez místa, odesílání

> Zadání majitele 20. 8. 2026: druhá firma se rozjela dřív, než se čekalo,
> a má se spustit hned **včetně odesílání e-mailů**. Produkt té firmy
> **není vázaný na místo**. Agent poběží z předplatného (majitele nebo
> kolegy); **napojení na API je do budoucna nutná funkce**.

## Rozhodnutí: samostatná instance na zákazníka

Systém dnes **nezná pojem „zákazník"** — ověřeno, ani jedna migrace nemá
tenanta, organizaci ani vlastníka záznamu. Přestavba na víc firem v jedné
databázi znamená sáhnout na každou tabulku i na každé tvrdé pravidlo a jedna
chyba znamená, že zákazník uvidí cizí data.

**Druhá firma proto dostane vlastní instanci:** vlastní databázi, vlastní
nasazení aplikace, vlastní soubor s tajemstvími. Data se nemají kde potkat.
Kód je na to připravený — přepínač `CANTINERO_ENV` (src/env.ts) vznikl přesně
pro druhý projekt.

Sloučení do jedné databáze se vrátí na stůl, až bude zákazníků řádově deset
a údržba N instancí začne bolet víc než riziko sloučení. **Docker to neřeší** —
kontejner balí běh programu, ne oddělení zákazníků. Smysl dostane teprve
u varianty „agent běží sám na serveru", která dnes na stole není.

## Pořadí prací

### 0. Aplikace se nesmí tiše připojit k cizí databázi — ✅ HOTOVO 20. 8.

> Postaveno a otestováno; **nenasazeno**, čeká na doplnění proměnných
> `VITE_SUPABASE_URL` a `VITE_SUPABASE_PUBLISHABLE_KEY` u stávajícího projektu
> ve Vercelu. Podrobnosti a past: [[zalozni-adresa-databaze-je-past]].

Dnes v `app/src/supabase.ts`:

```ts
const URL = import.meta.env.VITE_SUPABASE_URL ?? "https://sedjnwllzyeuiruxgoil.supabase.co";
```

Když druhé nasazení zapomene nastavit proměnnou, aplikace se **tiše připojí
k databázi první firmy**. Nově: chybějící nastavení aplikaci zastaví a řekne to.

**Pozor na pořadí:** nejdřív se musí doplnit proměnné u stávajícího projektu
ve Vercelu, teprve pak se smí nasadit verze bez záložní hodnoty. Jinak spadne
dnešní provoz.

### 1. Nabídka bez spádového bodu — ✅ HOTOVO 20. 8.

> Migrace `0057_bez_spadoveho_bodu.sql`, `Profil.maSpadovyBod`, stav v
> `cmuchal-oblast.ts`. Rozhodnutí a podrobnosti: [[spadovy-bod-je-volitelny]].

> **Upřesnil majitel 20. 8.:** „prodej kamkoliv" **neznamená, že přestaneme
> ohraničovat území**. Území se kreslí dál jako dnes — jen v něm není spádová
> jídelna. U jiného zákazníka může být spádovým bodem třeba obchodní
> konzultant; **to se teď neřeší.**

Tím se úkol scvrkl. Nemění se sběr ani území, mění se jediné: **spádový bod
je od teď volitelný.**

- `profily` dostanou příznak „má spádový bod" (výchozí `true`, aby se
  Cantinero nezměnilo). Data, ne kód — stejně jako obory a velikost.
- `nahled_kampane` má dnes natvrdo `produkt_kod = 'cantinero'`, `cena_obeda`
  a `provize` (migrace 0050 a 0053). U jiného produktu vyjdou obě pole vždycky
  prázdná, takže **z kampaně vypadnou všechny firmy** — přesně jako dnes
  Čachrov, 0 z 91. Pole a jejich zdroje se musí brát z profilu, ne z konstanty.
- Bez spádového bodu se vzdálenost ani cena za oběd nevyžadují.
- **Firma sebraná nad územím se nesmí zaseknout ve stavu
  `cekajici_na_jidelnu`** (`src/cmuchal-oblast.ts:319`). Bez spádového bodu
  není na co čekat — firma v území, která projde kvalifikací, je prostě
  kvalifikovaná.
- Kapacitní strop se bez spádového bodu nepočítá.

**Co schválně NEstavím:** obecný spádový bod (jídelna → provozovna →
konzultant). Majitel to odložil a předstírat, že známe budoucí tvar, by byla
věštba. Dnešní práce to ale nesmí zavřít — proto příznak zní „má spádový bod",
ne „je to jídelna".

**Test, který to hlídá:** kampaň nad profilem bez spádového bodu pustí dál
firmy, které dnes vypadnou na chybějící vzdálenosti a ceně.

### 2. Odesílací cesta *(otevírá fázi 3)*

Dnes v repozitáři **není ani řádek, který by uměl odeslat** — TP-8 to fázím
0–2 zakazuje. Tímto krokem se otevírá fáze 3. Co musí vzniknout:

- napojení na Resend; odesílatel = přihlášený uživatel, **doména z nastavení
  instance**, ne z konstanty (podmínka produktizace, rozhodnuto 17. 8.),
- zápis každé odeslané zprávy do `messages`, denní limit ze `system_state`,
- **TP-5 vynucené v databázi**, ne v obrazovce: jedna firma = jedno oslovení,
- **povinná pasáž s poučením podle čl. 14 GDPR**; dokud text není v šabloně,
  systém odeslání odmítne,
- prvních 50 zpráv se schvaluje ručně,
- `sending_enabled` přepíná **jedině člověk** (TP-8) — na tom se nemění nic.

### 3. Druhá instance *(provoz)*

Vlastní databázový projekt, vlastní nasazení, vlastní `.env` mimo pracovní
složku (`CANTINERO_ENV`). Pak migrace, profil produktu, nabídka s parametry
a šablona zprávy — to všechno už jde nastavit **bez programování**, přesně
kvůli tomuhle to tak vzniklo.

Od zákazníka: doména a přístup k DNS, podepsaná osoba, jejich znění poučení.

### 4. API režim *(zapsat teď, stavět, až bude potřeba)*

Majitel označil za nutnou funkci. **Seam už existuje:** `src/enrich.ts` je
API cesta přes Anthropic SDK a `cmuchal.ts` ji bere přes rozhraní `Enricher`.
Není to slepá ulička — je to druhá implementace téhož rozhraní.

K tomu bude patřit účtování na zákazníka, limity a klíče mimo repozitář
(SPEC kap. 13 to má jako podmínku produktizace).

## Riziko, které padlo

Ráno 20. 8. jsem psal, že „prodává se kamkoli" mění i **sběr** — že území
přestane filtrovat a jeho práci bude muset převzít profil nad celým
rejstříkem. **Majitel to upřesnil a tím to padlo:** území se ohraničuje dál
jako dnes, chybí v něm jen spádová jídelna.

Zbývá jediné otevřené místo, a to vědomě odložené: až bude spádovým bodem
někdo jiný než jídelna (obchodní konzultant), bude se `jidelny` muset
zobecnit. Dnešní práce to nezavírá — příznak na profilu mluví o spádovém
bodu, ne o jídelně.

## Co potřebuji od majitele

1. Doména druhé firmy a přístup k DNS.
2. Kdo je u nich podepsaný pod zprávami a čte odpovědi (TP-10).
3. Znění poučení podle čl. 14 GDPR — od advokáta, ne ode mě.
4. Vědomé potvrzení, že **fáze 3 se otevírá dřív**, než se uzavřela fáze 0
   (chybí go/no-go a ruční kontrola vzorku 30 firem).
5. Peníze: druhý databázový projekt a druhé nasazení. Jestli se to vejde do
   bezplatných pásem, **neověřeno**.

## Co se tím nemění

Tvrdá pravidla. TP-1 (ARES), TP-2 (zdroj a citace), TP-3 (whitelist do
zprávy), TP-5 (jedno oslovení), TP-8 (vypínač v rukou člověka), TP-13 (běhy
v `agent_runs`) platí pro každou instanci stejně. Druhá firma nedostane
měkčí pravidla.
