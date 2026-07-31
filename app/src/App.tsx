import { useState } from "react";
import { usePrihlaseni } from "./auth";
import { Prihlaseni } from "./Prihlaseni";
import { Kartoteka } from "./Kartoteka";
import { Kampane } from "./Kampane";
import { Oblasti } from "./Oblasti";
import { POPIS_ROLE, roleZeSession, supabase } from "./supabase";

type Pohled = "oblasti" | "kartoteka" | "kampane";

export function App() {
  const { session, nacita } = usePrihlaseni();
  const [pohled, setPohled] = useState<Pohled>("oblasti");

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
        </nav>
        <span className="odsazovac" />
        <span className="kdo">{session.user.email}</span>
        <span className="stitek-role">{POPIS_ROLE[role]}</span>
        <button className="tlacitko tise" onClick={() => supabase.auth.signOut()}>
          Odhlásit
        </button>
      </header>
      <main>
        {pohled === "oblasti" && <Oblasti role={role} />}
        {pohled === "kartoteka" && <Kartoteka />}
        {pohled === "kampane" && (
          <Kampane role={role} email={session.user.email ?? ""} />
        )}
      </main>
    </>
  );
}
