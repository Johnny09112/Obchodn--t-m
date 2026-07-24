# Playbook — Čmuchal

Živý dokument agenta (SPEC 10.1). Čmuchal si ho smí upravovat sám, protože
neovlivňuje nic navenek. Zapisují se sem strategie vyhledávání a jejich
úspěšnost; CLI po každém běhu připojí poznámky z běhu.

## Měřítka (SPEC)

- podíl firem s ověřeným stavem stravování
- podíl kontaktů úrovně 1 (poptávkové adresy)
- počet ověřených kontaktů na firmu

## Strategie vyhledávání

1. Výčet firem: ARES `/ekonomicke-subjekty/vyhledat` dle `kodObce` jídelny.
   (Pozn.: kód obce je hrubé síto — Praha je jedna obec; jemnější filtr řeší
   geocoding + zóna.)
2. Stav stravování: nejlépe kariérní stránka a sekce benefitů na webu firmy;
   pracovní inzeráty jen jako zdroj údaje, nikdy do obsahu zpráv.
3. Účel adresy: kontaktní stránka firmy — hledat explicitní text u adresy
   („pro nabídky", „poptávky posílejte…").

## Poznatky z běhů

(zatím žádné — připojují se automaticky po každém běhu)
