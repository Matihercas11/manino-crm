import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { Coffee } from "lucide-react";

const SESSION_KEY = "manino_pin_ok";

export default function PinGate({ children }) {
  const [verified, setVerified] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const inputs = useRef([]);

  useEffect(() => {
    if (!verified) inputs.current[0]?.focus();
  }, [verified]);

  const handleKey = (i, e) => {
    if (e.key === "Backspace") {
      const next = [...digits];
      if (next[i]) {
        next[i] = "";
        setDigits(next);
      } else if (i > 0) {
        next[i - 1] = "";
        setDigits(next);
        inputs.current[i - 1]?.focus();
      }
      setError(false);
      return;
    }
    if (!/^\d$/.test(e.key)) return;
    const next = [...digits];
    next[i] = e.key;
    setDigits(next);
    setError(false);
    if (i < 3) {
      inputs.current[i + 1]?.focus();
    } else {
      submit(next);
    }
  };

  const submit = async (d) => {
    const pin = d.join("");
    if (pin.length < 4) return;
    setChecking(true);
    try {
      await api.post("/auth/verify-pin", { pin });
      sessionStorage.setItem(SESSION_KEY, "1");
      setVerified(true);
    } catch {
      setError(true);
      setShake(true);
      setDigits(["", "", "", ""]);
      setTimeout(() => { setShake(false); inputs.current[0]?.focus(); }, 600);
    } finally {
      setChecking(false);
    }
  };

  if (verified) return children;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "var(--m-app)" }}>
      <div className="flex flex-col items-center gap-8 w-full max-w-xs px-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 flex items-center justify-center rounded-sm"
            style={{ background: "var(--m-terracotta)" }}>
            <Coffee className="w-6 h-6 text-white" strokeWidth={1.8} />
          </div>
          <div className="leading-tight">
            <div className="font-serif text-2xl font-semibold tracking-tight">Manino</div>
            <div className="eyebrow" style={{ fontSize: 9 }}>Coffee · Dealer · Curator</div>
          </div>
        </div>

        <div className="w-full card-base p-8 flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="font-serif text-xl">Acceso interno</div>
            <div className="text-sm mt-1" style={{ color: "var(--m-ink-2)" }}>
              Ingresá el PIN de 4 dígitos
            </div>
          </div>

          <div className={`flex gap-3 ${shake ? "animate-shake" : ""}`}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => inputs.current[i] = el}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={() => {}}
                onKeyDown={e => handleKey(i, e)}
                disabled={checking}
                className="w-12 h-14 text-center text-2xl font-mono rounded-sm border outline-none transition-colors"
                style={{
                  borderColor: error ? "var(--m-danger)" : d ? "var(--m-terracotta)" : "var(--m-border)",
                  background: "transparent",
                  color: "var(--m-ink)",
                }}
              />
            ))}
          </div>

          {error && (
            <div className="text-sm font-medium" style={{ color: "var(--m-danger)" }}>
              PIN incorrecto. Intentá de nuevo.
            </div>
          )}

          {checking && (
            <div className="text-xs" style={{ color: "var(--m-ink-2)" }}>Verificando…</div>
          )}
        </div>

        <div className="eyebrow text-center" style={{ fontSize: 9, letterSpacing: "0.2em" }}>
          v1.0 · Interno
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
}
