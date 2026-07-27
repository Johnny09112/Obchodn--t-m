import { vytvorAresKlienta } from "./ares.js";
import { vytvorResKlienta, KATEGORIE_PRACOVNIKU } from "./res.js";
const ares = vytvorAresKlienta({ prodlevaMs: 250 });
const res = vytvorResKlienta({ prodlevaMs: 250 });

const vsechny = await ares.najdiFirmyVObci(560740, { max: 250 });
console.log(`v obci zapsáno: ${vsechny.length}\n`);

const zamestnavatele: Array<{ ico: string; nazev: string; kod: string; nace: string[] }> = [];
let hotovo = 0;
for (const f of vsechny) {
  const u = await res.nactiUdaje(f.ico);
  hotovo++;
  if (hotovo % 50 === 0) process.stderr.write(`  …${hotovo}/${vsechny.length}\n`);
  const kod = u?.kategorieKod ?? "000";
  if (kod !== "000" && kod !== "110") {
    zamestnavatele.push({ ico: f.ico, nazev: f.nazev, kod, nace: f.czNace });
  }
}
zamestnavatele.sort((a, b) => b.kod.localeCompare(a.kod));
console.log(`SKUTEČNÝCH ZAMĚSTNAVATELŮ: ${zamestnavatele.length}\n`);
for (const z of zamestnavatele) {
  console.log(`  ${(KATEGORIE_PRACOVNIKU[z.kod]?.popis ?? z.kod).padEnd(12)} ${z.ico}  ${z.nazev.slice(0,46).padEnd(48)} ${z.nace.slice(0,2).join(",")}`);
}
