import { describe, expect, it } from "vitest";
import { resendOdesilatel, type ResendKlient } from "../src/odesilatel-resend.js";

/**
 * Napojení na Resend.
 *
 * Testuje se **překlad naší zprávy na požadavek pro Resend**, ne Resend sám —
 * klient je podstrčený, takže nic neodchází do sítě. Kdyby se tenhle překlad
 * pokazil, poznalo by se to jinak až podle divně vypadajícího mailu
 * u příjemce.
 */

/** Klient, který si zapamatuje, s čím byl zavolán. */
function falesnyKlient(odpoved: { data?: { id: string }; error?: { message: string } }) {
  const volani: Array<{ payload: Record<string, unknown>; opts?: { idempotencyKey?: string } }> = [];
  const klient: ResendKlient = {
    emails: {
      async send(payload, opts) {
        volani.push({ payload: payload as Record<string, unknown>, opts });
        return odpoved as never;
      },
    },
  };
  return { klient, volani };
}

const ZPRAVA = {
  komu: "majitel@cantinero.cz",
  predmet: "Obědy pro zaměstnance",
  telo: "Dobrý den,\n\ntext zprávy.",
  klic: "zkouska/kampan-1/10000000",
};

describe("odesílatel přes Resend", () => {
  it("pošle prostý text, ne HTML — zpráva musí vypadat jako od člověka", async () => {
    const { klient, volani } = falesnyKlient({ data: { id: "re_1" } });
    const o = resendOdesilatel({ klient, od: "Jan Laub <laub@cantinero.cz>" });

    await o.posli(ZPRAVA);

    expect(volani[0]?.payload.text).toBe(ZPRAVA.telo);
    expect(volani[0]?.payload.html).toBeUndefined();
  });

  it("předá odesílatele, příjemce i předmět", async () => {
    const { klient, volani } = falesnyKlient({ data: { id: "re_1" } });
    const o = resendOdesilatel({ klient, od: "Jan Laub <laub@cantinero.cz>" });

    await o.posli(ZPRAVA);

    expect(volani[0]?.payload.from).toBe("Jan Laub <laub@cantinero.cz>");
    expect(volani[0]?.payload.to).toEqual(["majitel@cantinero.cz"]);
    expect(volani[0]?.payload.subject).toBe("Obědy pro zaměstnance");
  });

  it("pošle klíč proti dvojímu odeslání", async () => {
    const { klient, volani } = falesnyKlient({ data: { id: "re_1" } });
    const o = resendOdesilatel({ klient, od: "laub@cantinero.cz" });

    await o.posli(ZPRAVA);

    // Kdyby se odeslání opakovalo po výpadku sítě, Resend podle klíče pozná,
    // že tuhle zprávu už zpracoval, a nepošle ji dvakrát. U pravidla „jedna
    // firma = jedno oslovení" je to druhá vrstva pojistky.
    expect(volani[0]?.opts?.idempotencyKey).toBe("zkouska/kampan-1/10000000");
  });

  it("vrátí identifikátor od poskytovatele", async () => {
    const { klient } = falesnyKlient({ data: { id: "re_abc" } });
    const o = resendOdesilatel({ klient, od: "laub@cantinero.cz" });

    expect(await o.posli(ZPRAVA)).toEqual({ providerId: "re_abc" });
  });

  it("chybu z Resendu pozná — SDK ji nevyhazuje, vrací ji v odpovědi", async () => {
    const { klient } = falesnyKlient({ error: { message: "Domain is not verified" } });
    const o = resendOdesilatel({ klient, od: "laub@cantinero.cz" });

    // Tohle je nejčastější past celého SDK: `try/catch` by chybu minul
    // a zpráva by se tvářila jako odeslaná.
    await expect(o.posli(ZPRAVA)).rejects.toThrow(/not verified/);
  });

  it("odpověď bez identifikátoru se bere jako selhání, ne jako úspěch", async () => {
    const { klient } = falesnyKlient({});
    const o = resendOdesilatel({ klient, od: "laub@cantinero.cz" });

    await expect(o.posli(ZPRAVA)).rejects.toThrow();
  });

  it("adresu pro odpovědi nastaví, jen když se liší od odesílatele", async () => {
    const { klient: k1, volani: v1 } = falesnyKlient({ data: { id: "re_1" } });
    await resendOdesilatel({ klient: k1, od: "laub@cantinero.cz" }).posli(ZPRAVA);
    expect(v1[0]?.payload.replyTo).toBeUndefined();

    const { klient: k2, volani: v2 } = falesnyKlient({ data: { id: "re_1" } });
    await resendOdesilatel({
      klient: k2,
      od: "obedy@cantinero.cz",
      odpovedNa: "laub@cantinero.cz",
    }).posli(ZPRAVA);
    expect(v2[0]?.payload.replyTo).toBe("laub@cantinero.cz");
  });
});
