import { describe, expect, it } from "vitest";
import { jeValidniIco } from "../src/ico.js";

describe("jeValidniIco", () => {
  it("přijme platné IČO Seznam.cz", () => {
    expect(jeValidniIco("25596641")).toBe(true);
  });

  it("přijme platné IČO s vedoucí nulou", () => {
    // ČÚS (00006947) — platný mod-11 checksum
    expect(jeValidniIco("00006947")).toBe(true);
  });

  it("odmítne špatný checksum", () => {
    expect(jeValidniIco("25596642")).toBe(false);
    expect(jeValidniIco("00000002")).toBe(false);
  });

  it("odmítne špatnou délku", () => {
    expect(jeValidniIco("1234567")).toBe(false);
    expect(jeValidniIco("123456789")).toBe(false);
  });

  it("odmítne nečíselné znaky", () => {
    expect(jeValidniIco("abcdefgh")).toBe(false);
    expect(jeValidniIco("2559664a")).toBe(false);
  });
});
