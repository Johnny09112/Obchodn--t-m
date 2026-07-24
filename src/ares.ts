/** Ověřený záznam firmy z ARES — jediný vstup pro založení company (TP-1). */
export interface AresZaznam {
  ico: string;
  nazev: string;
  adresa: string | null;
  obec: string | null;
  okres?: string | null;
  kraj?: string | null;
  psc?: string | null;
  czNace: string[];
  velikostKategorie: "mikro" | "mala" | "stredni" | "velka" | null;
  kodObce?: number | null;
}
