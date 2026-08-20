---
name: druha-firma-vlastni-instance
description: Druhý zákazník dostane vlastní instanci (databáze, nasazení, tajemství), ne přestavbu na víc firem v jedné databázi — a tím se otevírá fáze 3
type: decision
status: active
created: 2026-08-20
updated: 2026-08-20
related: [odesilaci-domena-a-adresa, sablona-ma-tri-vrstvy, produkt-neni-vazany-na-obor, use-casy]
---

**Rozhodl majitel 20. 8. 2026.** Druhá firma se rozjela dřív, než se čekalo,
a má se spustit **hned včetně odesílání e-mailů**. Odpověděl na tři otázky:

1. Její produkt **není vázaný na spádovou jídelnu**. Majitel to týž den
   upřesnil: **„prodej kamkoliv" neznamená, že přestaneme ohraničovat
   území** — území se kreslí dál jako dnes, jen v něm není spádová jídelna.
   U jiného zákazníka může být spádovým bodem třeba obchodní konzultant;
   **to se zatím neřeší.**
2. Agent poběží **z předplatného** (jeho nebo kolegy) — ale **napojení na API
   je do budoucna nutná funkce**, ne „možná".
3. „Spustit" znamená **včetně odesílání**, ne jen příprava dat.

## Vlastní instance na zákazníka

Systém **nezná pojem zákazník** — ověřeno 20. 8., ani jedna migrace nemá
tenanta, organizaci ani vlastníka záznamu. Multi-tenant by znamenal sáhnout na
každou tabulku i na každé tvrdé pravidlo; jedna chyba = zákazník vidí cizí
data. Proto: vlastní databáze, vlastní nasazení, vlastní `.env`
(`CANTINERO_ENV` už existuje přesně pro tohle).

Sloučení do jedné databáze se vrátí na stůl **až u řádově desátého zákazníka**.

**Docker to neřeší** — balí běh programu, ne oddělení zákazníků. Smysl dostane
teprve u varianty „agent běží sám na serveru", která na stole není.

## Co to odemklo v kódu (nálezy z 20. 8.)

- **Aplikace má zadrátovanou záložní adresu naší databáze**
  (`app/src/supabase.ts`). Druhé nasazení bez nastavené proměnné by se
  **tiše připojilo k datům první firmy**. Opravit dřív než cokoli jiného —
  a nasadit až po doplnění proměnných u stávajícího projektu, jinak spadne
  dnešní provoz.
- **`nahled_kampane` má natvrdo `produkt_kod='cantinero'`, `cena_obeda`
  a `provize`** (migrace 0050 a 0053). U jiného produktu vyjdou obě pole
  prázdná a **z kampaně vypadnou všechny firmy** — jako dnes Čachrov 0 z 91.
- **Vrstva „koho oslovit" je čistá** — `src/kvalifikace.ts` o jídelnách neví
  a má to i napsané. Zadrátovaná je jen vrstva „kde" (dosah, zóny, kapacita),
  a ta musí jít vypnout příznakem na profilu produktu.
- **API cesta není slepá ulička** — `src/enrich.ts` je implementace přes
  Anthropic SDK a `cmuchal.ts` ji bere přes rozhraní `Enricher`. Pro bod 3
  výše je to existující seam, ne práce od nuly.

## Důsledek pro fáze

**Otevírá se fáze 3, aniž se uzavřela fáze 0** — chybí go/no-go (S0.9)
a ruční kontrola vzorku 30 firem. Majitel to má vědomě potvrdit; do té doby
je to riziko, ne rozhodnutí.

Plán: `docs/superpowers/plans/2026-08-20-druha-firma.md`.
Vizuál pro majitele: `docs/vizualizace/druha-firma-plan-2026-08-20.html`.

**Riziko „mění se i sběr" padlo** upřesněním majitele (viz bod 1 nahoře) —
území zůstává, sběr se nemění. Zbývá jediné vědomě odložené místo: zobecnění
spádového bodu (jídelna → konzultant). Dnešní práce to nesmí zavřít, proto se
příznak na profilu jmenuje **„má spádový bod"**, ne „je to jídelna".

**Kde se stav nastavuje:** firma sebraná nad územím dostává
`cekajici_na_jidelnu` v `src/cmuchal-oblast.ts` (a `src/cmuchal.ts`). Bez
spádového bodu není na co čekat — firma, která projde kvalifikací, je prostě
kvalifikovaná.
