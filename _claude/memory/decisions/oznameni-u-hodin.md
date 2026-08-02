---
name: oznameni-u-hodin
description: Dokončený průzkum hlásí bublina Windows; text skládá jádro, hlídka ho jen zobrazí
type: decision
status: active
created: 2026-08-02
updated: 2026-08-02
related: [hlidka-cmuchala-u-majitele, odesilani-zakazano-jen-docasne, powershell-ps1-potrebuje-bom]
---

**Kontext:** Majitel chtěl e-mail, až průzkum doběhne. E-mail zatím **nesmí**
(TP-8) a majitel to sám upřesnil: „nyní to nesmí realizovat především kvůli
případné chybě a nechtěnému odeslání." Nabídnuto oznámení Windows,
**schváleno 2. 8.**

**Rozhodnutí:** po doběhnutí průzkumu vyskočí bublina u ikony hlídky.
Je to místní oznámení na majitelově počítači — **nic se neodesílá**, TP-8 platí
dál a žádný kód odesílání neumí ([[odesilani-zakazano-jen-docasne]]).

## Kde co je

- **Text skládá jádro** — `src/oznameni.ts`, čistý modul s testy.
- **Hlídka ho jen zobrazí** — `skripty/cmuchal-hlidka.ps1` přečte
  `data/posledni-beh.json` a zavolá `ShowBalloonTip`.
- Předávka přes soubor, protože hlídka pouští průzkum jako samostatný proces
  a nečeká na něj (velké území běží desítky minut).

**Proč se text neskládá v PowerShellu:** čeština má pády a tři tvary čísel.
Ve skriptu by na to nebyly testy a nikdo by se do něj nedíval.

## Co se schválně nehlásí

- **Prázdná fronta.** Hlídka se ptá každých deset minut; bublina „nebylo co
  dělat" by do hodiny skončila vypnutá i s těmi užitečnými.
- **Nedoběhnutá objednávka** (došel strop úseků) se hlásí jako `bezi`, ne
  `hotovo` — bublina nesmí tvrdit víc, než se stalo.
- **Staré oznámení po startu.** Hlídka si při spuštění zapamatuje čas
  posledního běhu na disku a hlásí až ten další.

## Past, na kterou se narazilo znovu

Pomocný skript na zkoušku bubliny se psal **bez UTF-8 BOM** a PowerShell 5.1
ho přečetl jako ANSI — pomlčka `—` se rozpadla a skript neprošel parserem
([[powershell-ps1-potrebuje-bom]]). Ostrý skript BOM má a ověřuje se to
`PSParser::Tokenize`. Platí to i pro jednorázové skripty ve scratchpadu.
