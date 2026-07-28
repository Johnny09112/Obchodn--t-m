import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { naBlacklistu, nactiBlacklist, pridejPravidlo } from "../src/blacklist.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

const firma = {
  ico: "25232657",
  nazev: "KOVOVÝROBA HONZÍK, s.r.o.",
  czNace: ["25610"],
  pravniForma: "112",
};

describe("blacklist podle IČO", () => {
  it("vyřadí konkrétní firmu i s důvodem", async () => {
    await pridejPravidlo(db, {
      typ: "ico", hodnota: "25232657", duvod: "už jsme s nimi jednali, nemají zájem",
    });
    const pravidla = await nactiBlacklist(db);

    const v = naBlacklistu(pravidla, firma);
    expect(v?.duvod).toBe("už jsme s nimi jednali, nemají zájem");
  });

  it("jinou firmu nechá být", async () => {
    await pridejPravidlo(db, { typ: "ico", hodnota: "48362956", duvod: "x" });
    expect(naBlacklistu(await nactiBlacklist(db), firma)).toBeNull();
  });
});

describe("blacklist podle názvu", () => {
  it("hledá kus názvu, ne přesnou shodu — a nezáleží na velikosti písmen", async () => {
    await pridejPravidlo(db, {
      typ: "nazev", hodnota: "kovovýroba", duvod: "kovovýrobu neobsluhujeme",
    });
    expect(naBlacklistu(await nactiBlacklist(db), firma)).not.toBeNull();
  });

  it("nezáleží ani na diakritice — jinak by pravidlo tiše nefungovalo", async () => {
    // Kdo píše pravidlo, obvykle nepřepisuje háčky přesně podle rejstříku.
    await pridejPravidlo(db, { typ: "nazev", hodnota: "kovovyroba", duvod: "x" });
    expect(naBlacklistu(await nactiBlacklist(db), firma)).not.toBeNull();
  });
});

describe("blacklist podle oboru a právní formy", () => {
  it("vyřadí celý obor podle oddílu CZ-NACE", async () => {
    await pridejPravidlo(db, { typ: "nace", hodnota: "25", duvod: "obor nechceme" });
    expect(naBlacklistu(await nactiBlacklist(db), firma)).not.toBeNull();
  });

  it("vyřadí celou právní formu", async () => {
    await pridejPravidlo(db, { typ: "pravni_forma", hodnota: "112", duvod: "test" });
    expect(naBlacklistu(await nactiBlacklist(db), firma)).not.toBeNull();
  });
});

describe("pravidla dohromady", () => {
  it("prázdný blacklist nikoho nevyřadí", async () => {
    expect(naBlacklistu(await nactiBlacklist(db), firma)).toBeNull();
  });

  it("stejné pravidlo dvakrát nejde přidat", async () => {
    await pridejPravidlo(db, { typ: "ico", hodnota: "25232657", duvod: "první" });
    await expect(
      pridejPravidlo(db, { typ: "ico", hodnota: "25232657", duvod: "druhý" }),
    ).rejects.toThrow();
  });

  it("pravidlo bez důvodu databáze nepřijme", async () => {
    // Bez důvodu se za měsíc nedá poznat, proč tam ta firma je.
    await expect(
      db.query("insert into blacklist (typ, hodnota) values ('ico','25232657')"),
    ).rejects.toThrow();
  });
});
