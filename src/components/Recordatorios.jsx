import React, { useState } from "react";
import { CARD, FONT_BODY, FONT_HEAD, HILITE_BG, INK, INK_SOFT, LINE, MUTED, PAPER, PENDIENTE, PENDIENTE_BG } from "../constants.js";
import { diasHasta, toISO, uid } from "../utils/helpers.js";
import { Field, inputStyle } from "./common.jsx";
import { useConfirm } from "./ConfirmDialog.jsx";

function blankRecordatorioSuelto() {
  return { id: uid(), texto: "", fecha: toISO(new Date()), diasAntes: "0" };
}

// Solapa "Recordatorios": junta en una sola vista los recordatorios cargados
// adentro de cada evento (ev.recordatorios, se siguen cargando desde la ficha
// del evento) con los recordatorios "sueltos" que no dependen de ningún evento
// puntual (ej: renovar un trámite, llamar a un proveedor). Estos últimos se
// guardan en su propia clave ("recordatoriosSueltos") para que también
// disparen el aviso en la campanita, igual que los de evento.
export function Recordatorios({ events, recordatoriosSueltos, setRecordatoriosSueltos, onOpenEvent }) {
  const confirm = useConfirm();
  const [nuevo, setNuevo] = useState(blankRecordatorioSuelto());

  const agregar = () => {
    if (!nuevo.texto.trim() || !nuevo.fecha) return;
    setRecordatoriosSueltos(prev => [...prev, { ...nuevo, texto: nuevo.texto.trim() }]);
    setNuevo(blankRecordatorioSuelto());
  };

  const eliminarSuelto = async (id) => {
    if (!(await confirm("¿Eliminar este recordatorio?", { danger: true, confirmLabel: "Sí, eliminar" }))) return;
    setRecordatoriosSueltos(prev => prev.filter(r => r.id !== id));
  };

  // Recordatorios cargados adentro de cada evento (se editan desde la ficha del evento,
  // acá solo se listan para tener todo junto en una sola pantalla).
  const deEventos = events
    .flatMap(e => (e.recordatorios || []).map(r => ({
      id: `ev-${e.id}-${r.id}`,
      texto: r.texto,
      fecha: e.fecha,
      dias: diasHasta(e.fecha),
      ev: e,
      origen: "evento",
    })))
    .filter(r => r.dias !== null);

  const sueltos = recordatoriosSueltos
    .map(r => ({ ...r, dias: diasHasta(r.fecha), origen: "suelto" }))
    .filter(r => r.dias !== null);

  const combinados = [...deEventos, ...sueltos].sort((a, b) => a.dias - b.dias);
  const vencidosCount = combinados.filter(r => r.dias < 0).length;
  // Los recordatorios de eventos/fechas que ya pasaron (ej: "hablar con Leo de vajilla" de un
  // evento viejo) no sirven de nada dando vueltas en la lista, así que se ocultan solos. Si
  // alguna vez hace falta revisar uno viejo, "Ver vencidos" los vuelve a mostrar.
  const [verVencidos, setVerVencidos] = useState(false);
  const todos = combinados.filter(r => verVencidos || r.dias >= 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="p-5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
        <h3 style={{ fontFamily: FONT_HEAD, fontSize: 20, color: INK, marginBottom: 12 }}>Nuevo recordatorio suelto</h3>
        <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: MUTED, marginBottom: 16 }}>
          Para avisos que no están atados a un evento puntual (ej: renovar un trámite, llamar a un proveedor).
          Los recordatorios de un evento específico se siguen cargando desde la ficha de ese evento.
        </p>
        <div className="flex flex-col gap-3">
          <Field label="Texto del recordatorio">
            <input
              style={inputStyle}
              value={nuevo.texto}
              onChange={e => setNuevo({ ...nuevo, texto: e.target.value })}
              placeholder="Ej: Renovar habilitación municipal"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha">
              <input type="date" style={inputStyle} value={nuevo.fecha} onChange={e => setNuevo({ ...nuevo, fecha: e.target.value })} />
            </Field>
            <Field label="Avisar con anticipación (días)">
              <input
                type="number" min="0" style={inputStyle}
                value={nuevo.diasAntes}
                onChange={e => setNuevo({ ...nuevo, diasAntes: e.target.value })}
              />
            </Field>
          </div>
          <button
            onClick={agregar}
            className="px-4 py-2 rounded text-sm font-medium self-start"
            style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}
          >
            Agregar recordatorio
          </button>
        </div>
      </div>

      <div className="p-5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 style={{ fontFamily: FONT_HEAD, fontSize: 20, color: INK }}>
            Todos los recordatorios {todos.length > 0 ? `(${todos.length})` : ""}
          </h3>
          {vencidosCount > 0 && (
            <button
              onClick={() => setVerVencidos(v => !v)}
              style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED, textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}
            >
              {verVencidos ? "Ocultar vencidos" : `Ver vencidos (${vencidosCount})`}
            </button>
          )}
        </div>
        {todos.length === 0 ? (
          <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED }}>
            {vencidosCount > 0 ? "No hay recordatorios pendientes (solo vencidos, ocultos)." : "No hay recordatorios cargados todavía."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {todos.map(r => {
              const vencido = r.dias < 0;
              return (
                <div
                  key={r.id}
                  className="p-3 rounded flex items-center gap-3"
                  style={{ background: vencido ? PENDIENTE_BG : HILITE_BG, border: `1px solid ${vencido ? PENDIENTE : LINE}` }}
                >
                  <div className="flex-1">
                    <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK }}>{r.texto}</p>
                    <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: MUTED, marginTop: 2 }}>
                      {r.origen === "evento" ? `Evento: ${r.ev.nombreEvento || r.ev.salon || "Sin nombre"} · ` : ""}
                      {vencido
                        ? `Venció hace ${Math.abs(r.dias)} día${Math.abs(r.dias) === 1 ? "" : "s"}`
                        : r.dias === 0 ? "Hoy" : `En ${r.dias} día${r.dias === 1 ? "" : "s"}`}
                      {" "}({r.fecha.split("-").reverse().join("/")})
                    </p>
                  </div>
                  {r.origen === "evento" ? (
                    <button
                      onClick={() => onOpenEvent(r.ev)}
                      className="text-xs px-2 py-1 rounded"
                      style={{ fontFamily: FONT_BODY, color: INK, border: `1px solid ${LINE}`, background: CARD, whiteSpace: "nowrap" }}
                    >
                      Ver ficha
                    </button>
                  ) : (
                    <button
                      onClick={() => eliminarSuelto(r.id)}
                      className="text-xs px-2 py-1 rounded"
                      style={{ fontFamily: FONT_BODY, color: PENDIENTE, border: `1px solid ${LINE}`, background: CARD, whiteSpace: "nowrap" }}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
