---
name: overuj-obrazovky-v-prohlizeci
description: Frontend neodhaduj — majitel tě přihlásí a proklikáš si to sám
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 712d0c83-771e-4ec8-9ed4-091383e9c23d
  modified: 2026-08-17T10:09:01.391Z
---

Když je potřeba ověřit obrazovku, **řekni si o to**. Majitel spustí náhled
a přihlásí se; od té chvíle si klikáš sám. Heslo nezadávej ani nechtěj —
přihlašuje majitel.

**Nástroj (od 17. 8. 2026):** Playwright MCP, nainstalovaný v user scope —
`mcp__playwright__*`. Dřív to byl panel Browser v desktopové aplikaci, ten
ale v session běžící na pozadí ve VS Code není. Když nástroj v session
chybí, ověř `claude mcp get playwright`; podrobnosti a pasti instalace jsou
v osobním vaultu (`memory/tools/playwright-mcp-prohlizec.md`).

**Why:** dokud jsem obrazovky neproklikal, posílal jsem věty typu „mělo by to
fungovat". Při prvním skutečném proklikání (3. 8.) se během deseti minut
našly tři vady, které testy ani typy nechytily: neviditelná barva vrstvy
(styl platil jen v jiné komponentě), dvě protiřečící si čísla v průvodci
a bílá obrazovka po pádu Leafletu, který se v konzoli hlásil jen jako
varování.

**How to apply:** u každé změny frontendu si vyžádej přihlášení a projdi
tok, kterého se změna týká. Když to zrovna nejde, **řekni nahlas, že jsi
neověřoval** — netvrď, že to funguje. Screenshot je důkaz, typecheck není.
