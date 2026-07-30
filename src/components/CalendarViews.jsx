import React, { useMemo, useState } from "react";
import { ACCENT, CARD, DIAS_CORTOS, FONT_BODY, FONT_HEAD, FONT_MONO, INK, INK_SOFT, LINE, MESES, MUTED, PAGADO, PAGADO_BG, PAPER, PARCIAL, PARCIAL_BG, PENDIENTE, PENDIENTE_BG } from "../constants.js";
import { addDays, esMultiDia, eventoEnDia, fechasEvento, fmtRangoFecha, fromISO, getMonthGrid, toISO } from "../utils/helpers.js";
import { textoSemana, waLink } from "../utils/texto.js";
import { Stamp } from "./common.jsx";

export function MonthView({ year, month, events, onPrev, onNext, onDayClick }) {
  const weeks = useMemo(() => getMonthGrid(year, month), [year, month]);
  const eventosPorDia = useMemo(() => {
    const map = {};
    events.forEach(e => { fechasEvento(e).forEach(iso => { (map[iso] = map[iso] || []).push(e); }); });
    return map;
  }, [events]);
  const today = toISO(new Date());

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={onPrev} style={{ color: ACCENT }} className="text-xl px-2">‹</button>
        <h2 style={{ fontFamily: FONT_HEAD, fontSize: 22, color: INK }}>{MESES[month]} {year}</h2>
        <button onClick={onNext} style={{ color: ACCENT }} className="text-xl px-2">›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DIAS_CORTOS.map(d => <div key={d} className="text-center text-xs py-1" style={{ color: MUTED, fontFamily: FONT_BODY }}>{d}</div>)}
      </div>
      <div className="flex flex-col gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((d, di) => {
              if (!d) return <div key={di} />;
              const iso = toISO(d);
              const evs = eventosPorDia[iso] || [];
              const isToday = iso === today;
              return (
                <button key={di} onClick={() => onDayClick(iso)}
                  className="text-left p-1.5 rounded"
                  style={{
                    minHeight: 64, background: CARD,
                    border: isToday ? `1.5px solid ${ACCENT}` : `1px solid ${LINE}`,
                  }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: INK }}>{d.getDate()}</div>
                  <div className="flex flex-col gap-0.5 mt-1">
                    {evs.slice(0, 3).map(e => {
                      const bg = e.colorEvento || (e.estadoPago === "total" ? PAGADO_BG : (e.estadoPago === "parcial" || e.estadoPago === "sena") ? PARCIAL_BG : PENDIENTE_BG);
                      const fg = e.colorEvento ? "#fff" : (e.estadoPago === "total" ? PAGADO : (e.estadoPago === "parcial" || e.estadoPago === "sena") ? PARCIAL : PENDIENTE);
                      return (
                        <div key={e.id} className="truncate rounded px-1" style={{ fontSize: 10, background: bg, color: fg, fontFamily: FONT_BODY }}>
                          {esMultiDia(e) ? "↔ " : ""}{e.nombreEvento || e.salon || "Evento"}
                        </div>
                      );
                    })}
                    {evs.length > 3 && <div style={{ fontSize: 10, color: MUTED }}>+{evs.length - 3} más</div>}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   VISTA SEMANAL
   ============================================================ */
export function WeekView({ weekStart, setWeekStart, events, isAdmin, onOpenEvent, onNewEvent }) {
  const [copiado, setCopiado] = useState(false);
  const desde = weekStart, hasta = addDays(weekStart, 6);
  const enSemana = events
    .filter(e => { const fi = fromISO(e.fecha), ff = e.fechaFin && e.fechaFin > e.fecha ? fromISO(e.fechaFin) : fi; return ff >= desde && fi <= hasta; })
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.horaInicio || "").localeCompare(b.horaInicio || ""));
  const texto = textoSemana(events, weekStart);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} style={{ color: ACCENT }} className="text-xl px-2">‹</button>
        <h2 style={{ fontFamily: FONT_HEAD, fontSize: 18, color: INK }}>{desde.getDate()} al {hasta.getDate()} de {MESES[hasta.getMonth()]}</h2>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} style={{ color: ACCENT }} className="text-xl px-2">›</button>
      </div>

      <div className="flex flex-col gap-2">
        {enSemana.map(e => (
          <button key={e.id} onClick={() => onOpenEvent(e)} className="text-left p-3 rounded flex items-center justify-between" style={{ background: CARD, border: `1px solid ${LINE}` }}>
            <div>
              <div style={{ fontFamily: FONT_BODY, fontWeight: 600, color: INK, fontSize: 14 }}>{fmtRangoFecha(e)} — {e.salon || "Sin salón"}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED }}>{e.horaInicio}–{e.horaFin} · {e.personas || "?"} personas</div>
            </div>
            <Stamp estadoPago={e.estadoPago} />
          </button>
        ))}
        {!enSemana.length && <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED }}>Sin eventos cargados esta semana.</p>}
        {isAdmin && (
          <button onClick={() => onNewEvent(toISO(weekStart))} className="p-3 rounded text-sm" style={{ border: `1px dashed ${ACCENT}`, color: ACCENT, fontFamily: FONT_BODY }}>
            + Agregar evento a esta semana
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="p-4 rounded" style={{ background: INK_SOFT }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: PAPER, fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>Texto para enviar</span>
            <div className="flex gap-2">
              <button onClick={() => { navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}
                className="text-xs px-3 py-1 rounded" style={{ background: ACCENT, color: INK, fontFamily: FONT_BODY, fontWeight: 600 }}>
                {copiado ? "¡Copiado!" : "Copiar"}
              </button>
              <a href={waLink("", texto)} target="_blank" rel="noreferrer" className="text-xs px-3 py-1 rounded" style={{ background: PAGADO, color: PAPER, fontFamily: FONT_BODY, fontWeight: 600 }}>
                Abrir en WhatsApp
              </a>
            </div>
          </div>
          <pre style={{ whiteSpace: "pre-wrap", color: PAPER, fontFamily: FONT_MONO, fontSize: 12.5, lineHeight: 1.6 }}>{texto}</pre>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   VISTA POR DÍA
   ============================================================ */
export function DayView({ dia, setDia, events, isAdmin, onOpenEvent, onNewEvent }) {
  const evsDia = events
    .filter(e => eventoEnDia(e, toISO(dia)))
    .sort((a, b) => (a.horaInicio || "").localeCompare(b.horaInicio || ""));
  const diaSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][dia.getDay()];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setDia(addDays(dia, -1))} style={{ color: ACCENT }} className="text-xl px-2">‹</button>
        <div className="text-center">
          <h2 style={{ fontFamily: FONT_HEAD, fontSize: 18, color: INK }}>{diaSemana} {dia.getDate()} de {MESES[dia.getMonth()]}</h2>
          <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: MUTED }}>{dia.getFullYear()}</p>
        </div>
        <button onClick={() => setDia(addDays(dia, 1))} style={{ color: ACCENT }} className="text-xl px-2">›</button>
      </div>

      <div className="flex flex-col gap-2">
        {evsDia.map(e => (
          <button key={e.id} onClick={() => onOpenEvent(e)} className="text-left p-3 rounded flex items-center justify-between" style={{ background: CARD, border: `1px solid ${LINE}` }}>
            <div>
              <div style={{ fontFamily: FONT_BODY, fontWeight: 600, color: INK, fontSize: 14 }}>
                {esMultiDia(e) ? "↔ " : ""}{e.nombreEvento || e.salon || "Evento"}
              </div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED }}>
                {e.salon || "Sin salón"} · {e.horaInicio}–{e.horaFin} · {e.personas || "?"} personas
              </div>
            </div>
            <Stamp estadoPago={e.estadoPago} />
          </button>
        ))}
        {!evsDia.length && <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED }}>Sin eventos cargados este día.</p>}
        {isAdmin && (
          <button onClick={() => onNewEvent(toISO(dia))} className="p-3 rounded text-sm" style={{ border: `1px dashed ${ACCENT}`, color: ACCENT, fontFamily: FONT_BODY }}>
            + Agregar evento a este día
          </button>
        )}
      </div>
    </div>
  );
}
