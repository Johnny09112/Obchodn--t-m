import { describe, expect, it } from "vitest";
import { rozeberEnv } from "../src/env.js";

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
