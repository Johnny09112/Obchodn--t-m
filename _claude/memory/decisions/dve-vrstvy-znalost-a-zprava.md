---
name: dve-vrstvy-znalost-a-zprava
description: Whitelist váže obsah zprávy, ne sběr — SPEC kap. 5 rozdělena na znalost o firmě a obsah oslovení
type: decision
status: active
created: 2026-08-06
updated: 2026-08-06
related: [male-firmy-a-nezname-jde-pribrat, odesilani-zakazano-jen-docasne]
---

**Rozhodnutí majitele 2026-08-06.** Podrobně:
`docs/adr/0002-dve-vrstvy-a-nastavitelnost.md`.

## Co se změnilo

SPEC kap. 5 se rozdělila na dvě vrstvy s vlastními pravidly:

- **Vrstva A — znalost o firmě.** Rozsah určuje profil produktu, ne pevný
  seznam. Pořád jen s doloženým zdrojem a citací (TP-2).
- **Vrstva B — obsah oslovení.** Whitelist a test pohlednice platí beze
  změny. Smí čerpat jen z whitelistu, ne z celé vrstvy A.

**TP-3 nově výslovně váže zprávu, ne sběr.**

## Nález, který to zmenšil

**TP-3 ve SPEC sběr nikdy neomezoval** — mluvil o rendereru a o zprávě.
Zákaz sbírat cokoli mimo whitelist vznikl až v kódu (`src/repo.ts` zápis
odmítne, `src/whitelist.ts` drží seznam) a v projektovém `CLAUDE.md`.
SPEC se tedy upřesnil, nepřevrátil.

**Kód se zatím nezměnil.** Vrstva A je zatím jen na papíře; zapsat se pořád
dá jen whitelist. Nic se tím nerozbilo.

## Praktický důsledek, o který šlo

**Pracovní inzeráty se smějí číst, ale nesmějí do zprávy.** Jsou to veřejná
data, kde zaměstnavatel sám popsal směnný provoz a benefity — pro obchod
nejcennější zdroj, který dosud nešel použít. Ve zprávě zůstávají zakázané:
„před třemi týdny jste inzerovali účetní" je přesně to, co adresáta znepokojí.

**Sociální sítě zůstávají zakázané v obou vrstvách.**

## Proč vůbec

Majitel staví systém i pro tři další vlastní projekty s jinou cílovkou
a případně pro jiné firmy. Každé nasazení běží u zákazníka — jeho server,
jeho data, jeho klíč k LLM. **Vícenájemnost se proto nestaví vůbec.**

Cesta přes API klíč (`src/enrich.ts`) se připraví jako produktová, ale ostrý
provoz zatím jede z předplatného. Odhad nákladů při cílovém provozu 5–10
oslovení denně: ~12 USD měsíčně na Sonnetu. Cena bolí jen u hromadného
dohánění, ne u běžného provozu.
