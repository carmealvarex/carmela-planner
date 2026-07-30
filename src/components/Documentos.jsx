import React, { useRef, useState } from "react";
import { ACCENT, CARD, CP_BG, CP_COLOR, FONT_BODY, FONT_HEAD, FONT_MONO, HILITE_BG, INK, INK_SOFT, LINE, MUTED, PAGADO, PAGADO_BG, PAPER, PARCIAL, PARCIAL_BG } from "../constants.js";
import { esMultiDia, fechasEvento, fmtFechaCorta, fmtMoney, fmtRangoFecha, slugArchivo } from "../utils/helpers.js";
import { checklistTexto } from "../utils/texto.js";
import { totalItemsEvento } from "../utils/eventHelpers.js";
import { PrintHeader, Stamp } from "./common.jsx";

export function Voucher({ ev, onBack }) {
  const { filas: items, sinIva, iva, totalConIva } = totalItemsEvento(ev);
  const pagado = ev.estadoPago === "total" ? totalConIva : (ev.estadoPago === "parcial" || ev.estadoPago === "sena") ? (Number(ev.adelanto) || 0) : 0;
  const saldo = totalConIva - pagado;
  const voucherRef = useRef(null);
  const [generandoImagen, setGenerandoImagen] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  const nombreVoucher = () => {
    const num = ev.numeracion?.voucher || "0000";
    const empresa = slugArchivo(ev.empresaOrganiza || ev.empresaContrata || ev.nombreEvento || "Cliente");
    const fecha = fmtFechaCorta(ev.fecha);
    return `VOUCHER_${num}_${empresa}_${fecha}`;
  };

  const descargarImagen = async () => {
    if (!voucherRef.current) return;
    setGenerandoImagen(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(voucherRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const link = document.createElement("a");
      link.download = `${nombreVoucher()}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.92);
      link.click();
    } catch (err) {
      alert("No se pudo generar la imagen. Verificá que el paquete 'html2canvas' esté instalado (npm install html2canvas).");
      console.error(err);
    } finally {
      setGenerandoImagen(false);
    }
  };

  const descargarPDF = async () => {
    if (!voucherRef.current) return;
    setGenerandoPDF(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(voucherRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: canvas.width >= canvas.height ? "landscape" : "portrait", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${nombreVoucher()}.pdf`);
    } catch (err) {
      alert("No se pudo generar el PDF. Verificá que el paquete 'jspdf' esté instalado (npm install jspdf).");
      console.error(err);
    } finally {
      setGenerandoPDF(false);
    }
  };

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
        <button onClick={onBack} className="px-4 py-2 rounded text-sm font-medium" style={{ border: `1px solid ${LINE}`, color: INK, fontFamily: FONT_BODY }}>Volver</button>
      </div>
      <div ref={voucherRef} className="p-8" style={{ background: CARD, border: `1px solid ${INK}`, maxWidth: 640, margin: "0 auto" }}>
        <PrintHeader eyebrow="Orden de evento" titulo={ev.nombreEvento || ev.salon || "Salón a confirmar"} />
        <div className="flex justify-end -mt-2 mb-3"><Stamp estadoPago={ev.estadoPago} /></div>
        <div className="grid grid-cols-2 gap-y-2 gap-x-6 mb-4" style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: INK }}>
          <p><b>Salón:</b> {ev.salon || "-"}{ev.salonAdicional ? ` + ${ev.salonAdicional}` : ""}</p>
          <p><b>Fecha:</b> {fmtRangoFecha(ev)}</p>
          <p><b>Horario:</b> {ev.horaInicio} a {ev.horaFin}</p>
          <p><b>Personas:</b> {ev.personas || "-"}</p>
          <p><b>Concepto:</b> {ev.servicio || "-"}</p>
          <p><b>Tarifa:</b> {ev.tarifaTipo === "completa" ? "Completa" : "Media tarifa"}{esMultiDia(ev) ? ` (${fechasEvento(ev).length} días)` : ""}</p>
        </div>
        {checklistTexto(ev) && <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: MUTED, marginBottom: 10 }}>{checklistTexto(ev)}</p>}
        {(ev.empresaOrganiza || ev.empresaContrata || ev.empresaPaga || ev.esHuesped) && (
          <div className="p-3 mb-4" style={{ background: HILITE_BG, fontFamily: FONT_BODY, fontSize: 13.5, color: INK }}>
            {ev.empresaOrganiza && <p><b>Organiza:</b> {ev.empresaOrganiza}</p>}
            {ev.empresaContrata && <p><b>Contrata:</b> {ev.empresaContrata}</p>}
            {ev.empresaPaga && <p><b>Paga:</b> {ev.empresaPaga}</p>}
            {ev.esHuesped && <p><b>Hospedaje:</b> Huésped del hotel{ev.huespedes?.length ? ` — ${ev.huespedes.join(", ")}` : ""}</p>}
          </div>
        )}

        {(ev.cuit || ev.razonSocial || ev.direccionFiscal || ev.tipoFactura || ev.condicionIva) && (
          <div className="p-3 mb-4" style={{ background: HILITE_BG, fontFamily: FONT_BODY, fontSize: 13.5, color: INK }}>
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: INK, marginBottom: 6, fontWeight: 600 }}>Datos de facturación</p>
            {ev.razonSocial && <p><b>Razón social:</b> {ev.razonSocial}</p>}
            {ev.cuit && <p><b>CUIT:</b> {ev.cuit}</p>}
            {ev.direccionFiscal && <p><b>Dirección fiscal:</b> {ev.direccionFiscal}</p>}
            {ev.tipoFactura && <p><b>Tipo de factura:</b> {ev.tipoFactura}</p>}
            {ev.condicionIva && <p><b>Condición frente al IVA:</b> {ev.condicionIva}</p>}
          </div>
        )}

        {items.length > 0 && (
          <div className="mb-4">
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: INK, marginBottom: 6, fontWeight: 600 }}>Servicios contratados</p>
            <table className="w-full" style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, borderCollapse: "collapse", border: `1px solid ${INK}` }}>
              <thead>
                <tr style={{ background: HILITE_BG }}>
                  <th className="text-left p-2" style={{ border: `1px solid ${LINE}` }}>Detalle</th>
                  <th className="text-center p-2" style={{ border: `1px solid ${LINE}` }}>Cant.</th>
                  <th className="text-right p-2" style={{ border: `1px solid ${LINE}` }}>Valor uni.</th>
                  <th className="text-right p-2" style={{ border: `1px solid ${LINE}` }}>Valor total</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.id}>
                    <td className="p-2" style={{ border: `1px solid ${LINE}` }}>{it.detalle}</td>
                    <td className="text-center p-2" style={{ border: `1px solid ${LINE}` }}>{it.cantidad}</td>
                    <td className="text-right p-2" style={{ border: `1px solid ${LINE}` }}>$ {fmtMoney(Number(it.valorUnitario))}</td>
                    <td className="text-right p-2" style={{ border: `1px solid ${LINE}` }}>$ {fmtMoney((Number(it.cantidad) * Number(it.valorUnitario)))}</td>
                  </tr>
                ))}
                <tr style={{ background: HILITE_BG, fontWeight: 700 }}>
                  <td className="p-2" colSpan={3} style={{ border: `1px solid ${LINE}` }}>TOTAL (IVA incluido)</td>
                  <td className="text-right p-2" style={{ border: `1px solid ${LINE}` }}>$ {fmtMoney(totalConIva)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="p-3 mb-4 rounded" style={{ background: PARCIAL_BG, border: `1px solid ${PARCIAL}`, fontFamily: FONT_BODY, fontSize: 13.5, color: INK }}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: PARCIAL, marginBottom: 8, fontWeight: 600 }}>Resumen de pago</p>
          <p><b>Valor sin IVA:</b> $ {fmtMoney(sinIva)}</p>
          <p><b>IVA (21%):</b> $ {fmtMoney(iva)}</p>
          <p style={{ fontWeight: 700 }}><b>Total del evento (con IVA):</b> $ {fmtMoney(totalConIva)}</p>
          <div style={{ height: 1, background: PARCIAL, opacity: 0.3, margin: "8px 0" }} />
          <p><b>Pagado:</b> $ {fmtMoney(pagado)}</p>
          <p><b>Saldo pendiente:</b> $ {fmtMoney(saldo)}</p>
        </div>

        <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: MUTED }}>Este comprobante confirma la reserva de la fecha con todo lo contratado. Ante cualquier consulta, comunicate con el hotel citando el nombre del evento y la fecha.</p>
        <p className="mt-6" style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: MUTED }}>Generado el {new Date().toLocaleDateString("es-AR")}</p>
      </div>
    </div>
  );
}

/* ============================================================
   VALE (imprimible) — para eventos con CP
   ============================================================ */
export function Vale({ ev, onBack }) {
  const v = ev.vale || {};
  const tipos = v.tipos || [];
  const totalCubiertos = tipos.reduce((s, t) => s + (Number(t.cantidad) || 0), 0);
  const totalValor = tipos.reduce((s, t) => s + (Number(t.cantidad) || 0) * (Number(t.valorUnitario) || 0), 0);
  const valeRef = useRef(null);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  const nombreVale = () => {
    const num = v.numero || "0000";
    const concepto = slugArchivo(ev.servicio || ev.nombreEvento || "Evento");
    const fecha = fmtFechaCorta(ev.fecha);
    return `VALE_${num}_${concepto}_${fecha}`;
  };

  const descargarPDF = async () => {
    if (!valeRef.current) return;
    setGenerandoPDF(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(valeRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: canvas.width >= canvas.height ? "landscape" : "portrait", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${nombreVale()}.pdf`);
    } catch (err) {
      alert("No se pudo generar el PDF. Verificá que el paquete 'jspdf' esté instalado (npm install jspdf).");
      console.error(err);
    } finally {
      setGenerandoPDF(false);
    }
  };

  return (
    <div>
      <div className="no-print flex gap-2 mb-4 flex-wrap">
        <button onClick={() => window.print()} className="px-4 py-2 rounded text-sm font-medium" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}>Imprimir vale</button>
        <button onClick={descargarPDF} disabled={generandoPDF} className="px-4 py-2 rounded text-sm font-medium" style={{ border: `1px solid ${ACCENT}`, color: ACCENT, fontFamily: FONT_BODY, opacity: generandoPDF ? 0.7 : 1 }}>
          {generandoPDF ? "Generando…" : "Descargar como PDF"}
        </button>
        <button onClick={onBack} className="px-4 py-2 rounded text-sm font-medium" style={{ border: `1px solid ${LINE}`, color: INK, fontFamily: FONT_BODY }}>Volver</button>
      </div>
      <div ref={valeRef} className="p-8" style={{ background: CARD, border: `1px solid ${INK}`, maxWidth: 640, margin: "0 auto" }}>
        <PrintHeader eyebrow="Vale · Control administrativo" titulo={`N° ${v.numero || "-"}`} />
        <div className="grid grid-cols-2 gap-y-2 gap-x-6 mb-4" style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: INK }}>
          <p><b>N° de vale:</b> {v.numero || "-"}</p>
          <p><b>N° de factura:</b> {ev.facturas?.[0]?.numero || "-"}</p>
          <p><b>Fecha del evento:</b> {fmtRangoFecha(ev)}</p>
          <p><b>Salón:</b> {ev.salon || "-"}</p>
          <p><b>Salones vendidos:</b> {v.salonesVendidos || "-"}</p>
          <p><b>Personas:</b> {ev.personas || "-"}</p>
        </div>

        <div className="p-4 mb-4 rounded" style={{ background: CP_BG, border: `1px solid ${CP_COLOR}` }}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: CP_COLOR, marginBottom: 8, fontWeight: 600 }}>Cubiertos vendidos por tipo</p>
          {tipos.length > 0 ? (
            <table className="w-full" style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${CP_COLOR}` }}>
                  <th className="text-left py-1">Tipo</th>
                  <th className="text-right py-1">Cant.</th>
                  <th className="text-right py-1">Valor uni.</th>
                  <th className="text-right py-1">Valor total</th>
                  <th className="text-left py-1">Comentario</th>
                </tr>
              </thead>
              <tbody>
                {tipos.map(t => (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                    <td className="py-1">{t.tipo}</td>
                    <td className="text-right py-1">{t.cantidad}</td>
                    <td className="text-right py-1">$ {fmtMoney(Number(t.valorUnitario))}</td>
                    <td className="text-right py-1">$ {fmtMoney((Number(t.cantidad) * Number(t.valorUnitario)))}</td>
                    <td className="py-1">{t.comentario || "-"}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td className="py-1">TOTAL</td>
                  <td className="text-right py-1">{totalCubiertos}</td>
                  <td></td>
                  <td className="text-right py-1">$ {fmtMoney(totalValor)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          ) : <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED }}>Sin tipos de cubiertos cargados.</p>}
        </div>

        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED }}>Este vale es para uso interno de Administración, para contabilizar salones y cubiertos vendidos y cruzarlos contra la factura (no es un comprobante fiscal).</p>
        <p className="mt-8" style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: MUTED }}>Generado el {new Date().toLocaleDateString("es-AR")}</p>
      </div>
    </div>
  );
}

/* ============================================================
   COMANDA (imprimible) — cantidad de cubiertos vendidos
   ============================================================ */
export function Comanda({ ev, onBack }) {
  const c = ev.comanda || {};
  const cronoOrdenado = (ev.cronograma || []).slice().sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
  const comandaRef = useRef(null);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  const nombreComanda = () => {
    const num = ev.numeracion?.comanda || "0000";
    const fecha = fmtFechaCorta(ev.fecha);
    return `COMANDA_${num}_${fecha}`;
  };

  const descargarPDF = async () => {
    if (!comandaRef.current) return;
    setGenerandoPDF(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(comandaRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: canvas.width >= canvas.height ? "landscape" : "portrait", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${nombreComanda()}.pdf`);
    } catch (err) {
      alert("No se pudo generar el PDF. Verificá que el paquete 'jspdf' esté instalado (npm install jspdf).");
      console.error(err);
    } finally {
      setGenerandoPDF(false);
    }
  };

  return (
    <div>
      <div className="no-print flex gap-2 mb-4 flex-wrap">
        <button onClick={() => window.print()} className="px-4 py-2 rounded text-sm font-medium" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}>Imprimir comanda</button>
        <button onClick={descargarPDF} disabled={generandoPDF} className="px-4 py-2 rounded text-sm font-medium" style={{ border: `1px solid ${ACCENT}`, color: ACCENT, fontFamily: FONT_BODY, opacity: generandoPDF ? 0.7 : 1 }}>
          {generandoPDF ? "Generando…" : "Descargar como PDF"}
        </button>
        <button onClick={onBack} className="px-4 py-2 rounded text-sm font-medium" style={{ border: `1px solid ${LINE}`, color: INK, fontFamily: FONT_BODY }}>Volver</button>
      </div>
      <div ref={comandaRef} className="p-8" style={{ background: CARD, border: `1px solid ${INK}`, maxWidth: 640, margin: "0 auto" }}>
        <PrintHeader eyebrow="Comanda de cocina" titulo={ev.salon || "Salón"} />
        <div className="grid grid-cols-2 gap-y-2 gap-x-6 mb-4" style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: INK }}>
          <p><b>Fecha:</b> {fmtRangoFecha(ev)}</p>
          <p><b>Horario:</b> {ev.horaInicio} a {ev.horaFin}</p>
          <p><b>Personas convocadas:</b> {ev.personas || "-"}</p>
          <p><b>Tipo de evento:</b> {ev.servicio || "-"}</p>
          <p><b>Salón:</b> {ev.salon || "-"}</p>
          <p><b>Catering contratado:</b> {c.caterer || "-"}</p>
        </div>

        <div className="p-4 mb-4 rounded" style={{ background: PAGADO_BG, border: `1px solid ${PAGADO}` }}>
          <p style={{ fontFamily: FONT_HEAD, fontSize: 22, color: PAGADO }}>{c.cubiertos || "-"} cubiertos a preparar</p>
        </div>

        {c.items?.length > 0 && (
          <div className="mb-4">
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: INK, marginBottom: 6, fontWeight: 600 }}>Qué cocinar</p>
            <table className="w-full" style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, borderCollapse: "collapse", border: `1px solid ${INK}` }}>
              <thead>
                <tr style={{ background: HILITE_BG }}>
                  <th className="text-left p-2" style={{ border: `1px solid ${LINE}` }}>Ítem</th>
                  <th className="text-left p-2" style={{ border: `1px solid ${LINE}` }}>Detalle</th>
                  <th className="text-right p-2" style={{ border: `1px solid ${LINE}` }}>Cant.</th>
                </tr>
              </thead>
              <tbody>
                {c.items.map(it => (
                  <tr key={it.id}>
                    <td className="p-2" style={{ border: `1px solid ${LINE}` }}>{it.nombre}</td>
                    <td className="p-2" style={{ border: `1px solid ${LINE}` }}>{it.detalle}</td>
                    <td className="text-right p-2" style={{ border: `1px solid ${LINE}` }}>{it.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {cronoOrdenado.length > 0 && (
          <div className="mb-4">
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: INK, marginBottom: 6, fontWeight: 600 }}>Cronograma</p>
            {cronoOrdenado.map(cr => (
              <p key={cr.id} style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK }}><b>{cr.hora}</b> — {cr.detalle}</p>
            ))}
          </div>
        )}

        {c.detalle && <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: INK, marginBottom: 10 }}><b>Notas para cocina:</b> {c.detalle}</p>}
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED }}>Esta comanda alimenta la estadística mensual de cubiertos para el cálculo del proporcional/premio del hotel.</p>
        <p className="mt-8" style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: MUTED }}>Generado el {new Date().toLocaleDateString("es-AR")}</p>
      </div>
    </div>
  );
}

