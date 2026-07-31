# Naplánovaný běh Čmuchala — jak ho zapnout

> Rozhodnutí majitele 2026-07-31: běží **u majitele na počítači**, třikrát
> denně, plus drobná hlídka na urgentní objednávky.
>
> Naplánované úlohy zakládá **majitel**, ne Claude — je to zásah do
> nastavení systému.

## Co to dělá

Čmuchal si sám vezme objednávky průzkumu z fronty a vyřídí je. Bez toho by
krok 3 průvodce kampaní čekal na někoho s příkazovou řádkou.

Dvě úlohy, obě volají týž skript `skripty\cmuchal-fronta.cmd`:

| Úloha | Kdy | Co dělá |
|---|---|---|
| **Denní běh** | 8:00, 13:00, 19:00 | vyřídí až 3 běžné objednávky |
| **Hlídka urgentů** | každých 10 minut | vyřídí 1 objednávku označenou jako urgentní; jinak hned skončí |

Prázdná fronta stojí jeden dotaz do databáze — hlídka tedy nic nestojí.

## Než to zapneš

1. **Počítač musí být zapnutý.** Když spí, objednávka počká do dalšího
   zapnutí. To je vědomá cena za to, že se nekupuje server.
2. **Soubor `.env` musí mít `DATABASE_URL`** — bez něj by Čmuchal sbíral
   do lokální databáze místo do sdílené.
3. **Registr ČSÚ (`data/cache/res_data.csv`, 521 MB) musí existovat.**
   Bez něj průzkum oblasti nenajde firmy.

## Zapnutí

Otevři **PowerShell jako správce** a spusť:

```powershell
$slozka = "C:\Projekty\Obchodní-tým\skripty"

schtasks /Create /TN "Cantinero - Cmuchal denni" /SC DAILY /ST 08:00 `
  /TR "`"$slozka\cmuchal-fronta.cmd`"" /RL LIMITED /F

schtasks /Create /TN "Cantinero - Cmuchal poledne" /SC DAILY /ST 13:00 `
  /TR "`"$slozka\cmuchal-fronta.cmd`"" /RL LIMITED /F

schtasks /Create /TN "Cantinero - Cmuchal vecer" /SC DAILY /ST 19:00 `
  /TR "`"$slozka\cmuchal-fronta.cmd`"" /RL LIMITED /F

schtasks /Create /TN "Cantinero - Cmuchal urgenty" /SC MINUTE /MO 10 `
  /TR "`"$slozka\cmuchal-fronta.cmd`" urgent" /RL LIMITED /F
```

## Kontrola

Že to běží, poznáš z deníku:

```powershell
Get-Content "C:\Projekty\Obchodní-tým\data\cmuchal-fronta.log" -Tail 20
```

Ruční spuštění bez čekání na plán:

```bash
npm run cli -- pruzkum obsluz
```

## Vypnutí

```powershell
schtasks /Delete /TN "Cantinero - Cmuchal denni" /F
schtasks /Delete /TN "Cantinero - Cmuchal poledne" /F
schtasks /Delete /TN "Cantinero - Cmuchal vecer" /F
schtasks /Delete /TN "Cantinero - Cmuchal urgenty" /F
```

## Když se něco pokazí

**„Průzkum už běží jinde"** — normální hlášení, ne chyba. Dva běhy naráz by
si braly rozdělané úseky navzájem, takže druhý slušně skončí. Výpis říká,
kdo běh drží a kdy se naposled ozval.

**Běh spadl a zámek zůstal** — po 15 minutách bez známky života si ho vezme
další běh sám. Ručně zasahovat netřeba.

**Objednávka se označila jako neúspěšná** — jedna vadná objednávka frontu
nezastaví, důvod je u ní zapsaný. `npm run cli -- pruzkum fronta` je vypíše.
