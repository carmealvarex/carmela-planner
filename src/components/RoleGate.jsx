import React, { useState } from "react";
import { ACCENT, CARD, FONT_BODY, INK, INK_SOFT, LINE, MUTED, PAPER, PENDIENTE } from "../constants.js";
import { LogoCA } from "./common.jsx";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: `1px solid ${LINE}`,
  fontFamily: FONT_BODY,
  fontSize: 14,
  color: INK,
  background: PAPER,
};

export function RoleGate({ onEnter, pin, setPinIfEmpty }) {
  const [step, setStep] = useState(null);
  const [input, setInput] = useState("");
  const [newPin, setNewPin] = useState("");
  const [err, setErr] = useState("");

  if (step === "admin") {
    if (pin === null) {
      return (
        <div className="max-w-sm mx-auto mt-16 p-6" style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 10 }}>
          <p className="mb-3 text-sm" style={{ fontFamily: FONT_BODY, color: INK }}>Primera vez: creá un código de acceso para la organizadora.</p>
          <input style={inputStyle} value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="Elegí un código (ej: 2604)" />
          <button className="mt-3 w-full py-2 rounded font-medium" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}
            onClick={() => { if (newPin.trim()) { setPinIfEmpty(newPin.trim()); onEnter("admin"); } }}>
            Guardar y entrar
          </button>
        </div>
      );
    }
    return (
      <div className="max-w-sm mx-auto mt-16 p-6" style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 10 }}>
        <p className="mb-3 text-sm" style={{ fontFamily: FONT_BODY, color: INK }}>Ingresá tu código de acceso.</p>
        <input type="password" style={inputStyle} value={input} onChange={e => setInput(e.target.value)} placeholder="Código" />
        {err && <p className="text-xs mt-1" style={{ color: PENDIENTE }}>{err}</p>}
        <button className="mt-3 w-full py-2 rounded font-medium" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}
          onClick={() => { if (input === pin) onEnter("admin"); else setErr("Código incorrecto."); }}>
          Entrar
        </button>
        <button className="mt-2 w-full py-1 text-xs" style={{ color: MUTED }} onClick={() => setStep(null)}>Volver</button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16 p-8 text-center" style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 10 }}>
      <div className="flex justify-center mb-4"><LogoCA size={90} /></div>
      <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED, marginBottom: 24 }}>¿Cómo querés entrar?</p>
      <button className="w-full py-3 rounded font-medium mb-3" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}
        onClick={() => setStep("admin")}>
        Soy la organizadora
      </button>
      <button className="w-full py-3 rounded font-medium" style={{ background: "transparent", color: INK, border: `1px solid ${ACCENT}`, fontFamily: FONT_BODY }}
        onClick={() => onEnter("guest")}>
        Entrar como invitado/a (solo ver)
      </button>
    </div>
  );
}
