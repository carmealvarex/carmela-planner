import React, { useRef, useState } from "react";
import { ACCENT, CARD, FONT_BODY, FONT_HEAD, FONT_MONO, HILITE_BG, INK, INK_SOFT, LINE, MUTED, PAPER, SALONES_FIJOS } from "../constants.js";
import { fmtMoney, slugArchivo, toISO, uid } from "../utils/helpers.js";
import { Field, LogoCA, LogoHotel, inputStyle } from "./common.jsx";

/* ============================================================
   Modelo de datos + cálculo del presupuesto (independiente de
   los eventos ya confirmados: esto es para mandarle un presupuesto
   a un cliente que todavía no reservó nada).
   ============================================================ */
// Versión resumida para el presupuesto (la versión completa se muestra en el
// Voucher una vez que el evento está confirmado — ver Ajustes → Condiciones
// de contratación).
const CONDICIONES_DEFAULT = `Seña del 50% para confirmar la reserva (no reembolsable ante cancelación).
Saldo restante: 48hs antes del evento, sin excepción.
Número de invitados a confirmar 48hs antes; se factura como mínimo garantizado.
No se aceptan cheques ni financiación.
Condiciones completas disponibles al momento de confirmar la reserva.`;

export function blankPresupuesto() {
  return {
    id: uid(),
    fecha: toISO(new Date()), // fecha en la que se hace el presupuesto
    cliente: "",
    fechaEvento: "", lugar: "", invitados: "", formato: "", horario: "",
    incluirLogoHotel: true,
    incluirFirmas: true, // si este presupuesto también sirve como aceptación/contrato firmado
    precioConIva: true, // true: los valores cargados ya incluyen IVA · false: son valores netos, +IVA aparte
    secciones: [{ id: uid(), titulo: "", cuerpo: "" }],
    items: [],
    condiciones: CONDICIONES_DEFAULT,
  };
}

export function totalPresupuesto(p) {
  const items = p.items || [];
  const total = items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.valorUnitario) || 0), 0);
  if (p.precioConIva) {
    const sinIva = total / 1.21;
    return { sinIva, iva: total - sinIva, totalConIva: total };
  }
  const iva = total * 0.21;
  return { sinIva: total, iva, totalConIva: total + iva };
}

/* ============================================================
   LISTA DE PRESUPUESTOS
   ============================================================ */
export function ListaPresupuestos({ presupuestos, onNuevo, onAbrir, onEditar, onEliminar }) {
  const ordenados = (presupuestos || []).slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 style={{ fontFamily: FONT_HEAD, fontSize: 20, color: INK }}>Presupuestos</h3>
        <button onClick={onNuevo} className="px-4 py-2 rounded text-sm font-medium" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}>+ Nuevo presupuesto</button>
      </div>
      {ordenados.length === 0 ? (
        <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: MUTED }}>Todavía no armaste ningún presupuesto. Tocá "+ Nuevo presupuesto" para crear el primero.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {ordenados.map(p => {
            const { totalConIva } = totalPresupuesto(p);
            return (
              <div key={p.id} className="p-3 rounded flex items-center justify-between gap-3" style={{ background: CARD, border: `1px solid ${LINE}` }}>
                <button onClick={() => onAbrir(p)} className="text-left flex-1" style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <div style={{ fontFamily: FONT_BODY, fontWeight: 600, color: INK, fontSize: 14 }}>{p.cliente || "Sin cliente"}</div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED }}>
                    Presupuesto del {p.fecha} · Evento: {p.fechaEvento || "sin fecha"} {p.lugar ? `· ${p.lugar}` : ""} · $ {fmtMoney(totalConIva)}
                  </div>
                </button>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => onEditar(p)} className="text-xs px-2.5 py-1.5 rounded" style={{ border: `1px solid ${LINE}`, color: INK, fontFamily: FONT_BODY }}>Editar</button>
                  <button onClick={() => onEliminar(p.id)} className="text-xs px-2.5 py-1.5 rounded" style={{ border: `1px solid ${LINE}`, color: MUTED, fontFamily: FONT_BODY }}>Eliminar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   FORMULARIO — armar / editar un presupuesto
   ============================================================ */
export function PresupuestoForm({ initial, onSave, onCancel }) {
  const [p, setP] = useState(() => ({ ...blankPresupuesto(), ...(initial || {}) }));
  const set = (k, v) => setP(prev => ({ ...prev, [k]: v }));

  const setSeccion = (idx, campo, valor) => setP(prev => ({ ...prev, secciones: prev.secciones.map((s, i) => i === idx ? { ...s, [campo]: valor } : s) }));
  const agregarSeccion = () => setP(prev => ({ ...prev, secciones: [...prev.secciones, { id: uid(), titulo: "", cuerpo: "" }] }));
  const quitarSeccion = (idx) => setP(prev => ({ ...prev, secciones: prev.secciones.filter((_, i) => i !== idx) }));

  const [nuevoItem, setNuevoItem] = useState({ detalle: "", cantidad: "", valorUnitario: "" });
  const agregarItem = () => {
    if (!nuevoItem.detalle.trim() || !nuevoItem.cantidad || !nuevoItem.valorUnitario) return;
    setP(prev => ({ ...prev, items: [...prev.items, { id: uid(), ...nuevoItem }] }));
    setNuevoItem({ detalle: "", cantidad: "", valorUnitario: "" });
  };
  const quitarItem = (id) => setP(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));

  const { sinIva, iva, totalConIva } = totalPresupuesto(p);

  return (
    <div className="p-5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
      <h3 style={{ fontFamily: FONT_HEAD, fontSize: 20, color: INK, marginBottom: 16 }}>{initial ? "Editar presupuesto" : "Nuevo presupuesto"}</h3>

      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Fecha del presupuesto"><input type="date" style={{ ...inputStyle, colorScheme: "light" }} value={p.fecha} onChange={e => set("fecha", e.target.value)} /></Field>
        <Field label="Cliente / empresa (At. ...)"><input style={inputStyle} value={p.cliente} onChange={e => set("cliente", e.target.value)} placeholder="Ej: AAPA LATAM" /></Field>
        <Field label="Fecha del evento (texto libre)"><input style={inputStyle} value={p.fechaEvento} onChange={e => set("fechaEvento", e.target.value)} placeholder="Ej: Martes 5 de Mayo 2026" /></Field>
        <Field label="Lugar">
          <select style={inputStyle} value={SALONES_FIJOS.includes(p.lugar) ? p.lugar : (p.lugar ? "Otro" : "")} onChange={e => set("lugar", e.target.value === "Otro" ? "" : e.target.value)}>
            <option value="">Elegir salón…</option>
            {SALONES_FIJOS.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="Otro">Otro / a confirmar…</option>
          </select>
          {!SALONES_FIJOS.includes(p.lugar) && <input style={{ ...inputStyle, marginTop: 8 }} value={p.lugar} onChange={e => set("lugar", e.target.value)} placeholder="Ej: Salón Argos" />}
        </Field>
        <Field label="Invitados"><input style={inputStyle} value={p.invitados} onChange={e => set("invitados", e.target.value)} placeholder="Ej: 40 pax" /></Field>
        <Field label="Formato"><input style={inputStyle} value={p.formato} onChange={e => set("formato", e.target.value)} placeholder="Ej: Cóctel, cena, coffee break" /></Field>
        <Field label="Horario (opcional)"><input style={inputStyle} value={p.horario} onChange={e => set("horario", e.target.value)} placeholder="Ej: 21:00 hs a 01:00 hs" /></Field>
      </div>

      <Field label="Logo">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={!!p.incluirLogoHotel} onChange={e => set("incluirLogoHotel", e.target.checked)} />
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK }}>Incluir también el logo de Hotel Argos (tu logo de Carmela Álvarez siempre va)</span>
        </label>
      </Field>

      <Field label="Firmas">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={p.incluirFirmas !== false} onChange={e => set("incluirFirmas", e.target.checked)} />
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK }}>Incluir espacio de firma de ambas partes (destildá si es solo un presupuesto informativo, sin valor de contrato todavía)</span>
        </label>
      </Field>

      <div className="p-3 rounded mb-4" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 10 }}>
          Detalle del presupuesto (secciones libres — ej: "Finger food", "Servicio de coffee break", "Ambientación")
        </p>
        <div className="flex flex-col gap-3 mb-3">
          {p.secciones.map((s, idx) => (
            <div key={s.id} className="p-2.5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
              <div className="flex items-center gap-2 mb-2">
                <input style={{ ...inputStyle, fontWeight: 700 }} value={s.titulo} onChange={e => setSeccion(idx, "titulo", e.target.value)} placeholder="Título de la sección (ej: FINGER FOOD)" />
                {p.secciones.length > 1 && <button type="button" onClick={() => quitarSeccion(idx)} style={{ color: MUTED, fontSize: 11, whiteSpace: "nowrap", fontFamily: FONT_BODY }}>Quitar</button>}
              </div>
              <textarea rows={5} style={{ ...inputStyle, resize: "vertical" }} value={s.cuerpo} onChange={e => setSeccion(idx, "cuerpo", e.target.value)}
                placeholder={"Ej:\n- Estación de fiambres, quesos, hummus, panificados caseros\n- Variedad de mini bruschettitas\n- Islas de chaffing dish"} />
            </div>
          ))}
        </div>
        <button type="button" onClick={agregarSeccion} className="px-3 py-2 rounded text-sm" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}>+ Agregar sección</button>
      </div>

      <div className="p-3 rounded mb-4" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 10 }}>Cotización</p>
        <label className="flex items-center gap-1.5 mb-3">
          <input type="checkbox" checked={!!p.precioConIva} onChange={e => set("precioConIva", e.target.checked)} />
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK }}>Los valores cargados abajo ya incluyen IVA (si lo destildás, se toman como valores netos y se suma el IVA aparte)</span>
        </label>
        {p.items.length > 0 && (
          <table className="w-full mb-3" style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: INK, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                <th className="text-left py-1">Detalle</th>
                <th className="text-right py-1">Cant.</th>
                <th className="text-right py-1">Valor uni.</th>
                <th className="text-right py-1">Valor total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {p.items.map(it => (
                <tr key={it.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                  <td className="py-1">{it.detalle}</td>
                  <td className="text-right py-1">{it.cantidad}</td>
                  <td className="text-right py-1">$ {fmtMoney(Number(it.valorUnitario))}</td>
                  <td className="text-right py-1">$ {fmtMoney(Number(it.cantidad) * Number(it.valorUnitario))}</td>
                  <td className="text-right py-1"><button type="button" onClick={() => quitarItem(it.id)} style={{ color: MUTED, fontSize: 11 }}>Quitar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="grid grid-cols-4 gap-2 items-end mb-3">
          <Field label="Detalle"><input style={inputStyle} value={nuevoItem.detalle} onChange={e => setNuevoItem(v => ({ ...v, detalle: e.target.value }))} placeholder="Ej: Finger food" /></Field>
          <Field label="Cantidad"><input type="number" style={inputStyle} value={nuevoItem.cantidad} onChange={e => setNuevoItem(v => ({ ...v, cantidad: e.target.value }))} placeholder="Ej: 40" /></Field>
          <Field label="Valor unitario"><input type="number" style={inputStyle} value={nuevoItem.valorUnitario} onChange={e => setNuevoItem(v => ({ ...v, valorUnitario: e.target.value }))} placeholder="Ej: 42000" /></Field>
          <button type="button" onClick={agregarItem} className="px-3 py-2 rounded text-sm mb-4" style={{ background: INK_SOFT, color: PAPER }}>+ Agregar ítem</button>
        </div>
        <div className="p-2.5 rounded" style={{ background: CARD, border: `1px solid ${LINE}`, fontFamily: FONT_MONO, fontSize: 12.5, color: INK }}>
          <div className="flex justify-between"><span>Subtotal (sin IVA)</span><span>$ {fmtMoney(sinIva)}</span></div>
          <div className="flex justify-between"><span>IVA (21%)</span><span>$ {fmtMoney(iva)}</span></div>
          <div className="flex justify-between" style={{ fontWeight: 700, fontSize: 14 }}><span>TOTAL</span><span>$ {fmtMoney(totalConIva)}</span></div>
        </div>
      </div>

      <Field label="Condiciones de contratación">
        <textarea rows={8} style={{ ...inputStyle, resize: "vertical" }} value={p.condiciones} onChange={e => set("condiciones", e.target.value)} />
      </Field>

      <div className="flex gap-2 mt-2 flex-wrap">
        <button onClick={() => onSave(p)} className="px-4 py-2 rounded text-sm font-medium" style={{ background: ACCENT, color: "#fff", fontFamily: FONT_BODY }}>Guardar presupuesto</button>
        <button onClick={onCancel} className="px-4 py-2 rounded text-sm font-medium" style={{ border: `1px solid ${LINE}`, color: INK, fontFamily: FONT_BODY }}>Cancelar</button>
      </div>
    </div>
  );
}

/* ============================================================
   DOCUMENTO — versión imprimible/descargable, con el mismo
   formato de las cotizaciones de Hotel Argos que ya usás.
   ============================================================ */
export function PresupuestoDocumento({ p, onBack, onEdit }) {
  const { sinIva, iva, totalConIva } = totalPresupuesto(p);
  const ref = useRef(null);
  const [generandoImagen, setGenerandoImagen] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  const nombreArchivo = () => `PRESUPUESTO_${slugArchivo(p.cliente || "Cliente")}_${p.fecha}`;

  const descargarImagen = async () => {
    if (!ref.current) return;
    setGenerandoImagen(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const link = document.createElement("a");
      link.download = `${nombreArchivo()}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.92);
      link.click();
    } catch (err) {
      alert("No se pudo generar la imagen. Verificá que el paquete 'html2canvas' esté instalado.");
      console.error(err);
    } finally {
      setGenerandoImagen(false);
    }
  };

  const descargarPDF = async () => {
    if (!ref.current) return;
    setGenerandoPDF(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });

      // Hoja A4 estándar, igual que en la ficha/voucher/vale/comanda. Si el
      // presupuesto es largo (muchos ítems o secciones), se reparte solo en
      // las páginas que hagan falta.
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const margenMM = 12;
      const anchoUtilMM = pdf.internal.pageSize.getWidth() - margenMM * 2;
      const altoUtilMM = pdf.internal.pageSize.getHeight() - margenMM * 2;
      const pxPorMM = canvas.width / anchoUtilMM;
      const altoPaginaPx = Math.floor(altoUtilMM * pxPorMM);

      let renderedPx = 0;
      let primeraPagina = true;
      while (renderedPx < canvas.height) {
        const alturaSlicePx = Math.min(altoPaginaPx, canvas.height - renderedPx);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = alturaSlicePx;
        const ctx = sliceCanvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, renderedPx, canvas.width, alturaSlicePx, 0, 0, canvas.width, alturaSlicePx);
        const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.95);
        const alturaSliceMM = alturaSlicePx / pxPorMM;

        if (!primeraPagina) pdf.addPage();
        pdf.addImage(sliceData, "JPEG", margenMM, margenMM, anchoUtilMM, alturaSliceMM);

        renderedPx += alturaSlicePx;
        primeraPagina = false;
      }

      pdf.save(`${nombreArchivo()}.pdf`);
    } catch (err) {
      alert("No se pudo generar el PDF. Verificá que el paquete 'jspdf' esté instalado.");
      console.error(err);
    } finally {
      setGenerandoPDF(false);
    }
  };

  const fechaFmt = (() => {
    try {
      const [y, m, d] = p.fecha.split("-");
      return `${d}/${m}/${y}`;
    } catch { return p.fecha; }
  })();

  return (
    <div>
      <div className="no-print flex gap-2 mb-4 flex-wrap">
        <button onClick={() => window.print()} className="px-4 py-2 rounded text-sm font-medium" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}>Imprimir / Guardar PDF</button>
        <button onClick={descargarImagen} disabled={generandoImagen} className="px-4 py-2 rounded text-sm font-medium" style={{ background: ACCENT, color: "#fff", fontFamily: FONT_BODY, opacity: generandoImagen ? 0.7 : 1 }}>
          {generandoImagen ? "Generando…" : "Descargar como imagen (para mail)"}
        </button>
        <button onClick={descargarPDF} disabled={generandoPDF} className="px-4 py-2 rounded text-sm font-medium" style={{ border: `1px solid ${ACCENT}`, color: ACCENT, fontFamily: FONT_BODY, opacity: generandoPDF ? 0.7 : 1 }}>
          {generandoPDF ? "Generando…" : "Descargar como PDF"}
        </button>
        {onEdit && <button onClick={onEdit} className="px-4 py-2 rounded text-sm font-medium" style={{ border: `1px solid ${LINE}`, color: INK, fontFamily: FONT_BODY }}>Editar</button>}
        <button onClick={onBack} className="px-4 py-2 rounded text-sm font-medium" style={{ border: `1px solid ${LINE}`, color: INK, fontFamily: FONT_BODY }}>Volver</button>
      </div>

      <div ref={ref} className="p-8" style={{ background: "#fff", border: `1px solid ${INK}`, maxWidth: 680, margin: "0 auto" }}>
        <div className="flex justify-between items-center mb-6">
          <LogoCA size={54} />
          {p.incluirLogoHotel && <LogoHotel width={130} />}
        </div>

        <div className="flex justify-between items-start mb-4" style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: INK, fontWeight: 700 }}>
          <span>At. {p.cliente || "-"}</span>
          <span>{fechaFmt}</span>
        </div>

        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, fontWeight: 700, textDecoration: "underline", marginBottom: 6 }}>Características del Evento:</p>
        <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, fontWeight: 600, marginBottom: 16, lineHeight: 1.7 }}>
          {p.fechaEvento && <p>Fecha: {p.fechaEvento}</p>}
          {p.lugar && <p>Lugar: {p.lugar}</p>}
          {p.invitados && <p>Invitados: {p.invitados}</p>}
          {p.formato && <p>Formato: {p.formato}</p>}
          {p.horario && <p>Horario: {p.horario}</p>}
        </div>

        <p style={{ fontFamily: FONT_HEAD, fontSize: 16, color: INK, fontWeight: 700, textAlign: "center", marginBottom: 16 }}>PRESUPUESTO</p>

        {p.secciones.filter(s => s.titulo || s.cuerpo).map(s => (
          <div key={s.id} className="mb-4">
            {s.titulo && <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, fontWeight: 700, textAlign: "center", marginBottom: 6 }}>{s.titulo.toUpperCase()}</p>}
            {s.cuerpo && <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, whiteSpace: "pre-wrap" }}>{s.cuerpo}</p>}
          </div>
        ))}

        {p.items.length > 0 && (
          <div className="mb-4">
            <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>COTIZACIÓN</p>
            <table className="w-full" style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, borderCollapse: "collapse", border: `1px solid ${INK}` }}>
              <thead>
                <tr style={{ background: HILITE_BG }}>
                  <th className="text-left p-2" style={{ border: `1px solid ${LINE}` }} colSpan={1}>{`COTIZACIÓN EVENTO ${p.cliente || ""}`.trim()}</th>
                  <th className="text-center p-2" style={{ border: `1px solid ${LINE}` }}>Cant.</th>
                  <th className="text-right p-2" style={{ border: `1px solid ${LINE}` }}>Valor uni.</th>
                  <th className="text-right p-2" style={{ border: `1px solid ${LINE}` }}>Valor total</th>
                </tr>
              </thead>
              <tbody>
                {p.items.map(it => (
                  <tr key={it.id}>
                    <td className="p-2" style={{ border: `1px solid ${LINE}` }}>{it.detalle}</td>
                    <td className="text-center p-2" style={{ border: `1px solid ${LINE}` }}>{it.cantidad}</td>
                    <td className="text-right p-2" style={{ border: `1px solid ${LINE}` }}>$ {fmtMoney(Number(it.valorUnitario))}</td>
                    <td className="text-right p-2" style={{ border: `1px solid ${LINE}` }}>$ {fmtMoney(Number(it.cantidad) * Number(it.valorUnitario))}</td>
                  </tr>
                ))}
                <tr style={{ background: HILITE_BG, fontWeight: 700 }}>
                  <td className="p-2" colSpan={3} style={{ border: `1px solid ${LINE}` }}>TOTAL{p.precioConIva ? " (IVA incluido)" : " + IVA"}</td>
                  <td className="text-right p-2" style={{ border: `1px solid ${LINE}` }}>$ {fmtMoney(totalConIva)}</td>
                </tr>
              </tbody>
            </table>
            {!p.precioConIva && (
              <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: MUTED, marginTop: 4 }}>Subtotal sin IVA: $ {fmtMoney(sinIva)} · IVA (21%): $ {fmtMoney(iva)}</p>
            )}
          </div>
        )}

        {p.condiciones && (
          <div className="mb-4">
            <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>CONDICIONES DE CONTRATACIÓN</p>
            <ul style={{ fontFamily: FONT_BODY, fontSize: 12, color: INK, paddingLeft: 18, listStyle: "disc" }}>
              {p.condiciones.split("\n").filter(Boolean).map((linea, i) => <li key={i} style={{ marginBottom: 4 }}>{linea}</li>)}
            </ul>
          </div>
        )}

        <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontStyle: "italic", color: INK, marginTop: 24 }}>Quedo a disposición, saludos cordiales.<br />Carmela Alvarez</p>

        {/* Firmas de ambas partes — para cuando este mismo presupuesto se usa
            como aceptación/contrato firmado, no solo como cotización informativa. */}
        {p.incluirFirmas !== false && (
          <div className="flex justify-between items-end gap-8" style={{ marginTop: 56 }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 6 }}>
                <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: INK }}>Firma y aclaración — Cliente</p>
                <p style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: MUTED, marginTop: 2 }}>Aclaración: ____________________________ &nbsp; DNI: ______________</p>
              </div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 6 }}>
                <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: INK }}>Firma y aclaración — Hotel Argos</p>
                <p style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: MUTED, marginTop: 2 }}>Carmela Álvarez</p>
              </div>
            </div>
          </div>
        )}

        {p.incluirLogoHotel && (
          <div className="text-center mt-8 pt-4" style={{ borderTop: `1px solid ${LINE}`, fontFamily: FONT_BODY, fontSize: 10.5, color: MUTED }}>
            <p>Departamento de Alimentos &amp; Bebidas</p>
            <p>+54 291 455- 0404 int.507</p>
            <p>España 149 / (8000) - Bahía Blanca · salasybanquetes@hotelargos.com · www.hotelargos.com</p>
          </div>
        )}
      </div>
    </div>
  );
}
