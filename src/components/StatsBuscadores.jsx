import React, { useMemo, useState } from "react";
import { ACCENT, CARD, CP_BG, CP_COLOR, FONT_BODY, FONT_HEAD, FONT_MONO, HILITE_BG, INK, INK_SOFT, LINE, MESES, MUTED, PAPER, PARCIAL, PARCIAL_BG, SALONES_FIJOS, VALE_TIPOS } from "../constants.js";
import { fmtMoney, fmtRangoFecha, fromISO } from "../utils/helpers.js";
import { totalItemsEvento } from "../utils/eventHelpers.js";
import { PrintHeader, Stamp, inputStyle } from "./common.jsx";

export function Stats({ events }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const delMes = useMemo(() => events.filter(e => {
    const d = fromISO(e.fecha);
    return d.getFullYear() === year && d.getMonth() === month;
  }), [events, year, month]);

  const totalEventos = delMes.length;

  // Cubiertos vendidos y su desglose, discriminados por cada tipo de VALE_TIPOS
  // (coffee break, almuerzo, cena, desayuno, brindis, finger food, otro), salen
  // del Vale de cada evento (o, en eventos de varios días, del Vale de cada día
  // dentro de e.dias), que es el documento pensado para reconciliar contra la factura.
  const { totalCubiertos, porTipo } = useMemo(() => {
    let totalCubiertos = 0;
    const porTipo = {};
    VALE_TIPOS.forEach(t => { porTipo[t] = 0; });
    const sumarTipo = (t) => {
      const cant = Number(t.cantidad) || 0;
      totalCubiertos += cant;
      if (t.tipo in porTipo) porTipo[t.tipo] += cant;
      else porTipo["Otro"] += cant;
    };
    delMes.forEach(e => {
      if ((e.dias || []).length) {
        e.dias.forEach(d => (d.valeTipos || []).forEach(sumarTipo));
      } else {
        (e.vale?.tipos || []).forEach(sumarTipo);
      }
    });
    return { totalCubiertos, porTipo };
  }, [delMes]);

  // Cantidad de salones vendidos por mes, para cada uno de los 5 salones fijos del hotel.
  // En eventos de varios días, cada día de e.dias cuenta como una venta de salón aparte
  // (así un evento de 3 días con 2 días en un salón y 1 en otro se refleja correctamente).
  const salonesVendidos = useMemo(() => {
    const map = {};
    SALONES_FIJOS.forEach(s => { map[s] = 0; });
    delMes.forEach(e => {
      if ((e.dias || []).length) {
        e.dias.forEach(d => {
          if (d.salon in map) map[d.salon] += 1;
          if (d.salonAdicionalActivo && d.salonAdicional in map) map[d.salonAdicional] += 1;
        });
      } else {
        const s = e.salon;
        if (s in map) map[s] += Number(e.vale?.salonesVendidos) || 1;
      }
    });
    return map;
  }, [delMes]);
  const maxSalon = Math.max(1, ...Object.values(salonesVendidos));

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex gap-2 items-center">
        <select style={{ ...inputStyle, width: "auto" }} value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <input type="number" style={{ ...inputStyle, width: 100 }} value={year} onChange={e => setYear(Number(e.target.value))} />
        <button onClick={() => window.print()} className="px-4 py-2 rounded text-sm font-medium ml-auto" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}>Imprimir</button>
      </div>

      <div className="p-6 rounded" style={{ background: CARD, border: `1px solid ${INK}` }}>
        <PrintHeader eyebrow="Estadística mensual" titulo={`${MESES[month]} ${year}`} />

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-4 rounded text-center" style={{ background: HILITE_BG }}>
            <p style={{ fontFamily: FONT_HEAD, fontSize: 30, color: INK }}>{totalEventos}</p>
            <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Eventos</p>
          </div>
          <div className="p-4 rounded text-center" style={{ background: HILITE_BG }}>
            <p style={{ fontFamily: FONT_HEAD, fontSize: 30, color: INK }}>{totalCubiertos}</p>
            <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Cubiertos vendidos</p>
          </div>
        </div>

        <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 10 }}>Cubiertos vendidos por tipo</p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {VALE_TIPOS.map(tipo => (
            <div key={tipo} className="p-3 rounded text-center" style={{ background: CP_BG }}>
              <p style={{ fontFamily: FONT_HEAD, fontSize: 22, color: CP_COLOR }}>{porTipo[tipo]}</p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{tipo}</p>
            </div>
          ))}
        </div>

        <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 10 }}>Salones vendidos por mes</p>
        <div className="flex flex-col gap-2">
          {SALONES_FIJOS.map(s => (
            <div key={s}>
              <div className="flex justify-between mb-1" style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK }}>
                <span>{s}</span>
                <span style={{ color: MUTED }}>{salonesVendidos[s]} vendidos</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: LINE }}>
                <div style={{ height: 8, borderRadius: 4, width: `${(salonesVendidos[s] / maxSalon) * 100}%`, background: ACCENT }} />
              </div>
            </div>
          ))}
          {!delMes.length && <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED }}>Sin eventos cargados este mes.</p>}
        </div>
      </div>

      <BuscadorPorEmpresa events={events} />
    </div>
  );
}

/* ============================================================
   BUSCADOR POR EMPRESA — para cuando la misma empresa contrata
   dos o más eventos: los agrupa y suma un total consolidado
   (con IVA, neto discriminado, pagado y saldo).
   ============================================================ */
export function BuscadorPorEmpresa({ events }) {
  const [busqueda, setBusqueda] = useState("");
  const q = busqueda.trim().toLowerCase();

  const coincidencias = useMemo(() => {
    if (!q) return [];
    return events
      .filter(e => [e.empresaOrganiza, e.empresaContrata, e.empresaPaga].some(v => (v || "").toLowerCase().includes(q)))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [events, q]);

  const consolidado = useMemo(() => {
    return coincidencias.reduce((acc, e) => {
      const { sinIva, iva, totalConIva } = totalItemsEvento(e);
      const pagado = (e.estadoPago === "pagado" || e.estadoPago === "total") ? totalConIva : (e.estadoPago === "parcial" || e.estadoPago === "sena") ? (Number(e.adelanto) || 0) : 0;
      return {
        sinIva: acc.sinIva + sinIva,
        iva: acc.iva + iva,
        totalConIva: acc.totalConIva + totalConIva,
        pagado: acc.pagado + pagado,
      };
    }, { sinIva: 0, iva: 0, totalConIva: 0, pagado: 0 });
  }, [coincidencias]);

  return (
    <div className="p-6 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
      <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 10 }}>
        Buscar eventos por empresa (útil cuando una misma empresa contrató varios eventos)
      </p>
      <input
        style={inputStyle}
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="Escribí el nombre de la empresa (organiza, contrata o paga)..."
      />

      {q && !coincidencias.length && (
        <p className="mt-3" style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED }}>No hay eventos que coincidan con "{busqueda}".</p>
      )}

      {coincidencias.length > 0 && (
        <>
          <div className="flex flex-col gap-2 mt-3 mb-4">
            {coincidencias.map(e => {
              const { totalConIva } = totalItemsEvento(e);
              return (
                <div key={e.id} className="p-2.5 rounded flex items-center justify-between" style={{ background: HILITE_BG }}>
                  <div>
                    <div style={{ fontFamily: FONT_BODY, fontWeight: 600, color: INK, fontSize: 13.5 }}>{fmtRangoFecha(e)} — {e.nombreEvento || e.salon || "Sin nombre"}</div>
                    <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED }}>{e.salon} · {e.tarifaTipo === "completa" ? "Tarifa completa" : "Media tarifa"}</div>
                  </div>
                  <div className="text-right">
                    <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: INK, fontWeight: 600 }}>$ {fmtMoney(totalConIva)}</div>
                    <Stamp estadoPago={e.estadoPago} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 rounded" style={{ background: PARCIAL_BG, border: `1px solid ${PARCIAL}` }}>
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: PARCIAL, marginBottom: 8, fontWeight: 600 }}>
              Consolidado de {coincidencias.length} evento{coincidencias.length === 1 ? "" : "s"} — "{busqueda}"
            </p>
            <p style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: INK }}>Total sin IVA (discriminado): $ {fmtMoney(consolidado.sinIva)}</p>
            <p style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: INK }}>IVA (21%, discriminado): $ {fmtMoney(consolidado.iva)}</p>
            <p style={{ fontFamily: FONT_MONO, fontSize: 14, color: PARCIAL, fontWeight: 700 }}>Total consolidado (con IVA): $ {fmtMoney(consolidado.totalConIva)}</p>
            <div style={{ height: 1, background: PARCIAL, opacity: 0.3, margin: "8px 0" }} />
            <p style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: INK }}>Pagado en total: $ {fmtMoney(consolidado.pagado)}</p>
            <p style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: INK, fontWeight: 700 }}>Falta facturar/cobrar: $ {fmtMoney((consolidado.totalConIva - consolidado.pagado))}</p>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   BUSCADOR GENERAL — por nombre de evento, salón o fecha.
   ============================================================ */
export function BuscadorEventos({ events, onOpenEvent }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const resultados = useMemo(() => {
    if (!query) return [];
    return events
      .filter(e => {
        const campos = [e.nombreEvento, e.salon, e.servicio, e.fecha, e.fechaFin]
          .filter(Boolean)
          .map(v => String(v).toLowerCase());
        return campos.some(c => c.includes(query));
      })
      .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  }, [events, query]);

  return (
    <div className="p-6 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
      <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 10 }}>
        Buscar evento por nombre, salón o fecha (AAAA-MM-DD)
      </p>
      <input
        style={inputStyle}
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Ej: Cumpleaños Sofía, Salón Roble, 2026-08-15..."
      />

      {query && !resultados.length && (
        <p className="mt-3" style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED }}>No se encontraron eventos que coincidan con "{q}".</p>
      )}

      {resultados.length > 0 && (
        <div className="flex flex-col gap-2 mt-3">
          {resultados.map(e => (
            <button key={e.id} onClick={() => onOpenEvent(e)} className="p-2.5 rounded flex items-center justify-between text-left w-full" style={{ background: HILITE_BG }}>
              <div>
                <div style={{ fontFamily: FONT_BODY, fontWeight: 600, color: INK, fontSize: 13.5 }}>{e.nombreEvento || e.salon || "Sin nombre"}</div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED }}>{fmtRangoFecha(e)} · {e.salon || "Sin salón"}</div>
              </div>
              <Stamp estadoPago={e.estadoPago} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

