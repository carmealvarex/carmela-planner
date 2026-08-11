import React, { useEffect, useMemo, useRef, useState } from "react";
import { loadShared, saveShared, supabase, uploadFile, esDataUrl } from "./lib/supabaseStorage.js";
import { ConfirmProvider, useConfirm } from "./components/ConfirmDialog.jsx";
import { ACCENT, CARD, FONT_BODY, FONT_HEAD, FONT_IMPORT, INK, INK_SOFT, LINE, MUTED, PAPER, PARCIAL, PARCIAL_BG, PENDIENTE, PENDIENTE_BG, formatValeNumero } from "./constants.js";
import { diasHasta, fromISO, mondayOf, toISO } from "./utils/helpers.js";
import { blankEvent } from "./utils/eventHelpers.js";
import { LogoCA } from "./components/common.jsx";
import { RoleGate } from "./components/RoleGate.jsx";
import { MonthView, WeekView, DayView } from "./components/CalendarViews.jsx";
import { EventForm } from "./components/EventForm.jsx";
import { FichaCompleta, EventoResumen } from "./components/FichaViews.jsx";
import { Voucher, Vale, Comanda } from "./components/Documentos.jsx";
import { Cronograma } from "./components/Cronograma.jsx";
import { PlanoEditor } from "./components/ImportPlano.jsx";
import { Stats, BuscadorEventos } from "./components/StatsBuscadores.jsx";
import { ListaPresupuestos, PresupuestoForm, PresupuestoDocumento } from "./components/Presupuesto.jsx";
import { Settings } from "./components/Settings.jsx";

export default function App() {
  return (
    <ConfirmProvider>
      <AppInner />
    </ConfirmProvider>
  );
}

function AppInner() {
  const confirm = useConfirm();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState(() => {
    try { return localStorage.getItem("plannerRole") || null; } catch { return null; }
  });
  const [pin, setPin] = useState(null);
  const [proximoVale, setProximoVale] = useState(1);
  const [proximoVoucher, setProximoVoucher] = useState(1);
  const [proximoFicha, setProximoFicha] = useState(1);
  const [proximoComanda, setProximoComanda] = useState(1);
  const [events, setEvents] = useState([]);
  const [jefeAreas, setJefeAreas] = useState({ telefono: "" });
  const [tarifas, setTarifas] = useState({});
  const [floorplans, setFloorplans] = useState({});
  // Presupuestos: cotizaciones para mandarle a un cliente que todavía no reservó nada
  // (independientes de los eventos ya confirmados en el calendario).
  const [presupuestos, setPresupuestos] = useState([]);
  const [presupuestoSeleccionado, setPresupuestoSeleccionado] = useState(null);
  const [presupuestoEditando, setPresupuestoEditando] = useState(null);
  const [view, setView] = useState("calendario");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [weekStart, setWeekStart] = useState(mondayOf(new Date()));
  const [diaSeleccionado, setDiaSeleccionado] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [newEventDate, setNewEventDate] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };
  const [alertasOcultas, setAlertasOcultas] = useState([]);
  // Notificaciones "pospuestas": id de la alerta -> fecha/hora (ISO) hasta la
  // cual hay que ocultarla. Pasado ese momento, vuelve a aparecer sola.
  const [alertasPospuestas, setAlertasPospuestas] = useState({});
  const [notifAbiertas, setNotifAbiertas] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Guarda cuantos eventos habia la ultima vez que se guardaron con exito.
  // Si en algun momento se intenta guardar un array vacio habiendo tenido
  // eventos antes, es señal de un bug (no de que la usuaria borro todo a
  // mano) y frenamos el guardado en vez de pisar los datos reales.
  const prevEventsCountRef = useRef(0);
  // Guardan la "marca de tiempo" con la que quedó guardado en el servidor lo último
  // que leímos/guardamos nosotros, para poder detectar si otra computadora guardó
  // algo en el medio (ver saveShared en lib/supabaseStorage.js) y no pisarlo en
  // silencio. Son las dos keys que reportaste con pérdida de datos: eventos y planos.
  const eventosUpdatedAtRef = useRef(null);
  const planosUpdatedAtRef = useRef(null);

  const alertas = useMemo(() => {
    const lista = [];
    events.forEach(e => {
      const dias = diasHasta(e.fecha);
      if (dias === null) return;
      const sinPagar = e.estadoPago !== "total";
      if (sinPagar && dias <= 2) {
        lista.push({
          id: `pago-${e.id}`,
          ev: e,
          urgente: dias < 0,
          texto: dias < 0
            ? `"${e.nombreEvento || e.salon || "Evento"}" ya pasó (hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? "" : "s"}) y sigue sin pago total.`
            : dias === 0
              ? `"${e.nombreEvento || e.salon || "Evento"}" es HOY y no está pagado en su totalidad.`
              : `"${e.nombreEvento || e.salon || "Evento"}" es en ${dias} día${dias === 1 ? "" : "s"} y no está pagado en su totalidad.`,
        });
      }
      (e.recordatorios || []).forEach(r => {
        const diasAntes = Number(r.diasAntes) || 0;
        if (dias >= 0 && dias <= diasAntes) {
          lista.push({
            id: `rec-${r.id}`,
            ev: e,
            urgente: dias === 0,
            texto: `"${e.nombreEvento || e.salon || "Evento"}" (${dias === 0 ? "hoy" : `en ${dias} día${dias === 1 ? "" : "s"}`}): ${r.texto}`,
          });
        }
      });
    });
    const ahora = Date.now();
    return lista
      .filter(a => !alertasOcultas.includes(a.id))
      .filter(a => !(alertasPospuestas[a.id] && new Date(alertasPospuestas[a.id]).getTime() > ahora))
      .sort((a, b) => (a.urgente === b.urgente ? 0 : a.urgente ? -1 : 1));
  }, [events, alertasOcultas, alertasPospuestas]);

  // Posponer una notificación: vuelve a aparecer sola pasadas las horas indicadas.
  const posponerAlerta = (id, horas) => {
    const hasta = new Date(Date.now() + horas * 60 * 60 * 1000).toISOString();
    setAlertasPospuestas(prev => ({ ...prev, [id]: hasta }));
  };
  // Posponer hasta mañana a las 9:00.
  const posponerHastaManana = (id) => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(9, 0, 0, 0);
    setAlertasPospuestas(prev => ({ ...prev, [id]: manana.toISOString() }));
  };

  useEffect(() => {
    (async () => {
      const [ev, jefe, cfg, planos, tar, ocultas, pospuestas, presu] = await Promise.all([
        loadShared("eventos", []),
        loadShared("jefeAreas", { telefono: "" }),
        loadShared("config", { pin: null, proximoVale: 1, proximoVoucher: 1, proximoFicha: 1, proximoComanda: 1 }),
        loadShared("planos", {}),
        loadShared("tarifas", {}),
        loadShared("alertasOcultas", []),
        loadShared("alertasPospuestas", {}),
        loadShared("presupuestos", []),
      ]);

      // Si CUALQUIERA de estas cargas falló (red, timeout, etc.), NO seguimos:
      // no activamos "ready", así los efectos de autoguardado no se disparan
      // y no hay riesgo de pisar datos reales con los valores de fallback.
      const huboFallos = [ev, jefe, cfg, planos, tar, ocultas, pospuestas, presu].some(r => !r.ok);
      if (huboFallos) {
        console.error("Fallo la carga inicial de al menos una clave, se aborta para no sobrescribir datos.");
        setLoadError(true);
        return;
      }

      setEvents(ev.value); setJefeAreas(jefe.value); setPin(cfg.value.pin); setProximoVale(cfg.value.proximoVale || 1);
      setProximoVoucher(cfg.value.proximoVoucher || 1); setProximoFicha(cfg.value.proximoFicha || 1); setProximoComanda(cfg.value.proximoComanda || 1);
      setFloorplans(planos.value); setTarifas(tar.value); setAlertasOcultas(ocultas.value); setAlertasPospuestas(pospuestas.value); setPresupuestos(presu.value);
      prevEventsCountRef.current = (ev.value || []).length;
      eventosUpdatedAtRef.current = ev.updatedAt;
      planosUpdatedAtRef.current = planos.updatedAt;
      setReady(true);
    })();
  }, []);

  // ============================================================
  // Sincronización en tiempo real: escucha los cambios que guarda
  // CUALQUIER computadora conectada a la misma base y los aplica acá,
  // sin necesidad de recargar la página. Necesita que la tabla
  // "kv_store" tenga la replicación en tiempo real activada en Supabase
  // (Database → Replication → kv_store, o el SQL:
  //   alter publication supabase_realtime add table kv_store;
  // — ver README.md).
  // ============================================================
  useEffect(() => {
    if (!ready) return;
    const canal = supabase
      .channel("kv_store_cambios")
      .on("postgres_changes", { event: "*", schema: "public", table: "kv_store" }, (payload) => {
        const fila = payload.new;
        if (!fila || !fila.key) return;
        switch (fila.key) {
          case "eventos":
            // Si la marca de tiempo es la misma que la nuestra, es el eco de
            // nuestro propio guardado: no hace falta hacer nada.
            if (fila.updated_at === eventosUpdatedAtRef.current) return;
            setEvents(fila.value || []);
            eventosUpdatedAtRef.current = fila.updated_at;
            prevEventsCountRef.current = (fila.value || []).length;
            break;
          case "planos":
            if (fila.updated_at === planosUpdatedAtRef.current) return;
            setFloorplans(fila.value || {});
            planosUpdatedAtRef.current = fila.updated_at;
            break;
          case "tarifas":
            setTarifas(fila.value || {});
            break;
          case "jefeAreas":
            setJefeAreas(fila.value || { telefono: "" });
            break;
          case "presupuestos":
            setPresupuestos(fila.value || []);
            break;
          // "alertasOcultas"/"alertasPospuestas"/"config" son preferencias más
          // personales de quien está usando cada computadora, así que no
          // hace falta sincronizarlas en vivo entre todos.
          default:
            break;
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [ready]);

  // ============================================================
  // Migración en segundo plano: los eventos que ya tenían fotos o planos
  // "pegados" adentro a la manera vieja (base64, todo junto en el mismo
  // bloque) se van subiendo solos al Storage la primera vez que se abre
  // la app, uno por uno y sin bloquear nada. Esto es lo que hace que,
  // con el tiempo, la app vuelva a abrir rápido aunque ya tengas eventos
  // viejos con fotos cargadas. Corre una sola vez, al arrancar.
  // ============================================================
  const migracionCorridaRef = useRef(false);
  useEffect(() => {
    if (!ready || migracionCorridaRef.current) return;
    migracionCorridaRef.current = true;
    let cancelado = false;
    (async () => {
      const pendientes = events.filter(e =>
        esDataUrl(e.planoDibujo) || (e.archivosAdjuntos || []).some(a => esDataUrl(a.dataUrl))
      );
      if (pendientes.length === 0) return;
      showToast(`Optimizando ${pendientes.length} archivo(s) viejos en segundo plano, para que la app abra más rápido…`);
      for (const ev of pendientes) {
        if (cancelado) return;
        const cambios = {};
        if (esDataUrl(ev.planoDibujo)) {
          const res = await uploadFile(`planos/${ev.id}-migrado-${Date.now()}.png`, ev.planoDibujo);
          if (res.ok) cambios.planoDibujo = res.url;
        }
        if ((ev.archivosAdjuntos || []).some(a => esDataUrl(a.dataUrl))) {
          const nuevos = [];
          for (const a of ev.archivosAdjuntos) {
            if (esDataUrl(a.dataUrl)) {
              const res = await uploadFile(`adjuntos/${ev.id}/${a.id}-${a.nombre}`, a.dataUrl, a.tipo);
              nuevos.push(res.ok ? { ...a, dataUrl: res.url } : a);
            } else {
              nuevos.push(a);
            }
          }
          cambios.archivosAdjuntos = nuevos;
        }
        if (!cancelado && Object.keys(cambios).length > 0) {
          setEvents(prev => prev.map(e => (e.id === ev.id ? { ...e, ...cambios } : e)));
        }
      }
      if (!cancelado) showToast(`Listo: se optimizaron ${pendientes.length} archivo(s) ✓`);
    })();
    return () => { cancelado = true; };
  }, [ready]);

  // Misma migración que arriba, pero para las plantillas de plano por salón
  // (las que se suben desde Ajustes → Planos de salones), que también podían
  // quedar pegadas como base64 en el bloque de "planos".
  const migracionPlanosRef = useRef(false);
  useEffect(() => {
    if (!ready || migracionPlanosRef.current) return;
    migracionPlanosRef.current = true;
    let cancelado = false;
    (async () => {
      const entradas = Object.entries(floorplans).filter(([, img]) => esDataUrl(img));
      if (entradas.length === 0) return;
      for (const [salon, img] of entradas) {
        if (cancelado) return;
        const path = `plantillas/${salon.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-migrado-${Date.now()}.png`;
        const res = await uploadFile(path, img);
        if (!cancelado && res.ok) {
          setFloorplans(prev => ({ ...prev, [salon]: res.url }));
        }
      }
    })();
    return () => { cancelado = true; };
  }, [ready]);

  // ============================================================
  // Guardar "eventos" con reintento automático.
  //
  // Como en esta app la única que edita es la organizadora (los
  // invitados solo miran), lo que tenés en pantalla SIEMPRE es la
  // versión correcta a guardar — nunca hace falta descartarla a favor
  // de "lo que ya está en el servidor". Antes, si un guardado se
  // cortaba a mitad de camino (corte de conexión momentáneo) pero en
  // realidad SÍ se había aplicado del lado del servidor, el siguiente
  // guardado lo malinterpretaba como "otra compu lo cambió" y pisaba
  // tu pantalla con una versión vieja, perdiendo tu último cambio.
  //
  // Ahora, ante cualquier tropiezo (falla de red o un "conflicto"),
  // primero nos ponemos al día con la marca de tiempo real del
  // servidor y reintentamos guardar lo que tenés en pantalla — hasta
  // 3 veces, con una pausa corta entre intento e intento. Solo si
  // los 3 intentos fallan (problema real y persistente de conexión)
  // se avisa para que reintentes manualmente.
  // ============================================================
  const guardarEventos = async (intentosRestantes = 3) => {
    const res = await saveShared("eventos", events, eventosUpdatedAtRef.current);
    if (res.ok && !res.conflict) {
      eventosUpdatedAtRef.current = res.updatedAt;
      return;
    }
    // Falló o hubo un "conflicto" (que acá siempre es un desajuste de
    // marca de tiempo, no otra persona editando). Nos ponemos al día
    // con el servidor y reintentamos con lo que tenés en pantalla.
    const fresh = await loadShared("eventos", events);
    if (fresh.ok) eventosUpdatedAtRef.current = fresh.updatedAt;
    if (intentosRestantes > 0) {
      await new Promise(r => setTimeout(r, 1500));
      return guardarEventos(intentosRestantes - 1);
    }
    showToast("⚠️ No se pudo guardar por un problema de conexión. Revisá tu internet y volvé a intentar en un momento.");
  };

  useEffect(() => {
    if (!ready) return;
    // Traba de seguridad: si antes había eventos guardados y ahora el
    // array está vacío, es mucho más probable que sea un bug (carga
    // fallida, estado pisado, etc.) que un vaciado intencional — nadie
    // borra 251 eventos de a uno sin querer. Frenamos el guardado.
    if (events.length === 0 && prevEventsCountRef.current > 0) {
      console.error(`Se bloqueó un guardado de "eventos" vacío habiendo ${prevEventsCountRef.current} antes. No se guardó nada.`);
      showToast("⚠️ Se evitó borrar los eventos por seguridad. Recargá la página antes de seguir.");
      return;
    }
    prevEventsCountRef.current = events.length;

    // Debounce: si vas tipeando o cambiando varias cosas seguidas, esperamos
    // a que hagas una pausa de casi 1 segundo antes de guardar, en vez de
    // mandar un guardado a Supabase por cada letra. Esto también reduce
    // mucho las demoras al usar la app.
    const t = setTimeout(() => { guardarEventos(); }, 900);
    return () => clearTimeout(t);
  }, [events, ready]);
  useEffect(() => { if (ready) { const t = setTimeout(() => saveShared("jefeAreas", jefeAreas), 900); return () => clearTimeout(t); } }, [jefeAreas, ready]);
  const guardarPlanos = async (intentosRestantes = 3) => {
    const res = await saveShared("planos", floorplans, planosUpdatedAtRef.current);
    if (res.ok && !res.conflict) {
      planosUpdatedAtRef.current = res.updatedAt;
      return;
    }
    const fresh = await loadShared("planos", floorplans);
    if (fresh.ok) planosUpdatedAtRef.current = fresh.updatedAt;
    if (intentosRestantes > 0) {
      await new Promise(r => setTimeout(r, 1500));
      return guardarPlanos(intentosRestantes - 1);
    }
    showToast("⚠️ No se pudo guardar el plano por un problema de conexión. Revisá tu internet y volvé a intentar en un momento.");
  };
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => { guardarPlanos(); }, 900);
    return () => clearTimeout(t);
  }, [floorplans, ready]);
  useEffect(() => { if (ready) { const t = setTimeout(() => saveShared("tarifas", tarifas), 900); return () => clearTimeout(t); } }, [tarifas, ready]);
  // Las notificaciones que la persona ya descartó (tocando la "×") se guardan acá, para que
  // no vuelvan a aparecer cada vez que se abre la app.
  useEffect(() => { if (ready) { const t = setTimeout(() => saveShared("alertasOcultas", alertasOcultas), 900); return () => clearTimeout(t); } }, [alertasOcultas, ready]);
  useEffect(() => { if (ready) { const t = setTimeout(() => saveShared("alertasPospuestas", alertasPospuestas), 900); return () => clearTimeout(t); } }, [alertasPospuestas, ready]);
  useEffect(() => { if (ready) { const t = setTimeout(() => saveShared("presupuestos", presupuestos), 900); return () => clearTimeout(t); } }, [presupuestos, ready]);

  const setPinIfEmpty = (p) => { setPin(p); saveShared("config", { pin: p, proximoVale, proximoVoucher, proximoFicha, proximoComanda }); };

  const isAdmin = role === "admin";

  useEffect(() => {
    try {
      if (role) localStorage.setItem("plannerRole", role);
      else localStorage.removeItem("plannerRole");
    } catch {}
  }, [role]);

  useEffect(() => { if (role === "guest") setView("semana"); }, [role]);

  const handleSaveEvent = (ev) => {
    // Los N° de vale, voucher, ficha y comanda son siempre automáticos: cada uno se asigna
    // una sola vez, la primera vez que se guarda la ficha (si ya tenía uno asignado, se
    // respeta y no se vuelve a tocar) — así el nombre del archivo descargado no cambia
    // entre una descarga y otra del mismo evento.
    let finalEv = ev;
    let nVale = proximoVale, nVoucher = proximoVoucher, nFicha = proximoFicha, nComanda = proximoComanda;

    if (!finalEv.vale?.numero) {
      finalEv = { ...finalEv, vale: { ...finalEv.vale, numero: formatValeNumero(nVale) } };
      nVale += 1;
    }
    const numeracion = { ...(finalEv.numeracion || {}) };
    if (!numeracion.voucher) { numeracion.voucher = formatValeNumero(nVoucher); nVoucher += 1; }
    if (!numeracion.ficha) { numeracion.ficha = formatValeNumero(nFicha); nFicha += 1; }
    if (!numeracion.comanda) { numeracion.comanda = formatValeNumero(nComanda); nComanda += 1; }
    finalEv = { ...finalEv, numeracion };

    if (nVale !== proximoVale || nVoucher !== proximoVoucher || nFicha !== proximoFicha || nComanda !== proximoComanda) {
      setProximoVale(nVale); setProximoVoucher(nVoucher); setProximoFicha(nFicha); setProximoComanda(nComanda);
      saveShared("config", { pin, proximoVale: nVale, proximoVoucher: nVoucher, proximoFicha: nFicha, proximoComanda: nComanda });
    }
    setEvents(prev => {
      const exists = prev.some(e => e.id === finalEv.id);
      return exists ? prev.map(e => e.id === finalEv.id ? finalEv : e) : [...prev, finalEv];
    });
    setSelectedEvent(finalEv); setEditingEvent(null); setNewEventDate(null); setView("ficha");
    showToast("Ficha guardada ✓");
  };
  const handleDeleteEvent = async (id) => {
    if (!(await confirm("¿Seguro que querés eliminar este evento? Esta acción no se puede deshacer.", { danger: true, confirmLabel: "Sí, eliminar" }))) return;
    setEvents(prev => prev.filter(e => e.id !== id));
    setSelectedEvent(null); setEditingEvent(null); setView("calendario");
    showToast("Evento eliminado");
  };

  const handleSavePresupuesto = (p) => {
    setPresupuestos(prev => {
      const existe = prev.some(x => x.id === p.id);
      return existe ? prev.map(x => x.id === p.id ? p : x) : [...prev, p];
    });
    setPresupuestoSeleccionado(p); setPresupuestoEditando(null); setView("presupuestoDoc");
    showToast("Presupuesto guardado ✓");
  };
  const handleDeletePresupuesto = async (id) => {
    if (!(await confirm("¿Seguro que querés eliminar este presupuesto? Esta acción no se puede deshacer.", { danger: true, confirmLabel: "Sí, eliminar" }))) return;
    setPresupuestos(prev => prev.filter(p => p.id !== id));
    showToast("Presupuesto eliminado");
  };
  // Herramienta de Ajustes → Notificaciones: marca de una sola vez todos los eventos que ya
  // pasaron y siguen sin pago total (típicamente eventos viejos importados del calendario que
  // no se van a actualizar a mano). No toca eventos de hoy o futuros.
  const handleMarkPastAsPaid = async () => {
    const hoyISO = toISO(new Date());
    const cantidad = events.filter(e => (e.fechaFin || e.fecha) < hoyISO && e.estadoPago !== "total").length;
    if (cantidad === 0) return;
    if (!(await confirm(`¿Marcar ${cantidad} evento(s) pasados como "pagado en su totalidad"? Esta acción no se puede deshacer fácilmente.`))) return;
    setEvents(prev => prev.map(e => ((e.fechaFin || e.fecha) < hoyISO && e.estadoPago !== "total") ? { ...e, estadoPago: "total" } : e));
    showToast(`${cantidad} evento(s) marcados como pagados ✓`);
  };
  // Antes esto guardaba el dibujo (una imagen entera) pegado directo adentro
  // del evento, lo que hacía que el bloque de "eventos" pesara cada vez más
  // y la app tardara mucho en abrir. Ahora la imagen se sube al Storage de
  // Supabase y en el evento solo queda guardado un link corto a esa imagen.
  const handleSavePlano = async (dataUrl, notas) => {
    const eventoId = selectedEvent.id;
    const path = `planos/${eventoId}-${Date.now()}.png`;
    const res = await uploadFile(path, dataUrl);
    if (!res.ok) {
      showToast("⚠️ No se pudo subir el plano (revisá tu conexión). Volvé a intentar.");
      throw new Error("upload plano failed");
    }
    setEvents(prev => prev.map(e => e.id === eventoId ? { ...e, planoDibujo: res.url, planoNotas: notas } : e));
    setSelectedEvent(prev => ({ ...prev, planoDibujo: res.url, planoNotas: notas }));
  };

  if (loadError) {
    return (
      <div style={{ minHeight: "100vh", background: PAPER, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_BODY, color: INK, textAlign: "center", padding: 24 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No se pudo conectar con la base de datos.</p>
          <p style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Por tu seguridad, la app no cargó ni va a guardar nada hasta que se resuelva esto. Revisá tu conexión y volvé a intentar.</p>
          <button onClick={() => window.location.reload()} className="text-sm px-4 py-2 rounded" style={{ background: ACCENT, color: INK, fontFamily: FONT_BODY, fontWeight: 600 }}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return <div style={{ minHeight: "100vh", background: PAPER, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_BODY, color: MUTED }}>Cargando planner…</div>;
  }

  if (!role) {
    return (
      <div style={{ minHeight: "100vh", background: PAPER }}>
        <style>{FONT_IMPORT}</style>
        <RoleGate onEnter={setRole} pin={pin} setPinIfEmpty={setPinIfEmpty} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: PAPER }}>
      <style>{`${FONT_IMPORT}
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <header className="no-print px-5 py-4 flex items-center justify-between" style={{ background: INK_SOFT }}>
        <div className="flex items-center gap-3">
          <LogoCA size={34} />
          <h1 style={{ fontFamily: FONT_HEAD, fontSize: 19, color: PAPER }}>Planner de Eventos</h1>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setNotifAbiertas(v => !v)}
                aria-label="Notificaciones"
                style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 1 }}
              >
                <span style={{ fontSize: 19 }}>🔔</span>
                {alertas.length > 0 && (
                  <span style={{
                    position: "absolute", top: -3, right: -3, background: PENDIENTE, color: "#fff",
                    borderRadius: "50%", fontSize: 10, minWidth: 16, height: 16, padding: "0 3px",
                    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_BODY,
                  }}>
                    {alertas.length}
                  </span>
                )}
              </button>

              {notifAbiertas && (
                <div
                  className="no-print"
                  onClick={() => setNotifAbiertas(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 55 }}
                />
              )}
              {notifAbiertas && (
                <div className="no-print" onClick={e => e.stopPropagation()} style={{
                  position: "absolute", top: "calc(100% + 10px)", right: 0, width: 320, maxWidth: "88vw",
                  maxHeight: 440, overflowY: "auto", background: CARD, border: `1px solid ${LINE}`,
                  borderRadius: 8, boxShadow: "0 10px 28px rgba(0,0,0,0.18)", padding: 12, zIndex: 60,
                }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, color: INK }}>
                      Notificaciones {alertas.length > 0 ? `(${alertas.length})` : ""}
                    </span>
                    {alertas.length > 0 && (
                      <button
                        onClick={() => setAlertasOcultas(prev => [...prev, ...alertas.map(a => a.id)])}
                        style={{ fontFamily: FONT_BODY, fontSize: 11, color: MUTED, textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}
                      >
                        Descartar todas
                      </button>
                    )}
                  </div>

                  {alertas.length === 0 ? (
                    <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: MUTED, padding: "6px 2px" }}>
                      No hay notificaciones pendientes.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {alertas.map(a => (
                        <div key={a.id} className="p-2.5 rounded"
                          style={{ background: a.urgente ? PENDIENTE_BG : PARCIAL_BG, border: `1px solid ${a.urgente ? PENDIENTE : PARCIAL}` }}>
                          <button
                            onClick={() => { setSelectedEvent(a.ev); setView("ficha"); setNotifAbiertas(false); }}
                            className="text-left w-full"
                            style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: INK, background: "none", border: "none", cursor: "pointer" }}
                          >
                            {a.texto}
                          </button>
                          <div className="flex items-center gap-1.5 flex-wrap mt-2">
                            {a.id.startsWith("pago-") && (
                              <button
                                onClick={() => setEvents(prev => prev.map(e => e.id === a.ev.id ? { ...e, estadoPago: "total" } : e))}
                                className="text-xs px-2 py-0.5 rounded"
                                style={{ fontFamily: FONT_BODY, color: INK, border: `1px solid ${LINE}`, background: CARD, whiteSpace: "nowrap" }}
                              >
                                Marcar pagado
                              </button>
                            )}
                            <button
                              onClick={() => posponerAlerta(a.id, 1)}
                              className="text-xs px-2 py-0.5 rounded"
                              style={{ fontFamily: FONT_BODY, color: INK, border: `1px solid ${LINE}`, background: CARD, whiteSpace: "nowrap" }}
                            >
                              En 1 hora
                            </button>
                            <button
                              onClick={() => posponerHastaManana(a.id)}
                              className="text-xs px-2 py-0.5 rounded"
                              style={{ fontFamily: FONT_BODY, color: INK, border: `1px solid ${LINE}`, background: CARD, whiteSpace: "nowrap" }}
                            >
                              Mañana
                            </button>
                            <button
                              onClick={() => setAlertasOcultas(prev => [...prev, a.id])}
                              className="text-xs px-2 py-0.5 rounded ml-auto"
                              style={{ fontFamily: FONT_BODY, color: MUTED, border: "none", background: "none", cursor: "pointer" }}
                            >
                              Descartar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.08em" }}>{isAdmin ? "Organizadora" : "Invitado · solo lectura"}</span>
          <button onClick={() => setRole(null)} style={{ fontFamily: FONT_BODY, fontSize: 12, color: PAPER, opacity: 0.7 }}>Salir</button>
        </div>
      </header>

      <nav className="no-print px-5 py-3 flex gap-4 flex-wrap" style={{ background: CARD, borderBottom: `1px solid ${LINE}` }}>
        {(isAdmin
          ? [["calendario", "Mes"], ["semana", "Semana"], ["dia", "Día"], ["buscar", "Buscar"], ["estadisticas", "Estadísticas"], ["presupuesto", "Presupuesto"], ["ajustes", "Ajustes"]]
          : [["calendario", "Mes"], ["semana", "Semana"], ["dia", "Día"], ["buscar", "Buscar"], ["estadisticas", "Estadísticas"]]
        ).map(([key, label]) => (
          <button key={key} onClick={() => setView(key)} className="text-sm font-medium pb-1"
            style={{ fontFamily: FONT_BODY, color: (view === key || (key === "presupuesto" && ["presupuestoForm", "presupuestoDoc"].includes(view))) ? INK : MUTED, borderBottom: (view === key || (key === "presupuesto" && ["presupuestoForm", "presupuestoDoc"].includes(view))) ? `2px solid ${ACCENT}` : "2px solid transparent" }}>
            {label}
          </button>
        ))}
      </nav>

      <main className={view === "calendario" ? "max-w-5xl mx-auto px-5 py-6" : "max-w-3xl mx-auto px-5 py-6"}>
        {view === "calendario" && (
          <MonthView year={year} month={month} events={events}
            onPrev={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}
            onNext={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}
            onDayClick={(iso) => { setDiaSeleccionado(fromISO(iso)); setView("dia"); }}
          />
        )}

        {view === "semana" && (
          <WeekView weekStart={weekStart} setWeekStart={setWeekStart} events={events} isAdmin={isAdmin}
            onOpenEvent={(e) => { setSelectedEvent(e); setView("ficha"); }}
            onNewEvent={(iso) => { setNewEventDate(iso); setEditingEvent(null); setView("nuevo"); }}
          />
        )}

        {view === "dia" && (
          <DayView dia={diaSeleccionado} setDia={setDiaSeleccionado} events={events} isAdmin={isAdmin}
            onOpenEvent={(e) => { setSelectedEvent(e); setView("ficha"); }}
            onNewEvent={(iso) => { setNewEventDate(iso); setEditingEvent(null); setView("nuevo"); }}
          />
        )}

        {view === "ficha" && selectedEvent && (
          <EventoResumen ev={selectedEvent} isAdmin={isAdmin}
            onEdit={() => { setEditingEvent(selectedEvent); setView("nuevo"); }}
            onFichaCompleta={() => setView("fichaCompleta")}
            onVaucher={() => setView("vaucher")}
            onCronograma={() => setView("cronograma")}
            onPlano={() => setView("plano")}
            onVale={() => setView("vale")}
            onComanda={() => setView("comanda")}
            tienePlantilla={!!floorplans[selectedEvent.salon]}
          />
        )}

        {view === "fichaCompleta" && selectedEvent && (
          <FichaCompleta ev={selectedEvent} jefeAreas={jefeAreas} isAdmin={isAdmin}
            onBack={() => setView("ficha")}
            onEdit={() => { setEditingEvent(selectedEvent); setView("nuevo"); }}
            onVaucher={() => setView("vaucher")}
            onCronograma={() => setView("cronograma")}
            onPlano={() => setView("plano")}
            onVale={() => setView("vale")}
            onComanda={() => setView("comanda")}
            tienePlantilla={!!floorplans[selectedEvent.salon]}
          />
        )}

        {view === "vaucher" && selectedEvent && <Voucher ev={selectedEvent} onBack={() => setView("ficha")} />}
        {view === "vale" && selectedEvent && <Vale ev={selectedEvent} onBack={() => setView("ficha")} />}
        {view === "comanda" && selectedEvent && <Comanda ev={selectedEvent} onBack={() => setView("ficha")} />}
        {view === "cronograma" && selectedEvent && <Cronograma ev={selectedEvent} onBack={() => setView("ficha")} />}
        {view === "plano" && selectedEvent && (
          <PlanoEditor
            salon={selectedEvent.salon}
            nombreEvento={selectedEvent.nombreEvento}
            fecha={selectedEvent.fecha}
            plantilla={floorplans[selectedEvent.salon]}
            dibujoInicial={selectedEvent.planoDibujo}
            notasIniciales={selectedEvent.planoNotas}
            onGuardar={handleSavePlano}
            onBack={() => setView("ficha")}
            isAdmin={isAdmin}
          />
        )}

        {view === "estadisticas" && <Stats events={events} />}

        {view === "presupuesto" && isAdmin && (
          <ListaPresupuestos
            presupuestos={presupuestos}
            onNuevo={() => { setPresupuestoEditando(null); setView("presupuestoForm"); }}
            onAbrir={(p) => { setPresupuestoSeleccionado(p); setView("presupuestoDoc"); }}
            onEditar={(p) => { setPresupuestoEditando(p); setView("presupuestoForm"); }}
            onEliminar={handleDeletePresupuesto}
          />
        )}

        {view === "presupuestoForm" && isAdmin && (
          <PresupuestoForm
            initial={presupuestoEditando}
            onSave={handleSavePresupuesto}
            onCancel={() => setView(presupuestoEditando ? "presupuestoDoc" : "presupuesto")}
          />
        )}

        {view === "presupuestoDoc" && isAdmin && presupuestoSeleccionado && (
          <PresupuestoDocumento
            p={presupuestoSeleccionado}
            onBack={() => setView("presupuesto")}
            onEdit={() => { setPresupuestoEditando(presupuestoSeleccionado); setView("presupuestoForm"); }}
          />
        )}

        {view === "buscar" && (
          <BuscadorEventos events={events} onOpenEvent={(e) => { setSelectedEvent(e); setView("ficha"); }} />
        )}

        {view === "nuevo" && isAdmin && (
          <EventForm
            initial={editingEvent ? { ...editingEvent } : (newEventDate ? blankEvent(newEventDate) : null)}
            tarifas={tarifas}
            onSave={handleSaveEvent}
            onCancel={() => setView(editingEvent ? "ficha" : "calendario")}
            onDelete={handleDeleteEvent}
          />
        )}

        {view === "ajustes" && isAdmin && (
          <Settings
            jefeAreas={jefeAreas} setJefeAreas={setJefeAreas}
            tarifas={tarifas} setTarifas={setTarifas}
            floorplans={floorplans} setFloorplans={setFloorplans}
            events={events} onImportEvents={(nuevos) => setEvents(prev => [...prev, ...nuevos])}
            onMarkPastAsPaid={handleMarkPastAsPaid}
          />
        )}
      </main>

      {toast && (
        <div className="no-print" style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: INK, color: "#fff", padding: "10px 20px", borderRadius: 8,
          fontFamily: FONT_BODY, fontSize: 13.5, boxShadow: "0 4px 16px rgba(0,0,0,0.28)", zIndex: 1000,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
