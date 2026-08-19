import { useEffect, useState } from "react";
import { jeChybaTokenu, odhlasVadnePrihlaseni, usePrihlaseni } from "./auth";
import { Prihlaseni } from "./Prihlaseni";
import { Kartoteka } from "./Kartoteka";
import { Kampane } from "./Kampane";
import { Oblasti } from "./Oblasti";
import { Jidelny } from "./Jidelny";
import { Sablony } from "./Sablony";
import { Provoz } from "./Provoz";
import { Signaly } from "./Signaly";
import { POPIS_ROLE, roleZeSession, supabase } from "./supabase";

type Pohled =
  | "signaly"
  | "oblasti"
  | "kartoteka"
  | "kampane"
  | "jidelny"
  | "sablony"
  | "provoz";

export function App() {
  const { session, nacita } = usePrihlaseni();
  /** Věta pro majitele, když ho aplikace sama odhlásila kvůli vadnému tokenu. */
  const [odhlaseno, setOdhlaseno] = useState<string | null>(null);
  // Podněty jsou první obrazovka schválně: kartotéka odpovídá „koho máme",
  // ale ráno rozhoduje „komu volat dnes a proč".
  const [pohled, setPohled] = useState<Pohled>("signaly");
  // Klik na záložku Kampaně vrátí na seznam, i když v ní zrovna stojí otevřená
  // kampaň — bez toho tlačítko zdánlivě nedělá nic (nalezeno proklikáním
  // 17. 8. 2026). Změna čísla přinutí seznam začít znovu.
  const [zpetNaSeznamKampani, setZpetNaSeznamKampani] = useState(0);

  /**
   * Zkouška uloženého přihlášení hned po startu.
   *
   * 19. 8. 2026 se majiteli místo podnětů ukázalo „JWT issued at future" —
   * uložený token měl vadný časový údaj a každý dotaz s ním padal. Jediná
   * náprava je token zahodit; to má udělat aplikace sama a říct proč,
   * ne nechat majitele luštit anglickou hlášku.
   */
  useEffect(() => {
    if (!session) return;
    supabase
      .from("system_state")
      .select("id")
      .limit(1)
      .then(({ error }) => {
        if (error && jeChybaTokenu(error.message)) {
          void odhlasVadnePrihlaseni().then(() =>
            setOdhlaseno(
              "Uložené přihlášení se pokazilo, tak jsem ho zahodil. Přihlaste se prosím znovu.",
            ),
          );
        }
      });
  }, [session]);

  // Než se ověří uložené přihlášení, neukazuj ani kartotéku, ani přihlašovací
  // lístek — problikávání by vypadalo jako odhlášení.
  if (nacita) return <p className="nacitani">Moment…</p>;

  if (!session)
    return (
      <>
        {odhlaseno && (
          <p className="hlaska" role="alert" style={{ margin: "1rem" }}>
            {odhlaseno}
          </p>
        )}
        <Prihlaseni />
      </>
    );

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
            onClick={() => {
              setPohled("kampane");
              setZpetNaSeznamKampani((n) => n + 1);
            }}
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
          {/* Text oslovení čte každý — ať tým ví, co se firmám píše.
              Měnit a pouštět do provozu smí jen admin. */}
          <button
            className={pohled === "sablony" ? "aktivni" : ""}
            onClick={() => setPohled("sablony")}
          >
            Šablony
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
          <Kampane
            key={zpetNaSeznamKampani}
            role={role}
            email={session.user.email ?? ""}
          />
        )}
        {pohled === "jidelny" && <Jidelny role={role} />}
        {pohled === "sablony" && <Sablony role={role} />}
        {pohled === "provoz" && (role === "admin" || role === "super-admin") && <Provoz />}
      </main>
    </>
  );
}
