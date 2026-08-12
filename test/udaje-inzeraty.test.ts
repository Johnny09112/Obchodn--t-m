import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import type { ZdrojInzeratu } from "../src/inzeraty.js";
import type { MpsvKlient } from "../src/mpsv.js";
import { zalozFirmu, zapisKontakt } from "../src/repo.js";
import { doplnUdajeZInzeratu } from "../src/udaje-inzeraty.js";

let db: Db;

const mpsv: MpsvKlient = {
  zamestnavateleVObci: async () => [],
  kontaktZamestnavatele: async () => null,
  udajeZamestnavatele: async (ico): Promise<ZdrojInzeratu | null> => {
    if (ico === "25232657") {
      return {
        smennost: { "Smennost/triSm": 2, "Smennost/jednoSm": 1 },
        stravovani: "závodní jídelna",
      };
    }
    // Firma v datech je, ale o režimu ani stravování nic neuvádí — jiná
    // situace než „v datech vůbec není", a obojí musí projít bez nálezu.
    if (ico === "25242407") return { smennost: {}, stravovani: null };
    return null;
  },
};

async function firma(ico: string): Promise<void> {
  await zalozFirmu(db, {
    ico, nazev: `Firma ${ico}`, pravniForma: "112", czNace: [],
  } as never);
  await db.query("update companies set stav = 'kvalifikovany' where ico = $1", [ico]);
}

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("doplnění údajů z inzerátů", () => {
  it("zapíše směnnost i stravování a spočítá firmy s nálezem", async () => {
    await firma("25232657");
    await firma("25242407");
    await firma("28750110");

    const s = await doplnUdajeZInzeratu({ db, mpsv }, { jenKvalifikovane: true });
    expect(s.zpracovano).toBe(3);
    // Jen jedna firma něco uvádí — ostatní dvě jsou správně bez nálezu.
    expect(s.sNalezem).toBe(1);
    expect(s.udaju).toBe(2);

    const e = await db.query<{ atribut: string; hodnota: string }>(
      "select atribut, hodnota from evidence where ico = '25232657' order by atribut",
    );
    expect(e.map((x) => x.atribut)).toEqual(["smenny_provoz", "zpusob_stravovani"]);
    expect(e[0]!.hodnota).toBe("třísměnný provoz");
  });

  // Tohle je celý důvod, proč tenhle běh vznikl: cesta „doplnit kontakty"
  // firmy s kontaktem přeskakuje, takže by se jim údaj nikdy nedoplnil.
  it("firmu s kontaktem NEpřeskočí", async () => {
    await firma("25232657");
    await zapisKontakt(db, "25232657", {
      jmeno: "Jan", prijmeni: "Novák", urovenAdresy: 3,
      zdrojUrl: "https://a.cz", citace: "jednatel Jan Novák",
    });

    const s = await doplnUdajeZInzeratu({ db, mpsv }, { jenKvalifikovane: true });
    expect(s.sNalezem).toBe(1);
  });

  it("opakovaný běh už firmu nebere — je to levné pouštět pravidelně", async () => {
    await firma("25232657");
    expect((await doplnUdajeZInzeratu({ db, mpsv }, {})).sNalezem).toBe(1);
    const druhy = await doplnUdajeZInzeratu({ db, mpsv }, {});
    expect(druhy.zpracovano).toBe(0);
    expect(druhy.udaju).toBe(0);
  });

  it("zamítnutou firmu nebere", async () => {
    await firma("25232657");
    await db.query("update companies set stav = 'zamitnuty' where ico = '25232657'");
    expect((await doplnUdajeZInzeratu({ db, mpsv }, {})).zpracovano).toBe(0);
  });

  it("běh se zapíše do agent_runs a uzavře", async () => {
    await firma("25232657");
    const s = await doplnUdajeZInzeratu({ db, mpsv }, {});
    const b = await db.query<{ konec: string | null }>(
      "select konec from agent_runs where id = $1", [s.behId],
    );
    expect(b[0]!.konec).not.toBeNull();
  });
});
