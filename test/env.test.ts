import { describe, expect, it } from "vitest";
import { homedir } from "node:os";
import { rozeberEnv, vychoziCestaEnv } from "../src/env.js";

describe("čtení .env", () => {
  it("přečte hodnoty a ignoruje komentáře i prázdné řádky", () => {
    expect(
      rozeberEnv(["# komentář", "", "NOMINATIM_CONTACT=laub@post.cz", "DATABASE_URL="].join("\n")),
    ).toEqual({ NOMINATIM_CONTACT: "laub@post.cz", DATABASE_URL: "" });
  });

  it("odstraní uvozovky a mezery kolem hodnoty", () => {
    expect(rozeberEnv(`A = "x" \nB='y'`)).toEqual({ A: "x", B: "y" });
  });

  it("hodnotu s rovnítkem nerozseká", () => {
    expect(rozeberEnv("DATABASE_URL=postgres://u:p@h/db?a=1")).toEqual({
      DATABASE_URL: "postgres://u:p@h/db?a=1",
    });
  });

  it("řádek bez rovnítka přeskočí", () => {
    expect(rozeberEnv("tohle není nastavení\nA=1")).toEqual({ A: "1" });
  });
});

describe("kde se hledá soubor s nastavením", () => {
  // Tajemství nesmí ležet v pracovní složce projektu. Agent, který tam běží
  // bez dozoru, na něj totiž dosáhne: ověřeno 6. 8. 2026 živým pokusem —
  // omezení `--allowedTools` čtení souborů NEOMEZUJE a zákaz čtení `.env` prostým jménem
  // ani hvězdičkovým vzorem nezabral.
  it("výchozí cesta míří mimo repozitář", () => {
    expect(vychoziCestaEnv().startsWith(homedir())).toBe(true);
  });

  it("CANTINERO_ENV má přednost", () => {
    const puvodni = process.env.CANTINERO_ENV;
    process.env.CANTINERO_ENV = "/jinam/.env";
    try {
      expect(vychoziCestaEnv()).toBe("/jinam/.env");
    } finally {
      if (puvodni === undefined) delete process.env.CANTINERO_ENV;
      else process.env.CANTINERO_ENV = puvodni;
    }
  });
});
