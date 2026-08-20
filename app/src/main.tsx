import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ChybejiciNastaveni } from "./ChybejiciNastaveni";
import { CHYBI_NASTAVENI } from "./supabase";
import "./styl.css";

// Kontrola nastavení patří sem, ne dovnitř aplikace: takhle se zaručeně
// nestihne položit jediný dotaz do databáze dřív, než se zjistí, že
// nasazení neví, ke které databázi patří.
createRoot(document.getElementById("app")!).render(
  <StrictMode>
    {CHYBI_NASTAVENI.length > 0 ? <ChybejiciNastaveni chybi={CHYBI_NASTAVENI} /> : <App />}
  </StrictMode>,
);
