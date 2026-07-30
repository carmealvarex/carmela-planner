import React, { useState } from "react";
import { ACCENT, CARD, FONT_BODY, FONT_HEAD, HILITE_BG, INK, INK_SOFT, LINE, MUTED, PAPER, PENDIENTE, SALONES_FIJOS } from "../constants.js";
import { toISO } from "../utils/helpers.js";
import { Field } from "./common.jsx";
import { DropZone, ImportICS } from "./ImportPlano.jsx";

export function Settings({ jefeAreas, setJefeAreas, tarifas, setTarifas, floorplans, setFloorplans, events, onImportEvents, onMarkPastAsPaid }) {
  const [nuevoSalon, setNuevoSalon] = useState("");
  const [tab, setTab] = useState("tarifas");

  const subirPlano = (salon, file) => {
    if (!salon.trim() || !file) return;
    const reader = new FileReader();
    reader.onload = () => setFloorplans(prev => ({ ...prev, [salon.trim()]: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const setTarifa = (salon, campo, valor) => setTarifas(prev => ({ ...prev, [salon]: { ...(prev[salon] || {}), [campo]: valor } }));

  const TABS = [
    ["tarifas", "Tarifas"],
    ["planos", "Planos"],
    ["jefeareas", "Jefe de Áreas"],
    ["importar", "Importar"],
    ["notificaciones", "Notificaciones"],
    ["backup", "Backup"],
  ];

  const hoyISO = toISO(new Date());
  const eventosPasadosSinPagar = events.filter(e => (e.fechaFin || e.fecha) < hoyISO && e.estadoPago !== "total");

  const exportarBackup = () => {
    const backup = {
      exportadoEl: new Date().toISOString(),
      eventos: events,
      jefeAreas,
      tarifas,
      floorplans,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `backup-carmela-planner-${toISO(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 flex-wrap" style={{ borderBottom: `1px solid ${LINE}` }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className="text-sm font-medium pb-2"
            style={{ fontFamily: FONT_BODY, color: tab === key ? INK : MUTED, borderBottom: tab === key ? `2px solid ${ACCENT}` : "2px solid transparent" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "tarifas" && (
        <div className="p-5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
          <h3 style={{ fontFamily: FONT_HEAD, fontSize: 20, color: INK, marginBottom: 12 }}>Tarifas de salones (mes actual)</h3>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: MUTED, marginBottom: 16 }}>
            Actualizá acá los valores de tarifa completa y media tarifa de cada salón. Al armar una ficha, el valor se muestra automáticamente. Los eventos ya guardados no se ven afectados por cambios posteriores acá (queda el valor histórico aplicado al momento de la venta). Para un caso puntual, usá "Tarifa especial" dentro de la ficha del evento.
          </p>
          <div className="flex flex-col gap-3">
            {SALONES_FIJOS.map(s => (
              <div key={s} className="grid grid-cols-3 gap-3 items-center">
                <span style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: INK, fontWeight: 600 }}>{s}</span>
                <input style={inputStyle} value={tarifas[s]?.completa || ""} onChange={e => setTarifa(s, "completa", e.target.value)} placeholder="Tarifa completa $" />
                <input style={inputStyle} value={tarifas[s]?.media || ""} onChange={e => setTarifa(s, "media", e.target.value)} placeholder="Media tarifa $" />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "planos" && (
        <div className="p-5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
          <h3 style={{ fontFamily: FONT_HEAD, fontSize: 20, color: INK, marginBottom: 12 }}>Planos de salones (plantilla vacía)</h3>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: MUTED, marginBottom: 16 }}>Subí acá el plano vacío (plantilla) de cada salón, sin marcar nada. Después, desde cada evento vas a poder abrir ese plano y dibujar/anotar a mano la disposición específica de ese evento, sin modificar esta plantilla (el nombre del salón debe coincidir con el que elegís en "Salón").</p>

          <div className="flex flex-col gap-3 mb-4">
            {Object.entries(floorplans).map(([salon, img]) => (
              <div key={salon} className="flex items-center gap-3 p-2 rounded" style={{ background: HILITE_BG }}>
                <img src={img} alt={salon} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 4, border: `1px solid ${LINE}` }} />
                <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, flex: 1 }}>{salon}</span>
                <button onClick={() => setFloorplans(prev => { const n = { ...prev }; delete n[salon]; return n; })} style={{ color: PENDIENTE, fontSize: 12, fontFamily: FONT_BODY }}>Eliminar</button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 items-start">
            <select style={{ ...inputStyle, maxWidth: 220 }} value={nuevoSalon} onChange={e => setNuevoSalon(e.target.value)}>
              <option value="">Elegir salón…</option>
              {SALONES_FIJOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div style={{ flex: 1, maxWidth: 320 }}>
              <DropZone
                inputId="input-plano"
                accept="image/*"
                label="Elegir imagen del plano"
                hint={nuevoSalon ? "Arrastrá la imagen acá o tocá el botón" : "Elegí un salón primero"}
                disabled={!nuevoSalon}
                onFile={file => subirPlano(nuevoSalon, file)}
              />
            </div>
          </div>
        </div>
      )}

      {tab === "jefeareas" && (
        <div className="p-5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
          <h3 style={{ fontFamily: FONT_HEAD, fontSize: 20, color: INK, marginBottom: 12 }}>Jefe de Áreas · aviso por WhatsApp</h3>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: MUTED, marginBottom: 16 }}>
            Configurá acá un solo número de WhatsApp de contacto. Cuando activás "Notificar a Jefe de Áreas" en la ficha de un evento, se genera un link de WhatsApp a este número con el detalle completo del evento. Esto no tiene relación con la Comanda ni con el Vale — es solo el contacto para avisos internos.
          </p>
          <Field label="Número de WhatsApp de Jefe de Áreas (opcional, con código de país)">
            <input style={inputStyle} value={jefeAreas.telefono} onChange={e => setJefeAreas({ ...jefeAreas, telefono: e.target.value })} placeholder="Ej: 5491122334455" />
          </Field>
          <div className="mt-4 p-3 rounded" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 8, fontWeight: 600 }}>Recordatorio: qué es cada documento</p>
            <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: INK, marginBottom: 6 }}><b>Comanda:</b> lo que necesita Cocina — invitados, horario, fecha, tipo de evento, salón, cronograma y el detalle de qué hay que cocinar (con el catering contratado).</p>
            <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: INK, marginBottom: 6 }}><b>Voucher:</b> el detalle completo del evento para el cliente — salón, cotización, ítems, estado de pago.</p>
            <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: INK }}><b>Vale:</b> lo que necesita Administración — un número que coincide con la factura, cuántos salones y cuántos cubiertos se vendieron (discriminados por tipo).</p>
          </div>
        </div>
      )}

      {tab === "importar" && (
        <ImportICS onImport={(nuevos) => onImportEvents(nuevos)} />
      )}

      {tab === "notificaciones" && (
        <div className="p-5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
          <h3 style={{ fontFamily: FONT_HEAD, fontSize: 20, color: INK, marginBottom: 12 }}>Notificaciones</h3>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: MUTED, marginBottom: 16 }}>
            Las alertas de pago que aparecen al abrir la app ahora quedan guardadas cuando las cerrás con la "×": no van a volver a aparecer. Para eventos viejos importados del calendario que ya pasaron y no vas a actualizar, usá esta herramienta para marcarlos todos como pagados de una sola vez, en lugar de cerrarlos uno por uno.
          </p>
          <div className="p-3 rounded" style={{ background: HILITE_BG, border: `1px solid ${LINE}` }}>
            <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, marginBottom: 10 }}>
              {eventosPasadosSinPagar.length > 0
                ? `Hay ${eventosPasadosSinPagar.length} evento(s) que ya pasaron y siguen marcados como sin pago total.`
                : "No hay eventos pasados pendientes de pago: todo al día."}
            </p>
            {eventosPasadosSinPagar.length > 0 && (
              <button
                onClick={onMarkPastAsPaid}
                className="px-3 py-2 rounded text-sm font-medium"
                style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}
              >
                Marcar los {eventosPasadosSinPagar.length} evento(s) pasados como pagados
              </button>
            )}
            <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: MUTED, marginTop: 8 }}>
              Esto solo cambia el estado de pago a "Pagado en su totalidad" para eventos cuya fecha (o última fecha, si duraron varios días) ya pasó. Los eventos de hoy o futuros no se tocan.
            </p>
          </div>
        </div>
      )}

      {tab === "backup" && (
        <div className="p-5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
          <h3 style={{ fontFamily: FONT_HEAD, fontSize: 20, color: INK, marginBottom: 12 }}>Backup manual</h3>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: MUTED, marginBottom: 16 }}>
            Descarga un archivo .json con todos los eventos cargados, tarifas, planos y el contacto de Jefe de Áreas. Sirve como copia de seguridad propia o por si algún día hace falta migrar de Supabase a otro sistema. Guardalo en Drive o donde prefieras — no se sube a ningún lado automáticamente.
          </p>
          <button onClick={exportarBackup} className="px-4 py-2 rounded text-sm font-medium" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}>
            Descargar backup (.json)
          </button>
          <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: MUTED, marginTop: 10 }}>
            {events.length} evento{events.length === 1 ? "" : "s"} cargado{events.length === 1 ? "" : "s"} actualmente.
          </p>
        </div>
      )}
    </div>
  );
}

