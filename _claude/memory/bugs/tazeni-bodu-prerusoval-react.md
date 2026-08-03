---
name: tazeni-bodu-prerusoval-react
description: Bod tvaru šel posunout jen o kousek — každý drag překreslil vrstvu a sebral úchyt zpod myši
type: bug
status: fixed
created: 2026-08-03
updated: 2026-08-03
---

**Příznak:** majitel 3. 8.: „s body nejde hýbat, jen vždy o kousíček — je to
evidentně limitováno časem. Chtěl bych chytnout bod a dokud ho nepustím,
tak se hýbe."

**Nebyl to čas, byl to překreslovací cyklus.** Úchyt volal `onPosunVrcholu`
na **každý `drag`**, tím se změnil stav `navrh` v Reactu, efekt s vrstvou
tvaru se pustil znovu, zavolal `clearLayers()` — a smazal značku, kterou měl
člověk pod myší. Leaflet tak přišel o objekt, který táhl, a pohyb skončil.
Vypadalo to jako škubání po malých krocích.

**Oprava:** během tažení se **na stav Reactu nesahá**.

- `drag` posune jen kresbu (`setLatLngs` na živé kopii bodů, `setLatLng`
  u kruhu) — tvar se hýbe plynule.
- `dragend` zapíše výsledek jednou do Reactu.

**Poučení:** kdykoli Leaflet něco drží (tažení, kreslení), nesmí React během
té akce překreslit vrstvu. React říká, **co** se má nakreslit; dokud uživatel
drží myš, kreslí si to Leaflet sám.

## Vedlejší nález ze stejné opravy

`L.circle(...).getBounds()` **potřebuje mapu** — počítá přes `this._map`.
Kruh vytvořený jen kvůli výpočtu (bez `addTo`) na tom spadne a shodí celou
obrazovku (bílé okno, chyba jen jako varování v konzoli).

Správně je `L.latLng(lat, lng).toBounds(prumerMetru)` — čistý výpočet bez
mapy. U polygonu `getBounds()` funguje i bez mapy, ten problém nemá.
