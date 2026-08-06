// Pomocný skript pro test/cmuchal-spousteni.test.ts.
//
// Vypíše, co doopravdy dorazilo jako argv a na stdin — nahrazuje reálné
// `claude.exe` v testu, ať jde ověřit přenos přes skutečný proces (spawn
// bez shellu), ne jen sestavení pole v paměti. Přesně tohle se dřív se
// `shell: true` rozbíjelo (nález 1 závěrečné revize): argumenty se slepily
// a nové řádky v zadání useknuly zbytek.
import { readFileSync } from "node:fs";

let stdin = "";
try {
  stdin = readFileSync(0, "utf8");
} catch {
  // Bez potrubí na stdin (interaktivní spuštění) zůstane prázdné — testu to nevadí.
}

console.log(JSON.stringify({ argv: process.argv.slice(2), stdin }));
