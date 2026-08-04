import React, { useRef, useState } from "react";
import { ACCENT, CARD, CP_BG, CP_COLOR, ESTADOS_PAGO, FONT_BODY, FONT_HEAD, FONT_MONO, HILITE_BG, INK, INK_SOFT, LINE, MUTED, PAGADO, PAPER, labelTarifaTipo } from "../constants.js";
import { esMultiDia, fechasEvento, fmtFechaCorta, fmtMoney, fmtRangoFecha, slugArchivo } from "../utils/helpers.js";
import { checklistTexto, textoJefeAreas, waLink } from "../utils/texto.js";
import { totalItemsEvento } from "../utils/eventHelpers.js";
import { PrintHeader, Stamp } from "./common.jsx";

export function FichaCompleta({ ev, jefeAreas, isAdmin, onEdit, onVaucher, onCronograma, onPlano, onVale, onComanda, tienePlantilla, onBack }) {
  const cronoOrdenado = (ev.cronograma || []).slice().sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
  const fichaRef = useRef(null);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  // En eventos de varios días, la comida (Vale/Comanda) está cargada por día dentro de
  // ev.dias; acá se junta todo en una sola lista (con la fecha de cada ítem) para mostrarla.
  const multiDiaFicha = esMultiDia(ev) && (ev.dias || []).length > 0;
  const tiposValeFicha = multiDiaFicha
    ? ev.dias.flatMap(d => (d.valeTipos || []).map(t => ({ ...t, fecha: d.fecha })))
    : (ev.vale?.tipos || []);
  const itemsComandaFicha = multiDiaFicha
    ? ev.dias.flatMap(d => (d.comandaItems || []).map(it => ({ ...it, fecha: d.fecha })))
    : (ev.comanda?.items || []);

  const nombreFicha = () => {
    const num = ev.numeracion?.ficha || "0000";
    const empresa = slugArchivo(ev.empresaOrganiza || ev.empresaContrata || "Cliente");
    const evento = slugArchivo(ev.nombreEvento || ev.salon || "Evento");
    return `FICHA_${num}_${empresa}_${evento}`;
  };

  const descargarPDF = async () => {
    if (!fichaRef.current) return;
    setGenerandoPDF(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(fichaRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: canvas.width >= canvas.height ? "landscape" : "portrait", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${nombreFicha()}.pdf`);
    } catch (err) {
      alert("No se pudo generar el PDF. Verificá que el paquete 'jspdf' esté instalado (npm install jspdf).");
      console.error(err);
    } finally {
      setGenerandoPDF(false);
    }
  };

  return (
    <div className="p-5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
      <div className="no-print flex gap-2 mb-4">
        <button onClick={onBack} className="px-4 py-2 rounded text-sm font-medium" style={{ border: `1px solid ${LINE}`, color: INK, fontFamily: FONT_BODY }}>‹ Volver al resumen</button>
        <button onClick={descargarPDF} disabled={generandoPDF} className="px-4 py-2 rounded text-sm font-medium" style={{ border: `1px solid ${ACCENT}`, color: ACCENT, fontFamily: FONT_BODY, opacity: generandoPDF ? 0.7 : 1 }}>
          {generandoPDF ? "Generando…" : "Descargar ficha como PDF"}
        </button>
      </div>
      <div ref={fichaRef}>
      <PrintHeader eyebrow="Ficha interna completa del evento" titulo={ev.nombreEvento || ev.salon || "Sin nombre"} />
      <div className="flex items-start justify-between mb-3">
        <div>
          {ev.colorEvento && <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: ev.colorEvento, marginRight: 6 }} />}
          <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED }}>{ev.salon || "Sin salón"}{ev.salonAdicional ? ` + ${ev.salonAdicional}` : ""} · {fmtRangoFecha(ev)} · {ev.horaInicio}–{ev.horaFin} · {ev.personas || "?"} personas</p>
        </div>
        <Stamp estadoPago={ev.estadoPago} />
      </div>

      {ev.servicio && <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, marginBottom: 6 }}><b>Concepto:</b> {ev.servicio}</p>}
      {checklistTexto(ev) && <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED, marginBottom: 6 }}>{checklistTexto(ev)}</p>}
      {!esMultiDia(ev) && ev.tarifaTipo && <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, marginBottom: 6 }}><b>Tarifa:</b> {labelTarifaTipo(ev.tarifaTipo)}{ev.tarifaEspecialActiva ? " (tarifa especial aplicada)" : ""}</p>}
      {!esMultiDia(ev) && ev.salonAdicional && <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, marginBottom: 6 }}><b>Salón adicional:</b> {ev.salonAdicional} — {labelTarifaTipo(ev.tarifaTipoAdicional)}{ev.tarifaEspecialActivaAdicional ? " (tarifa especial aplicada)" : ""}</p>}

      {/* ---- Desglose por día: salón, tarifa y comida de cada día del evento ---- */}
      {esMultiDia(ev) && (ev.dias || []).length > 0 && (
        <div className="p-3 rounded mb-4" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 8, fontWeight: 600 }}>Desglose día por día ({ev.dias.length} días)</p>
          <div className="flex flex-col gap-2">
            {ev.dias.map(d => {
              const cubiertosDia = (d.valeTipos || []).reduce((s, t) => s + (Number(t.cantidad) || 0), 0);
              return (
                <div key={d.fecha} className="p-2.5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
                  <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, fontWeight: 700, marginBottom: 3 }}>{d.fecha}{(d.horaInicio || d.horaFin) ? ` · ${d.horaInicio || "?"}–${d.horaFin || "?"}` : ""}</p>
                  <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: INK, marginBottom: 2 }}>
                    <b>Salón:</b> {d.salon || "-"} · <b>Tarifa:</b> {labelTarifaTipo(d.tarifaTipo)}{d.tarifaEspecialActiva ? " (especial)" : ""}
                    {d.salonAdicionalActivo && d.salonAdicional ? ` · + ${d.salonAdicional} (${labelTarifaTipo(d.tarifaTipoAdicional)}${d.tarifaEspecialActivaAdicional ? ", especial" : ""})` : ""}
                  </p>
                  <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: MUTED }}>
                    {(d.valeTipos || []).length > 0
                      ? `Comida: ${d.valeTipos.map(t => `${t.cantidad} × ${t.tipo}`).join(", ")} (${cubiertosDia} cubiertos)`
                      : "Sin comida cargada para este día."}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {(ev.horaArmado || ev.horaDesarme) && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, marginBottom: 6 }}>
          {ev.horaArmado && <><b>Armado:</b> {ev.horaArmado} </>}{ev.horaDesarme && <><b>· Desarme:</b> {ev.horaDesarme}</>}
        </p>
      )}
      {ev.formatoArmado && <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, marginBottom: 6 }}><b>Formato/tipo de armado:</b> {ev.formatoArmado}</p>}
      {ev.tecnica?.length > 0 && <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, marginBottom: 6 }}><b>Técnica:</b> {ev.tecnica.join(", ")}</p>}
      {(() => {
        const partes = [
          ev.empresaOrganiza && { label: "Organiza", value: ev.empresaOrganiza },
          ev.empresaContrata && { label: "Contrata", value: ev.empresaContrata },
          ev.empresaPaga && { label: "Paga", value: ev.empresaPaga },
        ].filter(Boolean);
        if (partes.length === 0) return null;
        return (
          <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, marginBottom: 6 }}>
            {partes.map((p, i) => (
              <React.Fragment key={p.label}>
                {i > 0 && " · "}
                <b>{p.label}:</b> {p.value}
              </React.Fragment>
            ))}
          </p>
        );
      })()}
      {ev.cuit && <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, marginBottom: 6 }}><b>CUIT a facturar:</b> {ev.cuit}</p>}
      {(() => {
        const partesFact = [
          ev.razonSocial && { label: "Razón social", value: ev.razonSocial },
          ev.direccionFiscal && { label: "Dirección fiscal", value: ev.direccionFiscal },
          ev.tipoFactura && { label: "Tipo de factura", value: ev.tipoFactura },
          ev.condicionIva && { label: "Condición frente al IVA", value: ev.condicionIva },
        ].filter(Boolean);
        if (partesFact.length === 0) return null;
        return (
          <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, marginBottom: 6 }}>
            {partesFact.map((p, i) => (
              <React.Fragment key={p.label}>
                {i > 0 && " · "}
                <b>{p.label}:</b> {p.value}
              </React.Fragment>
            ))}
          </p>
        );
      })()}
      <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, marginBottom: 6 }}>
        <b>Contacto/s:</b> {(ev.contactos || []).filter(c => c.nombre || c.via).length > 0 ? ev.contactos.filter(c => c.nombre || c.via).map((c, i) => `${c.nombre || "-"}${c.via ? ` · ${c.via}` : ""}`).join("  /  ") : "-"}
      </p>
      <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, marginBottom: 6 }}>
        <b>Hospedaje:</b> {ev.esHuesped ? `Es huésped del hotel${ev.huespedes?.length ? ` — ${ev.huespedes.join(", ")}` : " (sin nombres cargados)"}` : "No es huésped"}
      </p>

      <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, marginBottom: 6 }}>
        <b>Facturación:</b>
        {(ev.facturas || []).length > 0 ? (
          <ul style={{ marginLeft: 18, listStyle: "disc" }}>
            {ev.facturas.map(f => (
              <li key={f.id}>
                {f.numero ? `Factura ${f.numero}` : "Sin número"}{f.monto ? ` · $ ${fmtMoney(Number(f.monto))}` : ""}{f.fecha ? ` · ${f.fecha}` : ""} · Retenciones: {f.retenciones === "si" ? "Sí" : "No"}
                {f.link && <> · <a href={f.link} target="_blank" rel="noreferrer" style={{ color: ACCENT, textDecoration: "underline" }}>Ver comprobante</a></>}
              </li>
            ))}
          </ul>
        ) : <span> Sin facturas cargadas.</span>}
      </div>

      {/* ---- Cotización / valor total del evento: salón + comida del Vale (automáticos) + otros ítems ---- */}
      {(() => {
        const { filas, sinIva, iva, totalConIva } = totalItemsEvento(ev);
        return (
          <div className="p-3 rounded mb-4" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 10, fontWeight: 600 }}>Cotización del evento — valor total</p>
            {filas.length > 0 ? (
              <table className="w-full mb-2" style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: INK, borderCollapse: "collapse", border: `1px solid ${INK}` }}>
                <thead>
                  <tr style={{ background: CARD }}>
                    <th className="text-left p-2" style={{ border: `1px solid ${LINE}` }}>Detalle</th>
                    <th className="text-center p-2" style={{ border: `1px solid ${LINE}` }}>Cant.</th>
                    <th className="text-right p-2" style={{ border: `1px solid ${LINE}` }}>Valor uni.</th>
                    <th className="text-right p-2" style={{ border: `1px solid ${LINE}` }}>Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(f => (
                    <tr key={f.id} style={{ opacity: f.auto ? 0.85 : 1 }}>
                      <td className="p-2" style={{ border: `1px solid ${LINE}` }}>{f.detalle}{f.auto ? " — automático" : ""}</td>
                      <td className="text-center p-2" style={{ border: `1px solid ${LINE}` }}>{f.cantidad}</td>
                      <td className="text-right p-2" style={{ border: `1px solid ${LINE}` }}>$ {fmtMoney(Number(f.valorUnitario))}</td>
                      <td className="text-right p-2" style={{ border: `1px solid ${LINE}` }}>$ {fmtMoney((Number(f.cantidad) * Number(f.valorUnitario)))}</td>
                    </tr>
                  ))}
                  <tr style={{ background: CARD, fontWeight: 700 }}>
                    <td className="p-2" colSpan={3} style={{ border: `1px solid ${LINE}` }}>TOTAL (con IVA incluido)</td>
                    <td className="text-right p-2" style={{ border: `1px solid ${LINE}` }}>$ {fmtMoney(totalConIva)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: MUTED, marginBottom: 8 }}>Sin ítems cargados.</p>
            )}
            <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 6, fontFamily: FONT_MONO, fontSize: 12.5, color: INK }}>
              <div className="flex justify-between"><span>Subtotal (sin IVA)</span><span>$ {fmtMoney(sinIva)}</span></div>
              <div className="flex justify-between"><span>IVA (21%)</span><span>$ {fmtMoney(iva)}</span></div>
              <div className="flex justify-between" style={{ fontWeight: 700, fontSize: 14 }}><span>TOTAL (con IVA incluido)</span><span>$ {fmtMoney(totalConIva)}</span></div>
            </div>
          </div>
        );
      })()}

      {(() => {
        const { totalConIva } = totalItemsEvento(ev);
        const pagado = ev.estadoPago === "total" ? totalConIva : (ev.estadoPago === "parcial" || ev.estadoPago === "sena") ? (Number(ev.adelanto) || 0) : 0;
        return (
          <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, marginBottom: 6 }}>
            <b>Estado de pago:</b> {ESTADOS_PAGO.find(([v]) => v === ev.estadoPago)?.[1] || ev.estadoPago} · <b>Pagado:</b> $ {fmtMoney(pagado)} · <b>Saldo pendiente:</b> $ {fmtMoney(totalConIva - pagado)}
            {ev.conceptoAdelanto ? ` (${ev.conceptoAdelanto})` : ""}
          </p>
        );
      })()}
      {(ev.formasPago || []).length > 0 && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, marginBottom: 6 }}>
          <b>Forma de pago:</b> {ev.formasPago.join(", ")}
          {ev.numeroHabitacion ? ` · Habitación N° ${ev.numeroHabitacion}` : ""}
          {ev.montoAperturaSala ? ` · Sala abierta con $ ${fmtMoney(Number(ev.montoAperturaSala))}` : ""}
        </p>
      )}

      {/* ---- Vale (Administración): salones y cubiertos vendidos, discriminados por tipo ---- */}
      <div className="p-3 rounded mb-4" style={{ background: CP_BG, border: `1px solid ${CP_COLOR}` }}>
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: CP_COLOR, marginBottom: 8, fontWeight: 600 }}>Vale (Administración)</p>
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, marginBottom: 8 }}>
          <b>N° de vale:</b> {ev.vale?.numero || "-"} · <b>Salones vendidos:</b> {ev.vale?.salonesVendidos || "1"}
        </p>
        {tiposValeFicha.length > 0 ? (
          <div className="flex flex-col gap-2">
            {tiposValeFicha.map(t => (
              <div key={`${t.fecha || ""}-${t.id}`} className="p-2.5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
                <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: INK, fontWeight: 600 }}>{t.tipo}{t.fecha ? ` — ${t.fecha}` : ""}</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1.5" style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: INK }}>
                  <div><span style={{ color: MUTED }}>Cantidad: </span>{t.cantidad}</div>
                  <div><span style={{ color: MUTED }}>Valor uni.: </span>$ {fmtMoney(Number(t.valorUnitario))}</div>
                  <div className="col-span-2"><span style={{ color: MUTED }}>Valor total: </span>$ {fmtMoney((Number(t.cantidad) * Number(t.valorUnitario)))}</div>
                  {t.comentario && <div className="col-span-2"><span style={{ color: MUTED }}>Comentario: </span>{t.comentario}</div>}
                </div>
              </div>
            ))}
            <div className="p-2.5 rounded flex items-center justify-between" style={{ background: HILITE_BG, border: `1px solid ${CP_COLOR}` }}>
              <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, fontWeight: 700 }}>TOTAL cubiertos vendidos: {tiposValeFicha.reduce((s, t) => s + (Number(t.cantidad) || 0), 0)}</span>
              <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, fontWeight: 700 }}>$ {fmtMoney(tiposValeFicha.reduce((s, t) => s + (Number(t.cantidad) || 0) * (Number(t.valorUnitario) || 0), 0))}</span>
            </div>
          </div>
        ) : <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: MUTED }}>Sin tipos de cubiertos cargados en el Vale.</p>}
      </div>

      {/* ---- Comanda (Cocina): cubiertos, catering, ítems a preparar ---- */}
      <div className="p-3 rounded mb-4" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 8, fontWeight: 600 }}>Comanda (Cocina)</p>
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, marginBottom: 8 }}>
          <b>Cubiertos a preparar:</b> {ev.comanda?.cubiertos || "-"} {ev.comanda?.caterer ? <>· <b>Catering:</b> {ev.comanda.caterer}</> : ""}
        </p>
        {itemsComandaFicha.length > 0 ? (
          <div className="flex flex-col gap-2 mb-2">
            {itemsComandaFicha.map(it => (
              <div key={`${it.fecha || ""}-${it.id}`} className="p-2.5 rounded" style={{ background: CARD, border: `1px solid ${LINE}`, borderLeft: `3px solid ${INK}` }}>
                <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: INK, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {it.nombre}{it.cantidad ? ` (${it.cantidad})` : ""}{multiDiaFicha && it.fecha ? ` — ${it.fecha}` : ""}
                </p>
                {it.detalle && <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: INK, whiteSpace: "pre-wrap", marginTop: 2 }}>{it.detalle}</p>}
              </div>
            ))}
          </div>
        ) : <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: MUTED }}>Sin ítems de comanda cargados.</p>}
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK }}><b>Notas para cocina:</b> {ev.comanda?.detalle || "-"}</p>
      </div>

      {isAdmin && (ev.historial || []).length > 0 && (
        <div className="p-3 rounded mb-4" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 8, fontWeight: 600 }}>Historial de cambios (factura / vale)</p>
          <div className="flex flex-col gap-1.5">
            {ev.historial.slice().reverse().map(h => (
              <p key={h.id} style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: INK }}>
                <span style={{ fontFamily: FONT_MONO, color: MUTED }}>{new Date(h.fecha).toLocaleString("es-AR")}</span> — {h.accion}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ---- Cronograma completo (horario a horario) ---- */}
      <div className="p-3 rounded mb-4" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 8, fontWeight: 600 }}>Cronograma</p>
        {cronoOrdenado.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {cronoOrdenado.map(c => (
              <div key={c.id} style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK }}><b>{c.hora}</b> — {c.detalle}</div>
            ))}
          </div>
        ) : <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: MUTED }}>Sin ítems de cronograma cargados.</p>}
      </div>

      <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, marginBottom: 6 }}><b>Notas:</b> {ev.notas || "-"}</p>
      <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, marginBottom: 6 }}><b>Control interno:</b> {ev.controlInterno || "-"}</p>
      <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, marginBottom: 6 }}><b>Notificar a Jefe de Áreas:</b> {ev.notificarJefeAreas ? "Sí" : "No"}</p>
      <p className="mt-2" style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: MUTED }}>Generado el {new Date().toLocaleDateString("es-AR")}</p>
      </div>

      <div className="no-print flex gap-2 mt-4 flex-wrap">
        {isAdmin && <button onClick={onEdit} className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}>Editar</button>}
        <button onClick={() => window.print()} className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: INK, color: "#fff", fontFamily: FONT_BODY }}>Imprimir ficha completa</button>
        <button onClick={onVaucher} className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: ACCENT, color: "#fff", fontFamily: FONT_BODY }}>Ver / imprimir vaucher (cliente)</button>
        <button onClick={onCronograma} className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: PAGADO, color: PAPER, fontFamily: FONT_BODY }}>Ver cronograma aparte</button>
        <button onClick={onComanda} className="px-3 py-1.5 rounded text-xs font-medium" style={{ border: `1px solid ${PAGADO}`, color: PAGADO, fontFamily: FONT_BODY }}>Ver / imprimir comanda</button>
        <button onClick={onVale} className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: CP_COLOR, color: "#fff", fontFamily: FONT_BODY }}>Ver / imprimir vale</button>
        <button onClick={onPlano} className="px-3 py-1.5 rounded text-xs font-medium" style={{ border: `1px solid ${ACCENT}`, color: ACCENT, fontFamily: FONT_BODY }}>
          {ev.planoDibujo ? "Ver / editar plano del evento" : tienePlantilla ? "Dibujar plano del evento" : "Plano no cargado"}
        </button>
      </div>

      {ev.notificarJefeAreas && (
        <div className="no-print mt-5 pt-4" style={{ borderTop: `1px solid ${LINE}` }}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 8 }}>Avisar por WhatsApp</p>
          <a href={waLink(jefeAreas?.telefono, textoJefeAreas(ev))} target="_blank" rel="noreferrer"
            className="text-sm px-3 py-2 rounded flex justify-between items-center" style={{ background: PAGADO, color: PAPER, fontFamily: FONT_BODY }}>
            <span>Jefe de Áreas</span><span>Enviar →</span>
          </a>
          <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: MUTED, marginTop: 6 }}>Se abre un solo chat de WhatsApp con todo el detalle. Vos lo reenviás a los grupos que corresponda.</p>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   RESUMEN DEL EVENTO — lo que se ve al tocar el evento desde el
   calendario: solo lo esencial (título, hora, fecha, salón). El
   resto de la información vive en "Ficha completa".
   ============================================================ */
export function EventoResumen({ ev, isAdmin, onEdit, onFichaCompleta, onVaucher, onCronograma, onPlano, onVale, onComanda, tienePlantilla }) {
  return (
    <div className="p-5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
      <div className="flex items-start justify-between mb-2">
        <div>
          {ev.colorEvento && <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: ev.colorEvento, marginRight: 6 }} />}
          <h3 style={{ fontFamily: FONT_HEAD, fontSize: 22, color: INK, display: "inline" }}>{ev.nombreEvento || ev.salon || "Sin nombre"}</h3>
        </div>
        <Stamp estadoPago={ev.estadoPago} />
      </div>
      <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: MUTED, marginBottom: 20 }}>
        {ev.horaInicio}–{ev.horaFin} · {fmtRangoFecha(ev)} · {ev.salon || "Sin salón"}
      </p>

      <div className="flex gap-2 flex-wrap">
        {isAdmin && <button onClick={onEdit} className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}>Editar</button>}
        <button onClick={onFichaCompleta} className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: INK, color: "#fff", fontFamily: FONT_BODY }}>Ver / imprimir ficha completa</button>
        <button onClick={onVaucher} className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: ACCENT, color: "#fff", fontFamily: FONT_BODY }}>Ver / imprimir vaucher (cliente)</button>
        <button onClick={onCronograma} className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: PAGADO, color: PAPER, fontFamily: FONT_BODY }}>Ver cronograma</button>
        <button onClick={onComanda} className="px-3 py-1.5 rounded text-xs font-medium" style={{ border: `1px solid ${PAGADO}`, color: PAGADO, fontFamily: FONT_BODY }}>Ver / imprimir comanda</button>
        <button onClick={onVale} className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: CP_COLOR, color: "#fff", fontFamily: FONT_BODY }}>Ver / imprimir vale</button>
        <button onClick={onPlano} className="px-3 py-1.5 rounded text-xs font-medium" style={{ border: `1px solid ${ACCENT}`, color: ACCENT, fontFamily: FONT_BODY }}>
          {ev.planoDibujo ? "Ver / editar plano del evento" : tienePlantilla ? "Dibujar plano del evento" : "Plano no cargado"}
        </button>
      </div>
    </div>
  );
}

