import React from "react";
import { ACCENT, CARD, FONT_BODY, FONT_HEAD, FONT_MONO, FRANJAS_HORARIAS, HILITE_BG, INK, LINE, LOGO_CA, LOGO_HOTEL, MUTED, PAGADO, PARCIAL, PENDIENTE } from "../constants.js";

export function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs uppercase tracking-wide mb-1" style={{ color: MUTED, fontFamily: FONT_BODY, letterSpacing: "0.08em" }}>{label}</span>
      {children}
    </label>
  );
}

export const inputStyle = {
  width: "100%", padding: "9px 11px", borderRadius: 6, border: `1px solid ${LINE}`,
  background: CARD, fontFamily: FONT_BODY, fontSize: 14, color: INK,
};

// Selector de horario: desplegable de franjas 06:00–23:00, con opción de ingreso manual
export function HoraField({ value, onChange, manual, onManualToggle }) {
  const esFranja = FRANJAS_HORARIAS.includes(value);
  const modoManual = manual || (!!value && !esFranja);
  return (
    <div>
      {!modoManual ? (
        <select style={inputStyle} value={esFranja ? value : ""} onChange={e => onChange(e.target.value)}>
          <option value="">Elegir horario…</option>
          {FRANJAS_HORARIAS.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
      ) : (
        <input style={inputStyle} value={value} onChange={e => onChange(e.target.value)} placeholder="Ej: 20:15 hs" />
      )}
      <button type="button" onClick={() => onManualToggle(!modoManual)}
        className="text-xs mt-1" style={{ color: ACCENT, fontFamily: FONT_BODY }}>
        {modoManual ? "Elegir de la lista" : "Ingresar manualmente"}
      </button>
    </div>
  );
}

export function Stamp({ estadoPago }) {
  const map = {
    total: { color: PAGADO, label: "Pago Total" },
    parcial: { color: PARCIAL, label: "Pago Parcial" },
    sena: { color: PARCIAL, label: "Seña" },
    pendiente: { color: PENDIENTE, label: "Pendiente" },
  };
  const s = map[estadoPago] || map.pendiente;
  return (
    <div style={{
      display: "inline-block", border: `2px solid ${s.color}`,
      color: s.color, padding: "3px 12px", borderRadius: 4,
      fontFamily: FONT_MONO, fontSize: 12, fontWeight: 600,
      letterSpacing: "0.12em", transform: "rotate(-3deg)", textTransform: "uppercase",
    }}>
      {s.label}
    </div>
  );
}

export function LogoCA({ size = 44 }) {
  return <img src={LOGO_CA} alt="Carmela Álvarez Event Planner" style={{ height: size, width: "auto", display: "block" }} />;
}
export function LogoHotel({ width = 120 }) {
  return <img src={LOGO_HOTEL} alt="Hotel Argos" style={{ width, height: "auto", display: "block" }} />;
}

export function PrintHeader({ eyebrow, titulo }) {
  return (
    <div className="flex justify-between items-start pb-4 mb-4" style={{ borderBottom: `2px solid ${INK}` }}>
      <div className="flex items-center gap-3">
        <LogoCA size={46} />
        <div>
          <p style={{ fontFamily: FONT_BODY, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED }}>{eyebrow}</p>
          <h2 style={{ fontFamily: FONT_HEAD, fontSize: 24, color: INK }}>{titulo}</h2>
        </div>
      </div>
      <LogoHotel width={110} />
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 p-2.5 rounded" style={{ background: checked ? HILITE_BG : "transparent", border: `1px solid ${checked ? ACCENT : LINE}`, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK }}>{label}</span>
    </label>
  );
}

/* ============================================================
   FORMULARIO DE EVENTO
   ============================================================ */
