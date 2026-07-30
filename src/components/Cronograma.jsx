import React from "react";
import { CARD, FONT_BODY, FONT_MONO, HILITE_BG, INK, INK_SOFT, LINE, MUTED, PAPER } from "../constants.js";
import { fmtRangoFecha } from "../utils/helpers.js";
import { PrintHeader } from "./common.jsx";

export function Cronograma({ ev, onBack }) {
  const bloques = [];
  if (ev.horaArmado) bloques.push({ hora: ev.horaArmado, detalle: "Armado" });
  (ev.cronograma || []).forEach(c => bloques.push(c));
  if (ev.horaDesarme) {
    bloques.push({ hora: ev.horaFin, detalle: "Fin del evento" });
    bloques.push({ hora: ev.horaDesarme, detalle: "Desarme" });
  }
  const ordenados = bloques.slice().sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));

  return (
    <div>
      <div className="no-print flex gap-2 mb-4">
        <button onClick={() => window.print()} className="px-4 py-2 rounded text-sm font-medium" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}>Imprimir cronograma</button>
        <button onClick={onBack} className="px-4 py-2 rounded text-sm font-medium" style={{ border: `1px solid ${LINE}`, color: INK, fontFamily: FONT_BODY }}>Volver</button>
      </div>
      <div className="p-6" style={{ background: CARD, border: `1px solid ${INK}`, maxWidth: 640, margin: "0 auto" }}>
        <PrintHeader eyebrow="Cronograma / hoja de ruta" titulo={ev.salon || "Salón"} />
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED, marginBottom: 16 }}>{fmtRangoFecha(ev)}</p>

        <div className="flex flex-col gap-2 mb-5">
          {ordenados.map((b, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded" style={{ background: HILITE_BG }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: INK, minWidth: 60 }}>{b.hora || "--:--"}</span>
              <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: INK }}>{b.detalle}</span>
            </div>
          ))}
          {!ordenados.length && <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED }}>Sin ítems de cronograma cargados todavía.</p>}
        </div>

        {ev.incluye?.length > 0 && (
          <>
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 8 }}>Tareas de armado</p>
            <div className="flex flex-col gap-1.5 mb-4">
              {ev.incluye.map((item, i) => (
                <label key={i} className="flex items-center gap-2" style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: INK }}>
                  <input type="checkbox" /> {item}
                </label>
              ))}
            </div>
          </>
        )}

        <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: INK }}>
          <b>Personas:</b> {ev.personas || "-"} {ev.servicio ? `· Servicio: ${ev.servicio}` : ""}
        </p>
        {ev.notas && <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: INK, marginTop: 6 }}><b>Notas:</b> {ev.notas}</p>}
      </div>
    </div>
  );
}

