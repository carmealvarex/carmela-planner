import React, { useState } from "react";
import { ACCENT, CARD, CATERING_SUGERIDOS, COLORES_EVENTO, CP_BG, CP_COLOR, ESTADOS_PAGO, FONT_BODY, FONT_HEAD, FONT_MONO, FRANJAS_HORARIAS, HILITE_BG, INK, INK_SOFT, LINE, MUTED, PAPER, PARCIAL, PARCIAL_BG, PENDIENTE, SALONES_FIJOS, TARIFA_TIPOS, TECNICA_SUGERIDOS, TIPOS_FACTURA, VALE_TIPOS } from "../constants.js";
import { esMultiDia, fechasEvento, fmtFecha, fmtMoney, fmtRangoFecha, uid } from "../utils/helpers.js";
import { blankEvent, datosFiscalesCompletos, datosResponsablesCompletos, sincronizarDiasTarifa, totalItemsEvento, valorTarifaDia } from "../utils/eventHelpers.js";
import { Field, HoraField, Toggle } from "./common.jsx";

export function EventForm({ initial, tarifas, onSave, onCancel, onDelete }) {
  const [ev, setEv] = useState(() => {
    const base = { ...blankEvent(initial?.fecha), ...(initial || {}) };
    // Migración: fichas viejas tenían un solo contacto y una sola factura sueltos.
    if (!base.contactos || !base.contactos.length) {
      base.contactos = (base.contactoNombre || base.contactoVia) ? [{ nombre: base.contactoNombre || "", via: base.contactoVia || "" }] : [{ nombre: "", via: "" }];
    }
    if (!base.facturas) base.facturas = [];
    if (!base.facturas.length && (base.comprobanteTexto || base.comprobanteLink)) {
      base.facturas = [{ id: uid(), numero: base.comprobanteTexto || "", monto: "", fecha: "", link: base.comprobanteLink || "", retenciones: base.retenciones || "no" }];
    }
    if (!base.huespedes) base.huespedes = [];
    return base;
  });
  const set = (k, v) => setEv(prev => ({ ...prev, [k]: v }));
  const setVale = (k, v) => setEv(prev => ({ ...prev, vale: { ...prev.vale, [k]: v } }));
  const setComanda = (k, v) => setEv(prev => ({ ...prev, comanda: { ...prev.comanda, [k]: v } }));

  const registrarHistorial = (accion) => {
    setEv(prev => ({ ...prev, historial: [...(prev.historial || []), { id: uid(), fecha: new Date().toISOString(), accion }] }));
  };

  const setContacto = (idx, campo, valor) => setEv(prev => ({ ...prev, contactos: prev.contactos.map((c, i) => i === idx ? { ...c, [campo]: valor } : c) }));
  const agregarContacto = () => setEv(prev => ({ ...prev, contactos: [...prev.contactos, { nombre: "", via: "" }] }));
  const quitarContacto = (idx) => setEv(prev => ({ ...prev, contactos: prev.contactos.filter((_, i) => i !== idx) }));

  const [nuevaFactura, setNuevaFactura] = useState({ numero: "", monto: "", fecha: "", link: "", retenciones: "no" });
  const agregarFactura = () => {
    if (!nuevaFactura.numero.trim() && !nuevaFactura.monto) return;
    setEv(prev => ({ ...prev, facturas: [...(prev.facturas || []), { id: uid(), ...nuevaFactura }] }));
    registrarHistorial(`Agregó factura ${nuevaFactura.numero || "(sin número)"}${nuevaFactura.monto ? ` por $ ${fmtMoney(Number(nuevaFactura.monto))}` : ""}`);
    setNuevaFactura({ numero: "", monto: "", fecha: "", link: "", retenciones: "no" });
  };
  const quitarFactura = (id) => {
    if (!window.confirm("¿Seguro que querés quitar esta factura?")) return;
    const f = (ev.facturas || []).find(x => x.id === id);
    setEv(prev => ({ ...prev, facturas: prev.facturas.filter(f => f.id !== id) }));
    if (f) registrarHistorial(`Quitó factura ${f.numero || "(sin número)"}${f.monto ? ` por $ ${fmtMoney(Number(f.monto))}` : ""}`);
  };

  const [nuevoHuesped, setNuevoHuesped] = useState("");
  const agregarHuesped = () => {
    if (!nuevoHuesped.trim()) return;
    setEv(prev => ({ ...prev, huespedes: [...(prev.huespedes || []), nuevoHuesped.trim()] }));
    setNuevoHuesped("");
  };
  const quitarHuesped = (idx) => setEv(prev => ({ ...prev, huespedes: prev.huespedes.filter((_, i) => i !== idx) }));
  const [nuevoItem, setNuevoItem] = useState({ detalle: "", cantidad: "", valorUnitario: "" });
  const agregarItem = () => {
    if (!nuevoItem.detalle.trim() || !nuevoItem.cantidad || !nuevoItem.valorUnitario) return;
    setEv(prev => ({ ...prev, itemsPresupuesto: [...(prev.itemsPresupuesto || []), { id: uid(), ...nuevoItem }] }));
    setNuevoItem({ detalle: "", cantidad: "", valorUnitario: "" });
  };
  const quitarItem = (id) => setEv(prev => ({ ...prev, itemsPresupuesto: (prev.itemsPresupuesto || []).filter(i => i.id !== id) }));

  // Tipo de comida/servicio del Vale, ahora con `fecha` opcional para poder distinguir
  // por ejemplo "Coffee break del viernes 29" de "Almuerzo del sábado 30". Si se deja
  // en blanco, se entiende que aplica a todo el evento (comportamiento de antes).
  const [nuevoTipoCubierto, setNuevoTipoCubierto] = useState({ tipo: VALE_TIPOS[0], cantidad: "", valorUnitario: "", comentario: "", fecha: "" });
  const agregarTipoCubierto = () => {
    if (!nuevoTipoCubierto.cantidad || !nuevoTipoCubierto.valorUnitario) return;
    setVale("tipos", [...(ev.vale.tipos || []), { id: uid(), ...nuevoTipoCubierto }]);
    const sufijoFecha = nuevoTipoCubierto.fecha ? ` (${fmtFecha(nuevoTipoCubierto.fecha)})` : "";
    registrarHistorial(`Agregó al vale: ${nuevoTipoCubierto.cantidad} × ${nuevoTipoCubierto.tipo}${sufijoFecha} a $ ${fmtMoney(Number(nuevoTipoCubierto.valorUnitario))} c/u${nuevoTipoCubierto.comentario ? ` (${nuevoTipoCubierto.comentario})` : ""}`);
    setNuevoTipoCubierto({ tipo: VALE_TIPOS[0], cantidad: "", valorUnitario: "", comentario: "", fecha: "" });
  };
  const quitarTipoCubierto = (id) => {
    if (!window.confirm("¿Seguro que querés quitar este ítem del vale?")) return;
    const t = (ev.vale.tipos || []).find(x => x.id === id);
    setVale("tipos", (ev.vale.tipos || []).filter(t => t.id !== id));
    if (t) registrarHistorial(`Quitó del vale: ${t.cantidad} × ${t.tipo} a $ ${fmtMoney(Number(t.valorUnitario))} c/u`);
  };

  // Ítem de Comanda (cocina), también con `fecha` opcional (mismo criterio que el Vale).
  const [nuevoItemComanda, setNuevoItemComanda] = useState({ nombre: "", detalle: "", cantidad: "", fecha: "" });
  const agregarItemComanda = () => {
    if (!nuevoItemComanda.nombre.trim()) return;
    setComanda("items", [...(ev.comanda.items || []), { id: uid(), ...nuevoItemComanda }]);
    setNuevoItemComanda({ nombre: "", detalle: "", cantidad: "", fecha: "" });
  };
  const quitarItemComanda = (id) => setComanda("items", (ev.comanda.items || []).filter(i => i.id !== id));

  const toggleIncluye = (item) => setEv(prev => ({ ...prev, incluye: prev.incluye.includes(item) ? prev.incluye.filter(i => i !== item) : [...prev.incluye, item] }));
  const [nuevoIncluye, setNuevoIncluye] = useState("");
  const toggleTecnica = (item) => setEv(prev => ({ ...prev, tecnica: (prev.tecnica || []).includes(item) ? prev.tecnica.filter(i => i !== item) : [...(prev.tecnica || []), item] }));
  const [nuevaTecnica, setNuevaTecnica] = useState("");

  const [nuevaHora, setNuevaHora] = useState("");
  const [nuevoDetalle, setNuevoDetalle] = useState("");
  const agregarCronograma = () => {
    if (!nuevaHora || !nuevoDetalle.trim()) return;
    setEv(prev => ({ ...prev, cronograma: [...(prev.cronograma || []), { id: uid(), hora: nuevaHora, detalle: nuevoDetalle.trim() }] }));
    setNuevaHora(""); setNuevoDetalle("");
  };
  const quitarCronograma = (id) => setEv(prev => ({ ...prev, cronograma: prev.cronograma.filter(c => c.id !== id) }));
  const cronoOrdenado = (ev.cronograma || []).slice().sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));

  const [nuevoRecordatorio, setNuevoRecordatorio] = useState({ texto: "", diasAntes: "2" });
  const agregarRecordatorio = () => {
    if (!nuevoRecordatorio.texto.trim()) return;
    setEv(prev => ({ ...prev, recordatorios: [...(prev.recordatorios || []), { id: uid(), texto: nuevoRecordatorio.texto.trim(), diasAntes: nuevoRecordatorio.diasAntes || "0" }] }));
    setNuevoRecordatorio({ texto: "", diasAntes: "2" });
  };
  const quitarRecordatorio = (id) => setEv(prev => ({ ...prev, recordatorios: (prev.recordatorios || []).filter(r => r.id !== id) }));

  const salonFinal = ev.salon === "Otro" ? ev.salonOtro : ev.salon;
  const salonAdicionalFinal = ev.salonAdicionalActivo ? (ev.salonAdicional === "Otro" ? ev.salonAdicionalOtro : ev.salonAdicional) : "";

  const diasEvento = fechasEvento(ev);
  const cantDias = diasEvento.length;

  // Tarifa por día: se sincroniza en cada render con las fechas reales del evento
  // (si el evento se alarga/acorta, se agregan o sacan días conservando lo elegido).
  const diasTarifaSync = sincronizarDiasTarifa(diasEvento, ev.diasTarifa);
  const diasTarifaAdicionalSync = sincronizarDiasTarifa(diasEvento, ev.diasTarifaAdicional);
  const setDiaTarifa = (fecha, tipo) => set("diasTarifa", diasTarifaSync.map(d => d.fecha === fecha ? { ...d, tipo } : d));
  const setDiaTarifaAdicional = (fecha, tipo) => set("diasTarifaAdicional", diasTarifaAdicionalSync.map(d => d.fecha === fecha ? { ...d, tipo } : d));

  const tarifaSalon = tarifas?.[salonFinal];
  const tarifaSalonAdicional = tarifas?.[salonAdicionalFinal];

  // ev "en vivo" (con los días de tarifa ya sincronizados) para calcular el total
  // mientras se está editando el formulario, antes de guardar.
  const evParaCalculo = { ...ev, diasTarifa: diasTarifaSync, diasTarifaAdicional: diasTarifaAdicionalSync };
  const resultado = totalItemsEvento(evParaCalculo, tarifas);

  const guardar = () => onSave({
    ...ev,
    salon: salonFinal, salonAdicional: salonAdicionalFinal,
    diasTarifa: diasTarifaSync, diasTarifaAdicional: diasTarifaAdicionalSync,
  });

  const fiscalesOk = datosFiscalesCompletos(ev);
  const responsablesOk = datosResponsablesCompletos(ev);

  return (
    <div className="p-5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
      <h3 style={{ fontFamily: FONT_HEAD, fontSize: 20, color: INK, marginBottom: 16 }}>{initial ? "Editar ficha de evento" : "Nueva ficha de evento"}</h3>

      <Field label="Nombre de evento">
        <input style={inputStyle} value={ev.nombreEvento || ""} onChange={e => set("nombreEvento", e.target.value)} placeholder="Ej: Cena aniversario Camuzzi Gas" />
      </Field>

      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Fecha"><input type="date" style={{ ...inputStyle, colorScheme: "light" }} value={ev.fecha} onChange={e => set("fecha", e.target.value)} /></Field>
        <Field label="Fecha de fin (solo si dura más de un día)">
          <input type="date" style={{ ...inputStyle, colorScheme: "light" }} min={ev.fecha} value={ev.fechaFin || ""} onChange={e => set("fechaFin", e.target.value)} />
          {esMultiDia(ev) && <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: ACCENT, marginTop: 4 }}>Evento de {diasEvento.length} días: {fmtRangoFecha(ev)}. Va a aparecer marcado en todos esos días del calendario.</p>}
        </Field>
        <Field label="Salón">
          <select style={inputStyle} value={ev.salon} onChange={e => set("salon", e.target.value)}>
            <option value="">Elegir salón…</option>
            {SALONES_FIJOS.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="Otro">Otro…</option>
          </select>
          {ev.salon === "Otro" && <input style={{ ...inputStyle, marginTop: 8 }} placeholder="Nombre del salón" value={ev.salonOtro} onChange={e => set("salonOtro", e.target.value)} />}
        </Field>
        <Field label="Hora inicio">
          <HoraField value={ev.horaInicio} onChange={v => set("horaInicio", v)} manual={ev.horaInicioManual} onManualToggle={v => set("horaInicioManual", v)} />
        </Field>
        <Field label="Hora fin">
          <HoraField value={ev.horaFin} onChange={v => set("horaFin", v)} manual={ev.horaFinManual} onManualToggle={v => set("horaFinManual", v)} />
        </Field>
        <Field label="Hora de armado (opcional)">
          <HoraField value={ev.horaArmado || ""} onChange={v => set("horaArmado", v)} manual={ev.horaArmadoManual} onManualToggle={v => set("horaArmadoManual", v)} />
        </Field>
        <Field label="Hora de desarme (opcional)">
          <HoraField value={ev.horaDesarme || ""} onChange={v => set("horaDesarme", v)} manual={ev.horaDesarmeManual} onManualToggle={v => set("horaDesarmeManual", v)} />
        </Field>
        <Field label="Personas"><input type="number" style={inputStyle} value={ev.personas} onChange={e => set("personas", e.target.value)} /></Field>
        <Field label="Concepto"><input style={inputStyle} value={ev.servicio} onChange={e => set("servicio", e.target.value)} placeholder="Ej: cena" /></Field>
      </div>

      <Field label="Color en el calendario">
        <div className="flex gap-2 flex-wrap">
          {COLORES_EVENTO.map(c => (
            <button type="button" key={c.valor} onClick={() => set("colorEvento", c.valor)}
              title={c.nombre}
              style={{
                width: 28, height: 28, borderRadius: "50%", background: c.valor,
                border: ev.colorEvento === c.valor ? `3px solid ${INK}` : `1px solid ${LINE}`,
              }} />
          ))}
          <button type="button" onClick={() => set("colorEvento", "")}
            className="text-xs px-2.5 py-1 rounded-full" style={{ border: `1px solid ${LINE}`, color: MUTED, fontFamily: FONT_BODY }}>
            Sin color (usar estado de pago)
          </button>
        </div>
      </Field>

      <Field label={`Tarifa del salón por día${cantDias > 1 ? ` (${cantDias} días)` : ""}`}>
        <div className="p-2.5 rounded mb-2" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
          <label className="flex items-center gap-1.5 mb-2">
            <input type="checkbox" checked={!!ev.tarifaEspecialActiva} onChange={e => set("tarifaEspecialActiva", e.target.checked)} />
            <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, fontWeight: 600 }}>Usar tarifa especial (un valor único para todos los días, ignora el tarifario)</span>
          </label>
          {ev.tarifaEspecialActiva && (
            <input type="number" style={inputStyle} value={ev.tarifaEspecial} onChange={e => set("tarifaEspecial", e.target.value)} placeholder="Valor especial del salón $ (precio final, con IVA incluido, por día)" />
          )}
        </div>

        {!ev.tarifaEspecialActiva && (
          <div className="flex flex-col gap-1.5">
            {diasTarifaSync.map(d => {
              const valor = valorTarifaDia(d.tipo, tarifaSalon);
              return (
                <div key={d.fecha} className="flex items-center gap-3 flex-wrap p-2 rounded" style={{ background: HILITE_BG }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: INK, minWidth: 90 }}>{fmtFecha(d.fecha)}</span>
                  {TARIFA_TIPOS.map(([valorTipo, etiqueta]) => (
                    <label key={valorTipo} className="flex items-center gap-1.5">
                      <input type="radio" checked={d.tipo === valorTipo} onChange={() => setDiaTarifa(d.fecha, valorTipo)} />
                      <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: INK }}>{etiqueta}</span>
                    </label>
                  ))}
                  <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: ACCENT, marginLeft: "auto" }}>
                    {salonFinal ? (tarifaSalon ? `$ ${fmtMoney(valor)}` : "Sin tarifa en Ajustes") : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: MUTED, marginTop: 6 }}>
          Elegí para cada día si se cobra tarifa completa, media tarifa o cortesía (sin cargo). Por ejemplo, en un evento de 4 días podés dejar 1 día de cortesía, 1 a media tarifa y 2 a tarifa completa.
        </p>
      </Field>

      <Field label="Salón adicional (uso simultáneo de un segundo salón)">
        <div className="p-2.5 rounded" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
          <label className="flex items-center gap-1.5 mb-2">
            <input type="checkbox" checked={!!ev.salonAdicionalActivo} onChange={e => set("salonAdicionalActivo", e.target.checked)} />
            <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, fontWeight: 600 }}>Este evento usa un salón más en simultáneo (ej: sala de reunión + salón de capacitación al mismo tiempo)</span>
          </label>
          {ev.salonAdicionalActivo && (
            <>
              <select style={inputStyle} value={ev.salonAdicional} onChange={e => set("salonAdicional", e.target.value)}>
                <option value="">Elegir salón adicional…</option>
                {SALONES_FIJOS.filter(s => s !== salonFinal).map(s => <option key={s} value={s}>{s}</option>)}
                <option value="Otro">Otro…</option>
              </select>
              {ev.salonAdicional === "Otro" && <input style={{ ...inputStyle, marginTop: 8 }} placeholder="Nombre del salón adicional" value={ev.salonAdicionalOtro} onChange={e => set("salonAdicionalOtro", e.target.value)} />}

              <div className="mt-3 p-2.5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
                <label className="flex items-center gap-1.5 mb-2">
                  <input type="checkbox" checked={!!ev.tarifaEspecialActivaAdicional} onChange={e => set("tarifaEspecialActivaAdicional", e.target.checked)} />
                  <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, fontWeight: 600 }}>Usar tarifa especial para el salón adicional (valor único, todos los días)</span>
                </label>
                {ev.tarifaEspecialActivaAdicional ? (
                  <input type="number" style={inputStyle} value={ev.tarifaEspecialAdicional} onChange={e => set("tarifaEspecialAdicional", e.target.value)} placeholder="Valor especial del salón adicional $ (precio final, con IVA incluido, por día)" />
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {diasTarifaAdicionalSync.map(d => {
                      const valor = valorTarifaDia(d.tipo, tarifaSalonAdicional);
                      return (
                        <div key={d.fecha} className="flex items-center gap-3 flex-wrap p-2 rounded" style={{ background: HILITE_BG }}>
                          <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: INK, minWidth: 90 }}>{fmtFecha(d.fecha)}</span>
                          {TARIFA_TIPOS.map(([valorTipo, etiqueta]) => (
                            <label key={valorTipo} className="flex items-center gap-1.5">
                              <input type="radio" checked={d.tipo === valorTipo} onChange={() => setDiaTarifaAdicional(d.fecha, valorTipo)} />
                              <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: INK }}>{etiqueta}</span>
                            </label>
                          ))}
                          <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: ACCENT, marginLeft: "auto" }}>
                            {salonAdicionalFinal ? (tarifaSalonAdicional ? `$ ${fmtMoney(valor)}` : "Sin tarifa en Ajustes") : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Field>

      <Field label="Incluye (catering / comida)">
        <div className="flex flex-wrap gap-2 mb-2">
          {CATERING_SUGERIDOS.map(item => (
            <button type="button" key={item} onClick={() => toggleIncluye(item)}
              className="text-xs px-2.5 py-1 rounded-full"
              style={{ border: `1px solid ${ev.incluye.includes(item) ? ACCENT : LINE}`, background: ev.incluye.includes(item) ? ACCENT : "transparent", color: ev.incluye.includes(item) ? "#fff" : INK, fontFamily: FONT_BODY }}>
              {item}
            </button>
          ))}
          {ev.incluye.filter(i => !CATERING_SUGERIDOS.includes(i)).map(item => (
            <button type="button" key={item} onClick={() => toggleIncluye(item)} className="text-xs px-2.5 py-1 rounded-full" style={{ border: `1px solid ${ACCENT}`, background: ACCENT, color: "#fff", fontFamily: FONT_BODY }}>{item} ✕</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input style={inputStyle} value={nuevoIncluye} onChange={e => setNuevoIncluye(e.target.value)} placeholder="Agregar otro ítem de comida..." />
          <button type="button" onClick={() => { if (nuevoIncluye.trim()) { toggleIncluye(nuevoIncluye.trim()); setNuevoIncluye(""); } }} className="px-3 rounded text-sm" style={{ background: INK_SOFT, color: PAPER }}>+</button>
        </div>
      </Field>

      <Field label="Técnica (servicios adicionales)">
        <div className="flex flex-wrap gap-2 mb-2">
          {TECNICA_SUGERIDOS.map(item => (
            <button type="button" key={item} onClick={() => toggleTecnica(item)}
              className="text-xs px-2.5 py-1 rounded-full"
              style={{ border: `1px solid ${ev.tecnica.includes(item) ? ACCENT : LINE}`, background: ev.tecnica.includes(item) ? ACCENT : "transparent", color: ev.tecnica.includes(item) ? "#fff" : INK, fontFamily: FONT_BODY }}>
              {item}
            </button>
          ))}
          {ev.tecnica.filter(i => !TECNICA_SUGERIDOS.includes(i)).map(item => (
            <button type="button" key={item} onClick={() => toggleTecnica(item)} className="text-xs px-2.5 py-1 rounded-full" style={{ border: `1px solid ${ACCENT}`, background: ACCENT, color: "#fff", fontFamily: FONT_BODY }}>{item} ✕</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input style={inputStyle} value={nuevaTecnica} onChange={e => setNuevaTecnica(e.target.value)} placeholder="Agregar otro ítem técnico..." />
          <button type="button" onClick={() => { if (nuevaTecnica.trim()) { toggleTecnica(nuevaTecnica.trim()); setNuevaTecnica(""); } }} className="px-3 rounded text-sm" style={{ background: INK_SOFT, color: PAPER }}>+</button>
        </div>
      </Field>

      <Field label="Formato / armado del salón">
        <textarea style={{ ...inputStyle, minHeight: 60 }} value={ev.formatoArmado || ""} onChange={e => set("formatoArmado", e.target.value)} placeholder="Describí cómo armar el salón: en U, escuela, banquete, cantidad de mesas, etc." />
      </Field>

      <div className="p-3 rounded mb-4" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 10 }}>Quién contrata / quién paga / quién factura</p>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Empresa que organiza"><input style={inputStyle} value={ev.empresaOrganiza} onChange={e => set("empresaOrganiza", e.target.value)} /></Field>
          <Field label="Empresa que contrata"><input style={inputStyle} value={ev.empresaContrata} onChange={e => set("empresaContrata", e.target.value)} /></Field>
          <Field label="Empresa que paga"><input style={inputStyle} value={ev.empresaPaga} onChange={e => set("empresaPaga", e.target.value)} /></Field>
          <Field label="Empresa a la que se factura"><input style={inputStyle} value={ev.empresaFactura} onChange={e => set("empresaFactura", e.target.value)} /></Field>
        </div>
        <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: responsablesOk ? MUTED : PARCIAL, marginTop: 6 }}>
          {responsablesOk ? "Completo: esta información va a aparecer en la Ficha y el Voucher." : "Falta completar alguno de estos 4 campos — hasta que estén los 4, este bloque NO va a aparecer en la Ficha ni en el Voucher."}
        </p>
      </div>

      <div className="p-3 rounded mb-4" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 10 }}>Datos fiscales para facturar</p>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="CUIT a facturar"><input style={inputStyle} value={ev.cuit || ""} onChange={e => set("cuit", e.target.value)} placeholder="Ej: 30-12345678-9" /></Field>
          <Field label="Razón social"><input style={inputStyle} value={ev.razonSocial || ""} onChange={e => set("razonSocial", e.target.value)} placeholder="Nombre legal de la empresa" /></Field>
          <Field label="Dirección fiscal"><input style={inputStyle} value={ev.direccionFiscal || ""} onChange={e => set("direccionFiscal", e.target.value)} placeholder="Domicilio fiscal" /></Field>
          <Field label="Tipo de factura">
            <select style={inputStyle} value={ev.tipoFactura || ""} onChange={e => set("tipoFactura", e.target.value)}>
              <option value="">Elegir tipo…</option>
              {TIPOS_FACTURA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: fiscalesOk ? MUTED : PARCIAL, marginTop: 6 }}>
          {fiscalesOk ? "Completo: estos datos van a aparecer en la Ficha y el Voucher." : "Falta completar alguno de estos 4 campos — hasta que estén los 4, este bloque NO va a aparecer en la Ficha ni en el Voucher."}
        </p>
      </div>

      <Field label="Contacto/s (al menos uno, se puede agregar más de uno)">
        <div className="flex flex-col gap-2 mb-2">
          {ev.contactos.map((c, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-2 items-center" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
              <input style={inputStyle} value={c.nombre} onChange={e => setContacto(idx, "nombre", e.target.value)} placeholder="Nombre del contacto" />
              <div className="flex gap-2">
                <input style={inputStyle} value={c.via} onChange={e => setContacto(idx, "via", e.target.value)} placeholder="Email o teléfono" />
                {ev.contactos.length > 1 && <button type="button" onClick={() => quitarContacto(idx)} style={{ color: PENDIENTE, fontSize: 12 }}>Quitar</button>}
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={agregarContacto} className="text-xs px-2.5 py-1 rounded" style={{ border: `1px solid ${LINE}`, color: ACCENT, fontFamily: FONT_BODY }}>+ Agregar otro contacto</button>
      </Field>

      <Field label="Hospedaje">
        <Toggle checked={!!ev.esHuesped} onChange={v => set("esHuesped", v)} label="El cliente del evento es huésped del hotel" />
        {ev.esHuesped && (
          <div className="mt-3 p-2.5 rounded" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED, marginBottom: 8 }}>Nombres de las personas que se hospedan</p>
            <div className="flex flex-col gap-1.5 mb-2">
              {(ev.huespedes || []).map((h, idx) => (
                <div key={idx} className="flex items-center gap-2 p-1.5 rounded" style={{ background: CARD }}>
                  <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, flex: 1 }}>{h}</span>
                  <button type="button" onClick={() => quitarHuesped(idx)} style={{ color: PENDIENTE, fontSize: 12 }}>Quitar</button>
                </div>
              ))}
              {!(ev.huespedes || []).length && <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED }}>Sin huéspedes cargados todavía.</p>}
            </div>
            <div className="flex gap-2">
              <input style={inputStyle} value={nuevoHuesped} onChange={e => setNuevoHuesped(e.target.value)} placeholder="Nombre y apellido" />
              <button type="button" onClick={agregarHuesped} className="px-3 rounded text-sm" style={{ background: INK_SOFT, color: PAPER }}>+</button>
            </div>
          </div>
        )}
      </Field>

      <div className="p-3 rounded mb-4" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 10 }}>Cotización del evento (tabla del voucher)</p>
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
            {resultado.filas.map(f => (
              <tr key={f.id} style={{ borderBottom: `1px solid ${LINE}`, opacity: f.auto ? 0.85 : 1 }}>
                <td className="py-1">{f.detalle}{f.auto ? " — automático" : ""}</td>
                <td className="text-right py-1">{f.cantidad}</td>
                <td className="text-right py-1">$ {fmtMoney(f.valorUnitario)}</td>
                <td className="text-right py-1">$ {fmtMoney((Number(f.cantidad) || 0) * (Number(f.valorUnitario) || 0))}</td>
                <td className="text-right py-1">{!f.auto && <button type="button" onClick={() => quitarItem(f.id)} style={{ color: PENDIENTE, fontSize: 11 }}>Quitar</button>}</td>
              </tr>
            ))}
            <tr>
              <td className="py-1 font-semibold" colSpan={3}>TOTAL (con IVA incluido)</td>
              <td className="text-right py-1 font-semibold">$ {fmtMoney(resultado.totalConIva)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: MUTED, marginBottom: 10 }}>El salón (día por día) y la comida cargada en el "Vale" se suman solos — no hace falta cargarlos dos veces. Usá el campo de "otros ítems" solo para cosas que NO estén en el Vale (ej: técnica, decoración, servicios extra).</p>
        <div className="grid grid-cols-4 gap-2 items-end">
          <Field label="Detalle (otro ítem, NO comida del Vale)"><input style={inputStyle} value={nuevoItem.detalle} onChange={e => setNuevoItem(p => ({ ...p, detalle: e.target.value }))} placeholder="Ej: Técnica extra, decoración" /></Field>
          <Field label="Cantidad"><input type="number" style={inputStyle} value={nuevoItem.cantidad} onChange={e => setNuevoItem(p => ({ ...p, cantidad: e.target.value }))} placeholder="Ej: 60" /></Field>
          <Field label="Valor unitario"><input type="number" style={inputStyle} value={nuevoItem.valorUnitario} onChange={e => setNuevoItem(p => ({ ...p, valorUnitario: e.target.value }))} placeholder="Ej: 20000" /></Field>
          <button type="button" onClick={agregarItem} className="px-3 py-2 rounded text-sm mb-4" style={{ background: INK_SOFT, color: PAPER }}>+ Agregar ítem</button>
        </div>
      </div>

      <div className="p-3 rounded mb-4" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 10 }}>Estado de pago</p>
        <div className="flex gap-4 mb-3 flex-wrap">
          {ESTADOS_PAGO.map(([v, l]) => (
            <label key={v} className="flex items-center gap-1.5">
              <input type="radio" checked={ev.estadoPago === v} onChange={() => set("estadoPago", v)} />
              <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK }}>{l}</span>
            </label>
          ))}
        </div>

        <div className="p-2.5 rounded mb-3" style={{ background: CARD, border: `1px solid ${LINE}` }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: INK, marginBottom: 2 }}>Total cargado (precio final, con IVA incluido): $ {fmtMoney(resultado.totalConIva)}</p>
          <p style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: INK, marginBottom: 2 }}>Valor sin IVA (discriminado): $ {fmtMoney(resultado.sinIva)}</p>
          <p style={{ fontFamily: FONT_MONO, fontSize: 14, color: ACCENT, fontWeight: 700 }}>IVA (21%, discriminado): $ {fmtMoney(resultado.iva)}</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: MUTED, marginTop: 4 }}>Los precios que cargás arriba (salón + ítems) son siempre precios finales, con IVA incluido. El programa no suma IVA: lo discrimina hacia atrás, igual que la factura oficial del hotel.</p>
        </div>

        <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginTop: 14, marginBottom: 10 }}>Facturación (uso interno — no aparece en el vaucher del cliente)</p>
        {(ev.facturas || []).length > 0 && (
          <div className="flex flex-col gap-2 mb-3">
            {ev.facturas.map(f => (
              <div key={f.id} className="p-2.5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
                <div className="flex items-start justify-between gap-2">
                  <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: INK, fontWeight: 600 }}>Factura N° {f.numero || "-"}</div>
                  <button type="button" onClick={() => quitarFactura(f.id)} style={{ color: PENDIENTE, fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}>Quitar</button>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1.5" style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: INK }}>
                  <div><span style={{ color: MUTED }}>Monto: </span>{f.monto ? `$ ${fmtMoney(Number(f.monto))}` : "-"}</div>
                  <div><span style={{ color: MUTED }}>Fecha: </span>{f.fecha || "-"}</div>
                  <div><span style={{ color: MUTED }}>Retenciones: </span>{f.retenciones === "si" ? "Sí" : "No"}</div>
                  <div><span style={{ color: MUTED }}>Comprobante: </span>{f.link ? <a href={f.link} target="_blank" rel="noreferrer" style={{ color: ACCENT, textDecoration: "underline" }}>Ver</a> : "-"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: MUTED, marginBottom: 8 }}>Agregá una fila por cada factura o pago recibido (por si hay más de un pago o más de un consumo facturado).</p>
        <div className="grid grid-cols-3 gap-2 items-end mb-2">
          <Field label="N° de factura"><input style={inputStyle} value={nuevaFactura.numero} onChange={e => setNuevaFactura(p => ({ ...p, numero: e.target.value }))} placeholder="Factura N°..." /></Field>
          <Field label="Monto"><input type="number" style={inputStyle} value={nuevaFactura.monto} onChange={e => setNuevaFactura(p => ({ ...p, monto: e.target.value }))} placeholder="$ ..." /></Field>
          <Field label="Fecha"><input type="date" style={{ ...inputStyle, colorScheme: "light" }} value={nuevaFactura.fecha} onChange={e => setNuevaFactura(p => ({ ...p, fecha: e.target.value }))} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-2 items-end">
          <Field label="Retenciones">
            <select style={inputStyle} value={nuevaFactura.retenciones} onChange={e => setNuevaFactura(p => ({ ...p, retenciones: e.target.value }))}>
              <option value="no">No</option>
              <option value="si">Sí</option>
            </select>
          </Field>
          <Field label="Link de comprobante"><input style={inputStyle} value={nuevaFactura.link} onChange={e => setNuevaFactura(p => ({ ...p, link: e.target.value }))} placeholder="Link a Drive/Dropbox" /></Field>
          <button type="button" onClick={agregarFactura} className="px-3 py-2 rounded text-sm mb-4" style={{ background: INK_SOFT, color: PAPER }}>+ Agregar factura</button>
        </div>

        {(ev.estadoPago === "parcial" || ev.estadoPago === "sena") && (
          <div className="mt-3 p-3 rounded" style={{ background: PARCIAL_BG, border: `1px solid ${PARCIAL}` }}>
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: PARCIAL, marginBottom: 10, fontWeight: 600 }}>
              {ev.estadoPago === "sena" ? "Seña" : "Pago parcial"} — monto ya recibido
            </p>
            <div className="grid grid-cols-2 gap-x-4">
              <Field label="Monto ya pagado (seña/adelanto)"><input type="number" style={inputStyle} value={ev.adelanto} onChange={e => set("adelanto", e.target.value)} placeholder="Ej: 50000" /></Field>
              <Field label="Concepto de la seña (opcional)"><input style={inputStyle} value={ev.conceptoAdelanto || ""} onChange={e => set("conceptoAdelanto", e.target.value)} placeholder="Ej: seña salón, falta catering" /></Field>
            </div>
            <p style={{ fontFamily: FONT_MONO, fontSize: 14, color: PARCIAL, fontWeight: 600, marginTop: 4 }}>
              Total $ {fmtMoney(resultado.totalConIva)} — Pagado $ {fmtMoney((Number(ev.adelanto) || 0))} — Falta facturar $ {fmtMoney((resultado.totalConIva - (Number(ev.adelanto) || 0)))}
            </p>
          </div>
        )}
      </div>

      <div className="p-3 rounded mb-4" style={{ background: CP_BG, border: `1px solid ${CP_COLOR}` }}>
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: CP_COLOR, marginBottom: 10, fontWeight: 600 }}>Vale (uso interno de Administración — tiene que coincidir con la factura)</p>
        <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: MUTED, marginBottom: 10 }}>
          Registra cuántos salones y cuántos cubiertos se vendieron en este evento, discriminados por tipo (coffee break, almuerzo, cena, finger food, etc.) y, si hace falta, por día. No es un comprobante fiscal: es lo que usa Administración para cruzar contra la factura.
        </p>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="N° de vale (automático)">
            <input style={{ ...inputStyle, background: HILITE_BG, color: MUTED, cursor: "not-allowed" }} value={ev.vale.numero || "Se asigna solo al guardar"} disabled readOnly />
          </Field>
          <Field label="Cantidad de salones vendidos"><input type="number" style={inputStyle} value={ev.vale.salonesVendidos} onChange={e => setVale("salonesVendidos", e.target.value)} placeholder="Ej: 1" /></Field>
        </div>

        {(ev.vale.tipos || []).length > 0 && (
          <div className="flex flex-col gap-2 mb-3">
            {ev.vale.tipos.map(t => (
              <div key={t.id} className="p-2.5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
                <div className="flex items-start justify-between gap-2">
                  <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: INK, fontWeight: 600 }}>{t.tipo}{t.fecha ? ` — ${fmtFecha(t.fecha)}` : " — todo el evento"}</div>
                  <button type="button" onClick={() => quitarTipoCubierto(t.id)} style={{ color: PENDIENTE, fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}>Quitar</button>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1.5" style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: INK }}>
                  <div><span style={{ color: MUTED }}>Cantidad: </span>{t.cantidad}</div>
                  <div><span style={{ color: MUTED }}>Valor uni.: </span>$ {fmtMoney(Number(t.valorUnitario))}</div>
                  <div className="col-span-2"><span style={{ color: MUTED }}>Valor total: </span>$ {fmtMoney((Number(t.cantidad) * Number(t.valorUnitario)))}</div>
                  {t.comentario && <div className="col-span-2"><span style={{ color: MUTED }}>Comentario: </span>{t.comentario}</div>}
                </div>
              </div>
            ))}
            <div className="p-2.5 rounded flex items-center justify-between" style={{ background: HILITE_BG, border: `1px solid ${CP_COLOR}` }}>
              <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, fontWeight: 700 }}>TOTAL cubiertos vendidos: {ev.vale.tipos.reduce((s, t) => s + (Number(t.cantidad) || 0), 0)}</span>
              <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, fontWeight: 700 }}>$ {fmtMoney(ev.vale.tipos.reduce((s, t) => s + (Number(t.cantidad) || 0) * (Number(t.valorUnitario) || 0), 0))}</span>
            </div>
          </div>
        )}
        <div className="grid grid-cols-4 gap-2 items-end mb-2">
          <Field label="Tipo">
            <select style={inputStyle} value={nuevoTipoCubierto.tipo} onChange={e => setNuevoTipoCubierto(p => ({ ...p, tipo: e.target.value }))}>
              {VALE_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Cantidad"><input type="number" style={inputStyle} value={nuevoTipoCubierto.cantidad} onChange={e => setNuevoTipoCubierto(p => ({ ...p, cantidad: e.target.value }))} placeholder="Ej: 40" /></Field>
          <Field label="Valor unitario"><input type="number" style={inputStyle} value={nuevoTipoCubierto.valorUnitario} onChange={e => setNuevoTipoCubierto(p => ({ ...p, valorUnitario: e.target.value }))} placeholder="Ej: 8000" /></Field>
          <button type="button" onClick={agregarTipoCubierto} className="px-3 py-2 rounded text-sm mb-4" style={{ background: CP_COLOR, color: "#fff" }}>+ Agregar tipo</button>
        </div>
        <div className="grid grid-cols-2 gap-2 items-end">
          <Field label="Día al que corresponde (opcional)">
            <select style={inputStyle} value={nuevoTipoCubierto.fecha} onChange={e => setNuevoTipoCubierto(p => ({ ...p, fecha: e.target.value }))}>
              <option value="">Todo el evento</option>
              {diasEvento.map(f => <option key={f} value={f}>{fmtFecha(f)}</option>)}
            </select>
          </Field>
          <Field label="Comentario (opcional)">
            <input style={inputStyle} value={nuevoTipoCubierto.comentario} onChange={e => setNuevoTipoCubierto(p => ({ ...p, comentario: e.target.value }))} placeholder="Ej: menú vegetariano para 5 personas" />
          </Field>
        </div>
      </div>

      <div className="p-3 rounded mb-4" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 10 }}>Comanda para cocina (documento que le llega a Cocina)</p>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Cantidad de cubiertos a preparar"><input type="number" style={inputStyle} value={ev.comanda.cubiertos} onChange={e => setComanda("cubiertos", e.target.value)} placeholder="Ej: 80" /></Field>
          <Field label="Catering contratado"><input style={inputStyle} value={ev.comanda.caterer || ""} onChange={e => setComanda("caterer", e.target.value)} placeholder="Ej: Catering XYZ, o 'propio del hotel'" /></Field>
        </div>

        {(ev.comanda.items || []).length > 0 && (
          <table className="w-full mb-3" style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: INK, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                <th className="text-left py-1">Ítem</th>
                <th className="text-left py-1">Detalle</th>
                <th className="text-left py-1">Día</th>
                <th className="text-right py-1">Cant.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ev.comanda.items.map(it => (
                <tr key={it.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                  <td className="py-1">{it.nombre}</td>
                  <td className="py-1">{it.detalle}</td>
                  <td className="py-1">{it.fecha ? fmtFecha(it.fecha) : "Todo el evento"}</td>
                  <td className="text-right py-1">{it.cantidad}</td>
                  <td className="text-right py-1"><button type="button" onClick={() => quitarItemComanda(it.id)} style={{ color: PENDIENTE, fontSize: 11 }}>Quitar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="grid grid-cols-4 gap-2 items-end mb-2">
          <Field label="Ítem"><input style={inputStyle} value={nuevoItemComanda.nombre} onChange={e => setNuevoItemComanda(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Almuerzo" /></Field>
          <Field label="Detalle (qué cocinar)"><input style={inputStyle} value={nuevoItemComanda.detalle} onChange={e => setNuevoItemComanda(p => ({ ...p, detalle: e.target.value }))} placeholder="Ej: menú 3 pasos, alergias, horario de servicio" /></Field>
          <Field label="Cantidad"><input type="number" style={inputStyle} value={nuevoItemComanda.cantidad} onChange={e => setNuevoItemComanda(p => ({ ...p, cantidad: e.target.value }))} placeholder="Ej: 80" /></Field>
          <button type="button" onClick={agregarItemComanda} className="px-3 py-2 rounded text-sm mb-4" style={{ background: INK_SOFT, color: PAPER }}>+ Agregar ítem</button>
        </div>
        <Field label="Día al que corresponde (opcional)">
          <select style={inputStyle} value={nuevoItemComanda.fecha} onChange={e => setNuevoItemComanda(p => ({ ...p, fecha: e.target.value }))}>
            <option value="">Todo el evento</option>
            {diasEvento.map(f => <option key={f} value={f}>{fmtFecha(f)}</option>)}
          </select>
        </Field>
        <Field label="Notas generales para cocina (opcional)"><input style={inputStyle} value={ev.comanda.detalle} onChange={e => setComanda("detalle", e.target.value)} placeholder="Ej: horarios de servicio, alergias, aclaraciones" /></Field>
      </div>

      <Field label="Cronograma del evento (horario a horario)">
        <div className="flex flex-col gap-1.5 mb-2">
          {cronoOrdenado.map(c => (
            <div key={c.id} className="flex items-center gap-2 p-2 rounded" style={{ background: HILITE_BG }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: INK, minWidth: 54 }}>{c.hora}</span>
              <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, flex: 1 }}>{c.detalle}</span>
              <button onClick={() => quitarCronograma(c.id)} style={{ color: PENDIENTE, fontSize: 12 }}>Quitar</button>
            </div>
          ))}
          {!cronoOrdenado.length && <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: MUTED }}>Sin ítems todavía. Ej: 18:00 prueba de sonido, 20:30 llegada de invitados, 21:30 coffee break, 22:00 charla, 23:00 finger food, 23:40 postre.</p>}
        </div>
        <div className="flex gap-2 items-start">
          <div style={{ maxWidth: 150 }}>
            <select style={inputStyle} value={FRANJAS_HORARIAS.includes(nuevaHora) ? nuevaHora : ""} onChange={e => setNuevaHora(e.target.value)}>
              <option value="">Hora…</option>
              {FRANJAS_HORARIAS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <input style={inputStyle} value={nuevoDetalle} onChange={e => setNuevoDetalle(e.target.value)} placeholder="Qué pasa a esa hora..." />
          <button type="button" onClick={agregarCronograma} className="px-3 rounded text-sm" style={{ background: INK_SOFT, color: PAPER }}>+</button>
        </div>
      </Field>

      <Field label="Aviso">
        <Toggle checked={ev.notificarJefeAreas} onChange={v => set("notificarJefeAreas", v)} label="Notificar a Jefe de Áreas por WhatsApp" />
      </Field>

      <div className="p-3 rounded mb-4" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 6, fontWeight: 600 }}>Recordatorios personalizados</p>
        <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: MUTED, marginBottom: 10 }}>
          Avisos puntuales de este evento (ej: "Alquilar vajilla" — avisar 2 días antes). Aparecen en el cartel de alertas al abrir la app, desde ese número de días antes y hasta el día del evento.
        </p>
        {(ev.recordatorios || []).length > 0 && (
          <div className="flex flex-col gap-1.5 mb-3">
            {ev.recordatorios.map(r => (
              <div key={r.id} className="flex items-center justify-between p-2 rounded" style={{ background: CARD }}>
                <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK }}>{r.texto} — avisar {r.diasAntes} día{Number(r.diasAntes) === 1 ? "" : "s"} antes</span>
                <button type="button" onClick={() => quitarRecordatorio(r.id)} style={{ color: PENDIENTE, fontSize: 11, fontFamily: FONT_BODY }}>Quitar</button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-4 gap-2 items-end">
          <div className="col-span-3">
            <Field label="Qué hay que hacer / recordar">
              <input style={inputStyle} value={nuevoRecordatorio.texto} onChange={e => setNuevoRecordatorio(p => ({ ...p, texto: e.target.value }))} placeholder="Ej: Alquilar vajilla" />
            </Field>
          </div>
          <Field label="Días antes"><input type="number" min="0" style={inputStyle} value={nuevoRecordatorio.diasAntes} onChange={e => setNuevoRecordatorio(p => ({ ...p, diasAntes: e.target.value }))} /></Field>
        </div>
        <button type="button" onClick={agregarRecordatorio} className="px-3 py-2 rounded text-sm mt-2" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}>+ Agregar recordatorio</button>
      </div>

      <Field label="Notas"><textarea style={{ ...inputStyle, minHeight: 60 }} value={ev.notas} onChange={e => set("notas", e.target.value)} /></Field>

      <Field label="Control interno (checklist / seguimiento, no aparece en el vaucher)">
        <textarea style={{ ...inputStyle, minHeight: 60 }} value={ev.controlInterno || ""} onChange={e => set("controlInterno", e.target.value)} placeholder="Ej: falta confirmar mantelería, pendiente llamar al proveedor de sonido..." />
      </Field>

      <div className="flex gap-2 mt-4">
        <button onClick={guardar} className="px-4 py-2 rounded font-medium text-sm" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}>Guardar ficha</button>
        <button onClick={onCancel} className="px-4 py-2 rounded font-medium text-sm" style={{ border: `1px solid ${LINE}`, color: INK, fontFamily: FONT_BODY }}>Cancelar</button>
        {initial && <button onClick={() => onDelete(ev.id)} className="px-4 py-2 rounded font-medium text-sm ml-auto" style={{ color: PENDIENTE, fontFamily: FONT_BODY }}>Eliminar evento</button>}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${LINE}`,
  fontFamily: FONT_BODY, fontSize: 13.5, color: INK, background: PAPER,
};
