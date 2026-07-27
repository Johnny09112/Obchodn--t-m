const Z = "https://data.mpsv.cz/od/soubory/volna-mista/volna-mista.json";
const r = await fetch(Z, { headers: { "User-Agent": "cantinero/0.1 (janlaub@icloud.com)" } });
const d = JSON.parse(await r.text()) as any;
const nase = d.polozky.filter((v: any) =>
  (v.mistoVykonuPrace?.pracoviste ?? []).some((p: any) =>
    String(p.adresa?.obec?.id ?? "").replace("Obec/", "") === "560740"));
console.log(`inzerátů s pracovištěm v Bezdružicích: ${nase.length}\n`);
for (const v of nase) {
  const p = v.mistoVykonuPrace.pracoviste[0];
  const a = p.adresa ?? {};
  console.log(`--- ${v.zamestnavatel?.nazev} (${v.zamestnavatel?.ico})`);
  console.log(`    profese: ${v.pozadovanaProfese ?? "?"}  míst: ${v.pocetMist}`);
  console.log(`    AGENTURA? agentura=${v.souhlasAgenturyAgentura} uzivatel=${v.souhlasAgenturyUzivatel}`);
  console.log(`    pracoviště: "${p.nazev}"  ulice=${a.nazevUlice ?? "—"} č.p.=${a.cisloDomovni ?? "—"}`);
}
