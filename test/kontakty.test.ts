import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { doplnKontakty } from "../src/kontakty.js";
import { nastavGeo, nastavStav, zalozFirmu, zapisKontakt } from "../src/repo.js";
import type { AresKlient, AresZaznam } from "../src/ares.js";
import type { MpsvKlient } from "../src/mpsv.js";

let db: Db;
let jidelnaId: string;

const firma = (ico: string, nazev: string): AresZaznam => ({
  ico, nazev, adresa: "Náves 1", obec: "Bezdružice", czNace: ["25610"],
  velikostKategorie: "stredni", kodObce: 560740, pravniForma: "112",
});

const ares: AresKlient = {
  overFirmu: async (i) => firma(i, "x"),
  najdiFirmyVObci: async () => [],
  najdiPodleJmena: async () => null,
  najdiStatutarniOrgany: async (ico) =>
    ico === "25232657" ? [{ jmeno: "TOMÁŠ", prijmeni: "HONZÍK", funkce: "Jednatel" }] : [],
};

const mpsv: MpsvKlient = {
  zamestnavateleVObci: async () => [],
  kontaktZamestnavatele: async (ico) =>
    ico === "25242407"
      ? { jmeno: "Radek", prijmeni: "Ondrušek", pozice: "personalista",
          email: "r.ondrusek@a.cz", telefon: "608 200 094" }
      : null,
};

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  const j = await db.query<{ id: string }>(
    `insert into jidelny (nazev, adresa, obec, lat, lng, kod_obce, kapacita_volna)
     values ('ZŠ','x','Bezdružice',49.9,12.97,560740,10) returning id`,
  );
  jidelnaId = j[0]!.id;

  for (const [ico, nazev] of [
    ["25242407", "AGROFARMY BEZDRUŽICE s.r.o."], // kontakt najde MPSV
    ["25232657", "KOVOVÝROBA HONZÍK, s.r.o."], // jen jednatel v rejstříku
    ["48362956", "ROLDECO, spol. s r.o."], // nic
  ] as const) {
    await zalozFirmu(db, firma(ico, nazev));
    await nastavGeo(db, ico, { lat: 49.9, lng: 12.97, jidelnaId, vzdalenostM: 100, vZone: true });
    await nastavStav(db, ico, "kvalifikovany");
  }
});

describe("doplnění kontaktů u firem, které už v kartotéce jsou", () => {
  it("použije nejdřív kontakt z úřadu práce — má i telefon a e-mail", async () => {
    const s = await doplnKontakty({ db, ares, mpsv }, {});
    expect(s.zMpsv).toBe(1);

    const k = await db.query<{ jmeno: string; email: string; telefon: string }>(
      "select jmeno, email, telefon from contacts where ico = '25242407'",
    );
    expect(k[0]).toMatchObject({
      jmeno: "Radek", email: "r.ondrusek@a.cz", telefon: "608 200 094",
    });
  });

  it("kde úřad práce nic nemá, sáhne do rejstříku pro jednatele", async () => {
    const s = await doplnKontakty({ db, ares, mpsv }, {});
    expect(s.zRejstriku).toBe(1);

    const k = await db.query<{ prijmeni: string; pozice: string }>(
      "select prijmeni, pozice from contacts where ico = '25232657'",
    );
    expect(k[0]).toMatchObject({ prijmeni: "HONZÍK", pozice: "Jednatel" });
  });

  it("firmu, kde není nic, jen spočítá a nic si nevymyslí", async () => {
    const s = await doplnKontakty({ db, ares, mpsv }, {});
    expect(s.bezVysledku).toBe(1);
    expect(await db.query("select 1 from contacts where ico = '48362956'")).toHaveLength(0);
  });

  it("firmu, která už jmenný kontakt má, znovu neřeší", async () => {
    await zapisKontakt(db, "25242407", {
      jmeno: "Jana", prijmeni: "Nováková", urovenAdresy: 3,
      zdrojUrl: "https://firma.cz/kontakty", citace: "Jana Nováková, provoz",
    });
    const s = await doplnKontakty({ db, ares, mpsv }, {});
    expect(s.zpracovano).toBe(2); // agrofarmy vynechány
  });

  it("běží i bez dat úřadu práce — spolehne se na rejstřík", async () => {
    const s = await doplnKontakty({ db, ares }, {});
    expect(s.zMpsv).toBe(0);
    expect(s.zRejstriku).toBe(1);
  });

  it("zapíše běh do agent_runs (TP-13)", async () => {
    const s = await doplnKontakty({ db, ares, mpsv }, {});
    const b = await db.query<{ konec: string | null }>(
      "select konec from agent_runs where id = $1",
      [s.behId],
    );
    expect(b[0]!.konec).not.toBeNull();
  });

  it("respektuje limit, ať jde běh rozdělit na dávky", async () => {
    const s = await doplnKontakty({ db, ares, mpsv }, { limit: 1 });
    expect(s.zpracovano).toBe(1);
  });

  it("každý zapsaný kontakt má zdroj i citaci (TP-2)", async () => {
    await doplnKontakty({ db, ares, mpsv }, {});
    const bezZdroje = await db.query(
      "select 1 from contacts where zdroj_url is null or zdroj_url = ''",
    );
    expect(bezZdroje).toHaveLength(0);
  });
});
