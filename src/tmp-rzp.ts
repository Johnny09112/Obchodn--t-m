async function zkus(popis: string, url: string, init: RequestInit = {}) {
  try {
    const r = await fetch(url, { ...init, headers: { accept: "application/json, */*", "User-Agent": "cantinero/0.1 (janlaub@icloud.com)", ...(init.headers ?? {}) } });
    const t = await r.text();
    console.log(`\n### ${popis}\n    ${r.status} ${r.headers.get("content-type")?.slice(0,35)}\n    ${t.slice(0,220).replace(/\s+/g," ")}`);
  } catch (e) { console.log(`\n### ${popis} → CHYBA ${e instanceof Error ? e.message : e}`); }
}
// Živnostenský rejstřík — hledáme veřejné rozhraní pro provozovny
await zkus("rzp.gov.cz kořen", "https://rzp.gov.cz/");
await zkus("rzp.gov.cz api", "https://rzp.gov.cz/verejne-udaje/api/v1/subjekty?ico=18200061");
await zkus("rzp cache web", "https://www.rzp.cz/cgi-bin/aps_cacheWEB.sh?VSS_SERV=ZVWSBJFND&ICO=18200061");
