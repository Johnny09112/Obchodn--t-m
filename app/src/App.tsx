import { usePrihlaseni } from "./auth";
import { Prihlaseni } from "./Prihlaseni";
import { Kartoteka } from "./Kartoteka";
import { POPIS_ROLE, roleZeSession, supabase } from "./supabase";

export function App() {
  const { session, nacita } = usePrihlaseni();

  // Než se ověří uložené přihlášení, neukazuj ani kartotéku, ani přihlašovací
  // lístek — problikávání by vypadalo jako odhlášení.
  if (nacita) return <p className="nacitani">Moment…</p>;

  if (!session) return <Prihlaseni />;

  const role = roleZeSession(session.user.app_metadata);

  return (
    <>
      <header className="lista">
        <span className="znacka">Cantinero</span>
        <span className="odsazovac" />
        <span className="kdo">{session.user.email}</span>
        <span className="stitek-role">{POPIS_ROLE[role]}</span>
        <button className="tlacitko tise" onClick={() => supabase.auth.signOut()}>
          Odhlásit
        </button>
      </header>
      <main>
        <Kartoteka />
      </main>
    </>
  );
}
