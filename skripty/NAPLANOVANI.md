# Hlídka Čmuchala — ikona u hodin

> Rozhodnutí majitele 2026-07-31: běží **u majitele na počítači**. Nejdřív
> to bylo přes Správce úloh, ale ten není vidět a nedá se z něj poznat, jestli
> něco běží — majitel si vyžádal aplikaci s ikonou, kterou jde kdykoli vypnout.

## Zapnutí

**Dvojklik na `skripty\Cmuchal.vbs`.** To je celé — u hodin naskočí kolečko.

Žádná instalace, žádné příkazy. Hlídka používá jen to, co ve Windows už je.

## Co ikona říká

Stav se pozná barvou i tvarem, ne jen barvou:

| Ikona | Znamená |
|---|---|
| **Plné zelené kolečko** | Hlídám frontu, nic se právě neděje |
| **Plné modré kolečko** | Právě prozkoumávám území |
| **Prázdné šedé kolečko** | Pozastaveno — nic se dít nebude |

Když na ikonu najedeš myší, řekne totéž slovy.

## Oznámení, až průzkum doběhne

Jakmile průzkum skončí, vyskočí u hodin **bublina** — třeba „Průzkum hotový ·
Plzeňsko — 1 871 nových firem, 12 už jsme znali." Když se něco nepovede,
bublina to řekne i s důvodem.

Vyžádáno majitelem 1. 8. místo e-mailu, který zatím **nesmí odejít** (TP-8).
Je to místní oznámení Windows; nic se nikam neodesílá.

- **Prázdná fronta bublinu nedostane.** Hlídka se ptá každých deset minut
  a „nebylo co dělat" by se během hodiny stalo otravným.
- **Po zapnutí počítače nevyskočí nic starého** — hlídka si při startu
  zapamatuje poslední známý běh a hlásí až ten další.
- Text je i v deníku, kdyby ti bublina utekla.

## Co umí (pravé tlačítko na ikoně)

- **Prozkoumat frontu teď** — nečeká se na řádný čas. Totéž udělá dvojklik na ikonu.
- **Pozastavit / Spustit hlídku** — vypne a zapne, aniž bys hlídku ukončil.
- **Otevřít deník** — co se kdy dělo.
- **Ukončit hlídku** — ikona zmizí, nic dalšího neběží.

## Kdy sama něco udělá

| Kdy | Co |
|---|---|
| **8:00, 13:00, 19:00** | Řádný běh — vyřídí až 3 objednávky |
| **Každých 10 minut** | Kouká, jestli nečeká objednávka označená jako **urgentní** |

Prázdná fronta stojí jeden dotaz do databáze, takže častá kontrola urgentů
nic nestojí. Velký průzkum se **mimo řádná okna sám nerozjede** — na to je
potřeba buď urgentní označení, nebo „Prozkoumat frontu teď".

Průzkum běží jako samostatný proces, takže hlídka po celou dobu reaguje
a jde kdykoli ukončit.

## Než to zapneš

1. **Počítač musí být zapnutý.** Když spí, objednávka počká. To je vědomá
   cena za to, že se nekupuje server.
2. **`.env` musí mít `DATABASE_URL`** — jinak by Čmuchal sbíral do lokální
   databáze místo do sdílené.
3. **Registr ČSÚ** (`data/cache/res_data.csv`, 521 MB) musí existovat.

## Ať naskočí sama po zapnutí počítače (nepovinné)

Zástupce do složky po spuštění — otevři **Spustit** (Win+R), napiš
`shell:startup`, a do složky, která se otevře, dej zástupce na
`skripty\Cmuchal.vbs`.

## Když se něco pokazí

**„Průzkum už běží jinde"** v deníku — není to chyba. Dva běhy naráz by si
braly rozdělané úseky navzájem, takže druhý slušně skončí.

**Hlídka zmizela z ikon** — nejspíš se ukončila s odhlášením. Znovu
dvojklikem na `Cmuchal.vbs`.

**Běh spadl a zámek zůstal** — po 15 minutách bez známky života si ho vezme
další běh sám. Ručně zasahovat netřeba.

**Objednávka se označila jako neúspěšná** — jedna vadná frontu nezastaví,
důvod je u ní zapsaný: `npm run cli -- pruzkum fronta`.

---

## Záložní cesta: Správce úloh

Hodí se, jen když by hlídka měla běžet **i bez přihlášeného člověka**.
Skript `cmuchal-fronta.cmd` na to zůstává; úlohy se zakládají takto
(PowerShell jako správce):

```powershell
$slozka = "C:\Projekty\Obchodní-tým\skripty"
schtasks /Create /TN "Cantinero - Cmuchal denni" /SC DAILY /ST 08:00 /TR "`"$slozka\cmuchal-fronta.cmd`"" /RL LIMITED /F
schtasks /Create /TN "Cantinero - Cmuchal urgenty" /SC MINUTE /MO 10 /TR "`"$slozka\cmuchal-fronta.cmd`" urgent" /RL LIMITED /F
```

Zrušení: `schtasks /Delete /TN "Cantinero - Cmuchal denni" /F` (a stejně pro urgenty).

**Nekombinuj obojí naráz** — nerozbije se to (zámek to ohlídá), ale v deníku
pak přibývají hlášky „už běží jinde" a hůř se v něm čte.
