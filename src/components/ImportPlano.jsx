import React, { useEffect, useRef, useState } from "react";
import { ACCENT, ACCENT_DARK, CARD, FONT_BODY, FONT_HEAD, HILITE_BG, INK, INK_SOFT, LINE, MUTED, PAGADO, PAPER, PENDIENTE } from "../constants.js";
import { uid } from "../utils/helpers.js";
import { extractICSFromZip, parseICS } from "../utils/ics.js";
import { blankEvent } from "../utils/eventHelpers.js";
import { PrintHeader } from "./common.jsx";

export function DropZone({ onFile, accept, label, hint, disabled, inputId }) {
  const [sobre, setSobre] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSobre(false);
    if (disabled) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setSobre(true); }}
      onDragLeave={e => { e.preventDefault(); setSobre(false); }}
      onDrop={handleDrop}
      className="rounded flex flex-col items-center justify-center text-center gap-2"
      style={{
        border: `2px dashed ${sobre ? ACCENT_DARK : LINE}`,
        background: sobre ? HILITE_BG : "transparent",
        padding: "18px 14px",
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: MUTED }}>
        {hint || "Arrastrá el archivo hasta acá y soltalo"}
      </span>
      <label htmlFor={inputId} className="inline-block px-4 py-2 rounded text-sm font-medium cursor-pointer" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY, opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }}>
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ""; }}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />
    </div>
  );
}

/* ============================================================
   IMPORTAR DESDE GOOGLE CALENDAR
   ============================================================ */
export function ImportICS({ onImport }) {
  const [parsed, setParsed] = useState([]);
  const [selected, setSelected] = useState({});
  const [done, setDone] = useState(0);
  const [errMsg, setErrMsg] = useState("");
  const [cargando, setCargando] = useState(false);

  const procesarTexto = (texto) => {
    const items = parseICS(texto);
    if (!items.length) {
      setErrMsg("No se encontraron eventos en el archivo. Verificá que sea el calendario correcto exportado de Google Calendar.");
      return;
    }
    setParsed(items);
    setSelected(Object.fromEntries(items.map(i => [i.uid, true])));
    setDone(0);
  };

  const handleFile = async (file) => {
    if (!file) return;
    setErrMsg("");
    setCargando(true);
    const esZip = file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip";
    try {
      if (esZip) {
        const texto = await extractICSFromZip(file);
        procesarTexto(texto);
      } else {
        const texto = await file.text();
        procesarTexto(texto);
      }
    } catch (e) {
      setErrMsg(e.message || "No se pudo leer el archivo. Probá exportarlo de nuevo desde Google Calendar (Configuración > Importar y exportar).");
    } finally {
      setCargando(false);
    }
  };

  const importar = () => {
    const elegidos = parsed.filter(i => selected[i.uid]);
    const nuevos = elegidos.map(i => ({
      ...blankEvent(i.fecha),
      fechaFin: i.fechaFin || "",
      salon: i.location || "", horaInicio: i.horaInicio, horaFin: i.horaFin,
      servicio: i.summary || "", notas: i.description || "",
    }));
    onImport(nuevos);
    setDone(nuevos.length);
    setParsed([]);
  };

  return (
    <div className="p-5 rounded" style={{ background: CARD, border: `1px solid ${LINE}` }}>
      <h3 style={{ fontFamily: FONT_HEAD, fontSize: 20, color: INK, marginBottom: 8 }}>Importar desde Google Calendar</h3>
      <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: MUTED, marginBottom: 14 }}>
        En Google Calendar: Configuración → Importar y exportar → Exportar. Te va a descargar un .zip con tu calendario adentro. Podés subir ese .zip directo acá, no hace falta que lo abras vos.
      </p>
      <DropZone
        inputId="input-ics"
        accept=".ics,.zip,text/calendar,application/zip"
        label="Elegir archivo (.zip o .ics)"
        hint="Arrastrá acá el .zip o .ics exportado, o tocá el botón"
        onFile={handleFile}
      />
      <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: MUTED, marginTop: 8 }}>
        Si el botón no abre el selector de archivos, arrastrá el archivo directamente sobre el recuadro de arriba. En computadora funciona arrastrando desde una carpeta; en celular, si tampoco podés arrastrar, abrí el link publicado del planner en el navegador (Chrome/Safari) en vez de verlo dentro del chat.
      </p>
      {cargando && <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: MUTED, marginTop: 10 }}>Leyendo archivo…</p>}
      {errMsg && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: PENDIENTE }}>{errMsg}</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED, marginTop: 4 }}>
            Si el problema sigue: abrí el .zip en el teléfono (con una app de archivos), sacá de adentro el archivo que termina en .ics, y subí ese archivo directamente acá.
          </p>
        </div>
      )}
      {done > 0 && <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: PAGADO, marginTop: 10 }}>Se importaron {done} eventos. Recordá completar los datos de cada ficha.</p>}

      {parsed.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-col gap-1.5 mb-3 max-h-72 overflow-auto">
            {parsed.map(i => (
              <label key={i.uid} className="flex items-center gap-2 text-xs" style={{ fontFamily: FONT_BODY, color: INK }}>
                <input type="checkbox" checked={!!selected[i.uid]} onChange={e => setSelected(prev => ({ ...prev, [i.uid]: e.target.checked }))} />
                <span>{i.fecha} {i.horaInicio}–{i.horaFin} · {i.summary || "(sin título)"} {i.location ? `· ${i.location}` : ""}</span>
              </label>
            ))}
          </div>
          <button onClick={importar} className="px-4 py-2 rounded text-sm font-medium" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}>
            Importar seleccionados
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PLANO DEL SALÓN — dibujo a mano por evento (imprimible)
   La plantilla vacía se sube por salón en Ajustes. Acá se dibuja
   encima, específico para este evento; la plantilla original
   nunca se modifica.
   ============================================================ */
export function PlanoEditor({ salon, plantilla, dibujoInicial, notasIniciales, onGuardar, onBack, isAdmin }) {
  const canvasRef = useRef(null);
  const [color, setColor] = useState("#96453A");
  const [grosor, setGrosor] = useState(3);
  const dibujandoRef = useRef(false);
  const [guardado, setGuardado] = useState(false);
  const [notas, setNotas] = useState(notasIniciales || "");

  const cargarBase = (src) => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = src;
  };

  useEffect(() => { cargarBase(dibujoInicial || plantilla); }, [plantilla, dibujoInicial]);
  useEffect(() => { setNotas(notasIniciales || ""); }, [notasIniciales]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDraw = (e) => {
    if (!isAdmin) return;
    e.preventDefault();
    dibujandoRef.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const draw = (e) => {
    if (!isAdmin) return;
    if (!dibujandoRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = grosor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const endDraw = () => { dibujandoRef.current = false; };

  const borrarDibujo = () => cargarBase(plantilla);

  // Subir una foto o archivo (por ejemplo, una foto de un plano hecho a
  // mano) para usar en vez de dibujar sobre la plantilla. Reemplaza lo que
  // haya en el lienzo por la imagen subida; después se puede seguir
  // dibujando encima si hace falta, y se guarda igual que un dibujo normal.
  const subirArchivo = (file) => {
    if (!file || !isAdmin) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Por ahora solo se pueden subir imágenes (foto o captura del plano), no otros tipos de archivo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => cargarBase(reader.result);
    reader.readAsDataURL(file);
  };

  const guardar = () => {
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onGuardar(dataUrl, notas);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1500);
  };

  if (!plantilla) {
    return (
      <div>
        <div className="no-print flex gap-2 mb-4">
          <button onClick={onBack} className="px-4 py-2 rounded text-sm font-medium" style={{ border: `1px solid ${LINE}`, color: INK, fontFamily: FONT_BODY }}>Volver</button>
        </div>
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED }}>
          Todavía no se cargó una plantilla de plano vacío para "{salon}". Subila desde <b>Ajustes → Planos de salones</b> y después vas a poder dibujar acá para cada evento.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="no-print flex gap-2 mb-4 flex-wrap items-center">
        <button onClick={() => window.print()} className="px-4 py-2 rounded text-sm font-medium" style={{ background: INK_SOFT, color: PAPER, fontFamily: FONT_BODY }}>Imprimir plano</button>
        {isAdmin && <button onClick={guardar} className="px-4 py-2 rounded text-sm font-medium" style={{ background: PAGADO, color: PAPER, fontFamily: FONT_BODY }}>{guardado ? "¡Guardado!" : "Guardar dibujo del evento"}</button>}
        {isAdmin && <button onClick={borrarDibujo} className="px-3 py-2 rounded text-xs font-medium" style={{ border: `1px solid ${PENDIENTE}`, color: PENDIENTE, fontFamily: FONT_BODY }}>Borrar y volver a la plantilla</button>}
        {isAdmin && (
          <div className="flex items-center gap-1.5 px-2">
            <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED }}>Color:</span>
            {["#96453A", "#4A6FA5", "#5C7A5E", "#2C1F1B", "#FFFFFF"].map(c => (
              <button key={c} onClick={() => setColor(c)} style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: color === c ? `2px solid ${INK}` : `1px solid ${LINE}` }} />
            ))}
          </div>
        )}
        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED }}>Grosor:</span>
            {[2, 4, 7].map(g => (
              <button key={g} onClick={() => setGrosor(g)} className="text-xs px-2 py-1 rounded" style={{ border: `1px solid ${grosor === g ? ACCENT : LINE}`, background: grosor === g ? ACCENT : "transparent", color: grosor === g ? "#fff" : INK }}>{g}</button>
            ))}
          </div>
        )}
        {!isAdmin && <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED }}>Solo lectura · el invitado no puede dibujar</span>}
        <button onClick={onBack} className="px-4 py-2 rounded text-sm font-medium ml-auto" style={{ border: `1px solid ${LINE}`, color: INK, fontFamily: FONT_BODY }}>Volver</button>
      </div>

      {isAdmin && (
        <div className="no-print mb-4">
          <DropZone
            inputId="input-plano-foto"
            accept="image/*"
            label="Subir foto o archivo del plano"
            hint="¿Ya hiciste el plano a mano? Arrastrá la foto acá o tocá el botón, y reemplaza lo que hay dibujado"
            onFile={subirArchivo}
          />
        </div>
      )}

      <div className="p-6" style={{ background: CARD, border: `1px solid ${INK}`, maxWidth: 640, margin: "0 auto" }}>
        <PrintHeader eyebrow="Plano de armado" titulo={salon || "Salón"} />
        <canvas
          ref={canvasRef}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
          style={{ width: "100%", borderRadius: 4, border: `1px solid ${LINE}`, touchAction: "none", cursor: isAdmin ? "crosshair" : "default" }}
        />
        <p className="no-print" style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED, marginTop: 8 }}>
          {isAdmin
            ? "Dibujá directamente sobre el plano con el dedo o el mouse para armar la disposición de este evento en particular. La plantilla original del salón (en Ajustes) no se modifica."
            : "Este plano es de solo lectura para invitados."}
        </p>

        <div style={{ marginTop: 16, borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
          <label style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
            Anotaciones del plano
          </label>
          {isAdmin ? (
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Ej: mesas contra la ventana, dejar pasillo libre en el centro, tarima al fondo…"
              rows={3}
              className="no-print w-full rounded p-2"
              style={{ border: `1px solid ${LINE}`, fontFamily: FONT_BODY, fontSize: 13, color: INK, resize: "vertical" }}
            />
          ) : (
            <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, whiteSpace: "pre-wrap" }}>{notas || "Sin anotaciones."}</p>
          )}
          {isAdmin && notas && <p className="print-only" style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, whiteSpace: "pre-wrap", marginTop: 4 }}>{notas}</p>}
        </div>
      </div>
    </div>
  );
}

