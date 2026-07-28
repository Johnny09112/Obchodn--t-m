import { useState, type FormEvent } from "react";
import { supabase } from "./supabase";

/** Hlášky ze Supabase chodí anglicky. Uživatel je nemá číst v angličtině. */
function cesky(zprava: string): string {
  if (/invalid login credentials/i.test(zprava)) {
    return "E-mail nebo heslo nesedí. Zkuste to prosím znovu.";
  }
  if (/email not confirmed/i.test(zprava)) {
    return "Účet zatím není potvrzený. Potvrďte odkaz v e-mailu, který od nás přišel.";
  }
  if (/rate limit|too many/i.test(zprava)) {
    return "Příliš mnoho pokusů po sobě. Zkuste to za chvíli.";
  }
  if (/fetch|network/i.test(zprava)) {
    return "Nepodařilo se spojit s databází. Zkontrolujte připojení k internetu.";
  }
  return zprava;
}

export function Prihlaseni() {
  const [email, setEmail] = useState("");
  const [heslo, setHeslo] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [odesila, setOdesila] = useState(false);

  async function prihlas(e: FormEvent) {
    e.preventDefault();
    setChyba(null);
    setOdesila(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: heslo });
    // Při úspěchu se o překreslení postará posluchač přihlášení.
    if (error) {
      setChyba(cesky(error.message));
      setOdesila(false);
    }
  }

  return (
    <div className="brana">
      <form className="listek" onSubmit={prihlas}>
        <p className="eyebrow">Kartotéka a oblasti</p>
        <h1 className="znacka">Cantinero</h1>

        <hr className="rozdelovac" />

        <label className="pole">
          <span>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
        </label>

        <label className="pole">
          <span>Heslo</span>
          <input
            type="password"
            value={heslo}
            onChange={(e) => setHeslo(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button className="tlacitko" type="submit" disabled={odesila}>
          {odesila ? "Přihlašuji…" : "Přihlásit se"}
        </button>

        {chyba && (
          <p className="hlaska" role="alert">
            {chyba}
          </p>
        )}

        <p className="patka">
          Účty zakládá správce. Nové heslo nastaví taky on — samoobslužná
          registrace tu není záměrně.
        </p>
      </form>
    </div>
  );
}
