/**
 * Obchodní signály — proč zrovna teď zrovna tuhle firmu.
 *
 * Signál je **událost s platností**, ne vlastnost firmy. Atribut („má 30
 * zaměstnanců") platí pořád; signál („minulý týden vypsala 4 místa na
 * směny") vyprchá. Proto vlastní tabulka a proto `plati_do`.
 *
 * **Druhy signálů jsou v rejstříku, ne v kódu** (`druhy_signalu`, migrace
 * 0040) — stejně jako atributy. Zavést nový druh je migrace, ne
 * programování.
 *
 * **TP-2 platí i tady.** Bez zdroje a doslovné citace se podnět nezapíše.
 * Obchodník si musí umět kliknout a přesvědčit se sám — to je jediné, co
 * tenhle systém odliší od nástrojů, které tvrdí věci bez doložení.
 *
 * **TP-8 platí taky.** Signál je podnět k oslovení, ne oslovení. Nic se
 * odsud neodesílá.
 */
import type { Db } from "./db.js";

export interface DruhSignalu {
  kod: string;
  nazev: string;
  popis: string;
  silaVychozi: number;
  platnostDnu: number | null;
  vylucovaci: boolean;
}

export interface NovySignal {
  ico: string;
  druh: string;
  /** Stabilní identita výskytu — druhý běh nad týmiž daty nesmí založit druhý řádek. */
  klic: string;
  popis: string;
  zdrojUrl: string;
  citace: string;
  /** Když se neuvede, vezme se výchozí síla druhu. */
  sila?: number;
}

export async function nactiDruhySignalu(db: Db): Promise<DruhSignalu[]> {
  return db.query<DruhSignalu>(
    `select kod, nazev, popis, sila_vychozi as "silaVychozi",
            platnost_dnu as "platnostDnu", vylucovaci
     from druhy_signalu where aktivni order by kod`,
  );
}

/**
 * Zapíše podnět. Když už tentýž výskyt evidujeme, **nic se nemění** —
 * `zjisteno_at` zůstává původní, aby opakovaný běh neomlazoval staré
 * podněty a neposouval jim platnost donekonečna.
 *
 * Vrací `true`, když podnět doopravdy přibyl.
 */
export async function zapisSignal(db: Db, s: NovySignal): Promise<boolean> {
  const druhy = await db.query<{ sila_vychozi: string; platnost_dnu: number | null }>(
    "select sila_vychozi, platnost_dnu from druhy_signalu where kod = $1 and aktivni",
    [s.druh],
  );
  const druh = druhy[0];
  if (!druh) {
    throw new Error(
      `Neznámý nebo vypnutý druh signálu '${s.druh}'. Zaveď ho migrací do 'druhy_signalu' — ` +
        `signály se nezavádějí za běhu, aby nešly vyrobit omylem.`,
    );
  }
  if (!s.zdrojUrl?.trim() || !s.citace?.trim()) {
    throw new Error(`TP-2: signál '${s.druh}' u ${s.ico} nemá zdroj nebo citaci.`);
  }

  const r = await db.query<{ id: string }>(
    `insert into signaly (ico, druh, klic, sila, popis, zdroj_url, citace, plati_do)
     values ($1,$2,$3,$4,$5,$6,$7,
       case when $8::int is null then null else now() + ($8::int || ' days')::interval end)
     on conflict (ico, druh, klic) do nothing
     returning id`,
    [
      s.ico, s.druh, s.klic,
      s.sila ?? Number(druh.sila_vychozi),
      s.popis, s.zdrojUrl, s.citace.slice(0, 200),
      druh.platnost_dnu,
    ],
  );
  return r.length > 0;
}

export interface PlatnySignal {
  ico: string;
  nazev: string | null;
  druh: string;
  nazevDruhu: string;
  sila: number;
  popis: string;
  zjistenoAt: Date;
  zdrojUrl: string;
  citace: string;
  vylucovaci: boolean;
}

/**
 * Co je nového a ještě to platí — přesně to, co má obchodník ráno vidět.
 *
 * Vylučovací signály se **nevyhazují**: „tuhle neoslovovat" je pro práci
 * stejně cenné jako „tuhle oslovit". Kdo je nechce, ať si je odfiltruje.
 */
export async function platneSignaly(
  db: Db,
  opts: { limit?: number; vylucovaci?: boolean; iVyrizene?: boolean } = {},
): Promise<PlatnySignal[]> {
  const podminky = ["(s.plati_do is null or s.plati_do > now())"];
  // Odškrtnutý podnět je vyřízená práce, ne neplatná informace — proto se
  // nemaže, jen se přestane nabízet.
  if (!opts.iVyrizene) podminky.push("s.vyrizeno_at is null");
  const params: unknown[] = [];
  if (opts.vylucovaci !== undefined) {
    params.push(opts.vylucovaci);
    podminky.push(`d.vylucovaci = $${params.length}`);
  }
  return db.query<PlatnySignal>(
    `select s.ico, c.nazev, s.druh, d.nazev as "nazevDruhu", s.sila, s.popis,
            s.zjisteno_at as "zjistenoAt", s.zdroj_url as "zdrojUrl", s.citace,
            d.vylucovaci
     from signaly s
     join druhy_signalu d on d.kod = s.druh
     left join companies c on c.ico = s.ico
     where ${podminky.join(" and ")}
     order by s.sila desc, s.zjisteno_at desc
     ${opts.limit ? `limit ${Number(opts.limit)}` : ""}`,
    params,
  );
}

/**
 * Odškrtne podnět jako vyřízený, nebo odškrtnutí vrátí (`kdo = null`).
 *
 * Vrací `true`, když se stav doopravdy změnil — opakované odškrtnutí
 * téhož podnětu nic nepřepisuje, aby se neposouval čas u něčeho, co je
 * vyřízené týden.
 */
export async function oznacVyrizeno(
  db: Db,
  id: string,
  kdo: string | null,
): Promise<boolean> {
  const r = await db.query<{ id: string }>(
    `update signaly
     set vyrizeno_at = case when $2::text is null then null else now() end,
         vyrizeno_kym = $2
     where id = $1
       and (($2::text is null and vyrizeno_at is not null)
         or ($2::text is not null and vyrizeno_at is null))
     returning id`,
    [id, kdo],
  );
  return r.length > 0;
}

// ── Úroveň 1: pravidla nad daty, která už máme ────────────────────────
//
// Žádné nové stahování. Detektor je dotaz nad evidencí — když se změní
// zdroj, opraví se jedno místo a všechny detektory nad ním se spraví naráz.

/** Kolikrát detektor našel a kolik z toho bylo nových. */
export interface VysledekDetektoru {
  nalezeno: number;
  noveZapsano: number;
}

/**
 * Firma jede na víc směn nebo nepřetržitě.
 *
 * Pro docházkové systémy je to hlavní důvod, proč je firma potřebuje —
 * směny se ručně evidovat nedají. Čte se z evidence, kam to zapsal sběr
 * z otevřených dat úřadu práce (`src/inzeraty.ts`).
 */
export async function detekujSmennyProvoz(db: Db): Promise<VysledekDetektoru> {
  const nalezy = await db.query<{
    ico: string; hodnota: string; zdroj_url: string; citace: string;
  }>(
    `select distinct on (e.ico) e.ico, e.hodnota, e.zdroj_url, e.citace
     from evidence e
     where e.atribut = 'smenny_provoz'
       and e.hodnota in ('dvousměnný provoz','třísměnný provoz','čtyřsměnný provoz',
                         'nepřetržitý provoz','turnusový provoz')
     order by e.ico, e.ziskano_at desc`,
  );

  let nove = 0;
  for (const n of nalezy) {
    // Klíč nese hodnotu: když firma přejde z dvousměnného na nepřetržitý,
    // je to nový podnět, ne tentýž. Bez toho by se změna režimu ztratila.
    const pribylo = await zapisSignal(db, {
      ico: n.ico,
      druh: "smenny_provoz_vice",
      klic: n.hodnota,
      popis: `Jede na ${n.hodnota}. Evidence směn ručně nejde — a lidé jedí i mimo obvyklou dobu oběda.`,
      zdrojUrl: n.zdroj_url,
      citace: n.citace,
    });
    if (pribylo) nove++;
  }
  return { nalezeno: nalezy.length, noveZapsano: nove };
}

/**
 * Firma si vaří sama — pro nabídku obědů ji NEOSLOVOVAT.
 *
 * Vylučovací signál. Ušetřený hovor se počítá stejně jako nalezený a pro
 * jiné use-casy (docházka) je to úplně bezvýznamné — proto signál, ne síto.
 */
export async function detekujVlastniJidelnu(db: Db): Promise<VysledekDetektoru> {
  const nalezy = await db.query<{
    ico: string; hodnota: string; zdroj_url: string; citace: string;
  }>(
    `select distinct on (e.ico) e.ico, e.hodnota, e.zdroj_url, e.citace
     from evidence e
     where e.atribut = 'ma_vlastni_jidelnu'
       -- Hodnoty jsou historicky nejednotné („true" i „ano — …"), proto se
       -- ptáme na to, co znamenají, ne na přesný tvar. Sjednotit je je
       -- samostatný úkol; do té doby by přísná shoda tiše přehlížela půlku.
       and (e.hodnota ilike 'true' or e.hodnota ilike 'ano%')
     order by e.ico, e.ziskano_at desc`,
  );

  let nove = 0;
  for (const n of nalezy) {
    const pribylo = await zapisSignal(db, {
      ico: n.ico,
      druh: "vlastni_jidelna",
      klic: "doloženo",
      popis: "Vaří si sama — s nabídkou obědů neoslovovat. Pro jiné nabídky to nevadí.",
      zdrojUrl: n.zdroj_url,
      citace: n.citace,
    });
    if (pribylo) nove++;
  }
  return { nalezeno: nalezy.length, noveZapsano: nove };
}
