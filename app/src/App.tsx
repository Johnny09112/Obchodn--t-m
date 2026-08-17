import { useState } from "react";
import { usePrihlaseni } from "./auth";
import { Prihlaseni } from "./Prihlaseni";
import { Kartoteka } from "./Kartoteka";
import { Kampane } from "./Kampane";
import { Oblasti } from "./Oblasti";
import { Jidelny } from "./Jidelny";
import { Provoz } from "./Provoz";
import { Signaly } from "./Signaly";
import { POPIS_ROLE, roleZeSession, supabase } from "./supabase";

type Pohled = "signaly" | "oblasti" | "kartoteka" | "kampane" | "jidelny" | "provoz";

export function App() {
  const { session, nacita } = usePrihlaseni();
  // Podněty jsou první obrazovka schválně: kartotéka odpovídá „koho máme",
  // ale ráno rozhoduje „komu volat dnes a proč".
  const [pohled, setPohled] = useState<Pohled>("signaly");

  // Než se ověří uložené přihlášení, neukazuj ani kartotéku, ani přihlašovací
  // lístek — problikávání by vypadalo jako odhlášení.
  if (nacita) return <p className="nacitani">Moment…</p>;

  if (!session) return <Prihlaseni />;

  const role = roleZeSession(session.user.app_metadata);

  return (
    <>
      <header className="lista">
        <span className="znacka">Cantinero</span>
        <nav className="rozcestnik">
          <button
            className={pohled === "signaly" ? "aktivni" : ""}
            onClick={() => setPohled("signaly")}
          >
            Co je nového
          </button>
          <button
            className={pohled === "oblasti" ? "aktivni" : ""}
            onClick={() => setPohled("oblasti")}
          >
            Oblasti
          </button>
          <button
            className={pohled === "kartoteka" ? "aktivni" : ""}
            onClick={() => setPohled("kartoteka")}
          >
            Kartotéka
          </button>
          <button
            className={pohled === "kampane" ? "aktivni" : ""}
            onClick={() => setPohled("kampane")}
          >
            Kampaně
          </button>
          {/* Jídelny vidí každý — volná kapacita je údaj, podle kterého se
              rozhoduje, komu má vůbec smysl psát. Měnit ji smí jen admin. */}
          <button
            className={pohled === "jidelny" ? "aktivni" : ""}
            onClick={() => setPohled("jidelny")}
          >
            Jídelny
          </button>
          {/* Provozní deník je technický — běžnému uživateli by k ničemu nebyl. */}
          {(role === "admin" || role === "super-admin") && (
            <button
              className={pohled === "provoz" ? "aktivni" : ""}
              onClick={() => setPohled("provoz")}
            >
              Provoz
            </button>
          )}
        </nav>
        <span className="odsazovac" />
        <span className="kdo">{session.user.email}</span>
        <span className="stitek-role">{POPIS_ROLE[role]}</span>
        <button className="tlacitko tise" onClick={() => supabase.auth.signOut()}>
          Odhlásit
        </button>
      </header>
      <main>
        {pohled === "signaly" && <Signaly email={session.user.email ?? ""} />}
        {pohled === "oblasti" && <Oblasti role={role} />}
        {pohled === "kartoteka" && <Kartoteka />}
        {pohled === "kampane" && (
          <Kampane role={role} email={session.user.email ?? ""} />
        )}
        {pohled === "jidelny" && <Jidelny role={role} />}
        {pohled === "provoz" && (role === "admin" || role === "super-admin") && <Provoz />}
      </main>
    </>
  );
}
