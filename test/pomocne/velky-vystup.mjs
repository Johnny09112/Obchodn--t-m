// Pomocný skript pro test/cmuchal-spousteni.test.ts — nález 3 závěrečné
// revize (odebírání stdout). Zapíše na stdout víc, než se vejde do bufferu
// roury operačního systému, aby test poznal, kdyby se proces bez odebírání
// stdout zablokoval při zápisu.
const radek = "x".repeat(1000) + "\n";
for (let i = 0; i < 300; i++) {
  process.stdout.write(radek);
}
