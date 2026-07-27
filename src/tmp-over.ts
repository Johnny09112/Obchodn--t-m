const ARES = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";
async function najdi(jmeno: string) {
  const r = await fetch(`${ARES}/ekonomicke-subjekty/vyhledat`, {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ obchodniJmeno: jmeno, pocet: 5, start: 0 }),
  });
  if (!r.ok) return console.log(`${jmeno.padEnd(24)} → HTTP ${r.status}`);
  const d = (await r.json()) as any;
  for (const s of (d.ekonomickeSubjekty ?? []).slice(0, 3)) {
    const res = await fetch(`${ARES}/ekonomicke-subjekty-res/${s.ico}`, { headers: { accept: "application/json" } });
    const kod = res.ok ? (await res.json() as any).zaznamy?.[0]?.statistickeUdaje?.kategoriePoctuPracovniku : "?";
    console.log(`${jmeno.padEnd(22)} ${s.ico} ${String(s.obchodniJmeno).slice(0,34).padEnd(36)} obec=${String(s.sidlo?.nazevObce).padEnd(14)} kodObce=${s.sidlo?.kodObce} zam=${kod}`);
    await new Promise(x => setTimeout(x, 300));
  }
}
for (const j of ["ZP servis", "LAK servis", "BELAS", "ROLDECO", "Kovovýroba Honzík", "Honzík"]) {
  await najdi(j);
  await new Promise(x => setTimeout(x, 350));
}
