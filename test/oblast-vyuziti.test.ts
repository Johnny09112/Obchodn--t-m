import { describe, expect, it } from "vitest";
import { drziOblast, type VyuzitiOblasti } from "../src/oblast-vyuziti.js";

const NIC: VyuzitiOblasti = { kampane: [], pruzkumu: 0, firem: 0 };

describe("co oblast drží naživu", () => {
  it("nepoužitou oblast nedrží nic", () => {
    expect(drziOblast(NIC)).toBeNull();
  });

  it("firmy uvnitř oblast nedrží — spočítají se znovu", () => {
    expect(drziOblast({ ...NIC, firem: 4300 })).toBeNull();
  });

  it("jedna kampaň", () => {
    expect(drziOblast({ ...NIC, kampane: ["Plzeň – jaro"] })).toBe(
      "Používá ji kampaň „Plzeň – jaro“.",
    );
  });

  it("víc kampaní se vyjmenuje", () => {
    expect(drziOblast({ ...NIC, kampane: ["Jaro", "Podzim", "Zima"] })).toBe(
      "Používají ji kampaně „Jaro“, „Podzim“ a „Zima“.",
    );
  });

  it("průzkum — a čeština umí tři tvary", () => {
    expect(drziOblast({ ...NIC, pruzkumu: 1 })).toBe("Objednal se nad ní průzkum.");
    expect(drziOblast({ ...NIC, pruzkumu: 3 })).toBe("Objednaly se nad ní 3 průzkumy.");
    expect(drziOblast({ ...NIC, pruzkumu: 7 })).toBe("Objednalo se nad ní 7 průzkumů.");
  });

  it("obojí naráz — dvě věty za sebou", () => {
    expect(drziOblast({ kampane: ["Plzeň"], pruzkumu: 2, firem: 10 })).toBe(
      "Používá ji kampaň „Plzeň“. Objednaly se nad ní 2 průzkumy.",
    );
  });
});
