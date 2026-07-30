import React, { useEffect, useMemo, useRef, useState } from "react";
import { loadShared, saveShared } from "./lib/supabaseStorage.js";
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
import { Settings } from "./components/Settings.jsx";

export default function App() {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState(() => {
    try { return localStorage.getItem("plannerRole") || null; } catch { return null; }
  });
  const [pin, setPin] = useState(null);
  const [proximoVale, setProximoVale] = useState(1);
  const [events, setEvents] = useState([]);
  const [jefeAreas, setJefeAreas] = useState({ telefono: "" });
  const [tarifas, setTarifas] = useState({});
  const [floorplans, setFloorplans] = useState({});
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
    return lista
      .filter(a => !alertasOcultas.includes(a.id))
      .sort((a, b) => (a.urgente === b.urgente ? 0 : a.urgente ? -1 : 1));
  }, [events, alertasOcultas]);

  useEffect(() => {
    (async () => {
      const [ev, jefe, cfg, planos, tar, ocultas] = await Promise.all([
        loadShared("eventos", []),
        loadShared("jefeAreas", { telefono: "" }),
        loadShared("config", { pin: null, proximoVale: 1 }),
        loadShared("planos", {}),
        loadShared("tarifas", {}),
        loadShared("alertasOcultas", []),
      ]);
      setEvents(ev); setJefeAreas(jefe); setPin(cfg.pin); setProximoVale(cfg.proximoVale || 1); setFloorplans(planos); setTarifas(tar); setAlertasOcultas(ocultas);
      setReady(true);
    })();
  }, []);

  useEffect(() => { if (ready) saveShared("eventos", events); }, [events, ready]);
  useEffect(() => { if (ready) saveShared("jefeAreas", jefeAreas); }, [jefeAreas, ready]);
  useEffect(() => { if (ready) saveShared("planos", floorplans); }, [floorplans, ready]);
  useEffect(() => { if (ready) saveShared("tarifas", tarifas); }, [tarifas, ready]);
  // Las notificaciones que la persona ya descartó (tocando la "×") se guardan acá, para que
  // no vuelvan a aparecer cada vez que se abre la app.
  useEffect(() => { if (ready) saveShared("alertasOcultas", alertasOcultas); }, [alertasOcultas, ready]);

  const setPinIfEmpty = (p) => { setPin(p); saveShared("config", { pin: p, proximoVale }); };

  const isAdmin = role === "admin";

  useEffect(() => {
    try {
      if (role) localStorage.setItem("plannerRole", role);
      else localStorage.removeItem("plannerRole");
    } catch {}
  }, [role]);

  useEffect(() => { if (role === "guest") setView("semana"); }, [role]);

  const handleSaveEvent = (ev) => {
    // El N° de vale es siempre automático: se asigna una sola vez, la primera vez que
    // se guarda la ficha (si ya tenía uno asignado, se respeta y no se vuelve a tocar).
    let finalEv = ev;
    if (!ev.vale?.numero) {
      const numero = formatValeNumero(proximoVale);
      finalEv = { ...ev, vale: { ...ev.vale, numero } };
      setProximoVale(proximoVale + 1);
      saveShared("config", { pin, proximoVale: proximoVale + 1 });
    }
    setEvents(prev => {
      const exists = prev.some(e => e.id === finalEv.id);
      return exists ? prev.map(e => e.id === finalEv.id ? finalEv : e) : [...prev, finalEv];
    });
    setSelectedEvent(finalEv); setEditingEvent(null); setNewEventDate(null); setView("ficha");
    showToast("Ficha guardada ✓");
  };
  const handleDeleteEvent = (id) => {
    if (!window.confirm("¿Seguro que querés eliminar este evento? Esta acción no se puede deshacer.")) return;
    setEvents(prev => prev.filter(e => e.id !== id));
    setSelectedEvent(null); setEditingEvent(null); setView("calendario");
    showToast("Evento eliminado");
  };
  // Herramienta de Ajustes → Notificaciones: marca de una sola vez todos los eventos que ya
  // pasaron y siguen sin pago total (típicamente eventos viejos importados del calendario que
  // no se van a actualizar a mano). No toca eventos de hoy o futuros.
  const handleMarkPastAsPaid = () => {
    const hoyISO = toISO(new Date());
    const cantidad = events.filter(e => (e.fechaFin || e.fecha) < hoyISO && e.estadoPago !== "total").length;
    if (cantidad === 0) return;
    if (!window.confirm(`¿Marcar ${cantidad} evento(s) pasados como "pagado en su totalidad"? Esta acción no se puede deshacer fácilmente.`)) return;
    setEvents(prev => prev.map(e => ((e.fechaFin || e.fecha) < hoyISO && e.estadoPago !== "total") ? { ...e, estadoPago: "total" } : e));
    showToast(`${cantidad} evento(s) marcados como pagados ✓`);
  };
  const handleSavePlano = (dataUrl) => {
    setEvents(prev => prev.map(e => e.id === selectedEvent.id ? { ...e, planoDibujo: dataUrl } : e));
    setSelectedEvent(prev => ({ ...prev, planoDibujo: dataUrl }));
  };

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
          <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.08em" }}>{isAdmin ? "Organizadora" : "Invitado · solo lectura"}</span>
          <button onClick={() => setRole(null)} style={{ fontFamily: FONT_BODY, fontSize: 12, color: PAPER, opacity: 0.7 }}>Salir</button>
        </div>
      </header>

      <nav className="no-print px-5 py-3 flex gap-4 flex-wrap" style={{ background: CARD, borderBottom: `1px solid ${LINE}` }}>
        {(isAdmin
          ? [["calendario", "Mes"], ["semana", "Semana"], ["dia", "Día"], ["buscar", "Buscar"], ["estadisticas", "Estadísticas"], ["ajustes", "Ajustes"]]
          : [["calendario", "Mes"], ["semana", "Semana"], ["dia", "Día"], ["buscar", "Buscar"], ["estadisticas", "Estadísticas"]]
        ).map(([key, label]) => (
          <button key={key} onClick={() => setView(key)} className="text-sm font-medium pb-1"
            style={{ fontFamily: FONT_BODY, color: view === key ? INK : MUTED, borderBottom: view === key ? `2px solid ${ACCENT}` : "2px solid transparent" }}>
            {label}
          </button>
        ))}
      </nav>

      <main className="max-w-3xl mx-auto px-5 py-6">
        {isAdmin && alertas.length > 0 && (
          <div className="no-print flex flex-col gap-2 mb-5">
            <div className="flex justify-end">
              <button
                onClick={() => setAlertasOcultas(prev => [...prev, ...alertas.map(a => a.id)])}
                className="text-xs font-medium"
                style={{ fontFamily: FONT_BODY, color: MUTED, textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}
              >
                Borrar todas ({alertas.length})
              </button>
            </div>
            {alertas.map(a => (
              <div key={a.id} className="p-3 rounded flex items-start justify-between gap-3"
                style={{ background: a.urgente ? PENDIENTE_BG : PARCIAL_BG, border: `1px solid ${a.urgente ? PENDIENTE : PARCIAL}` }}>
                <button
                  onClick={() => { setSelectedEvent(a.ev); setView("ficha"); }}
                  className="text-left flex-1"
                  style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, background: "none", border: "none", cursor: "pointer" }}
                >
                  {a.texto}
                </button>
                <div className="flex items-center gap-2">
                  {a.id.startsWith("pago-") && (
                    <button
                      onClick={() => setEvents(prev => prev.map(e => e.id === a.ev.id ? { ...e, estadoPago: "total" } : e))}
                      className="text-xs px-2 py-1 rounded"
                      style={{ fontFamily: FONT_BODY, color: INK, border: `1px solid ${LINE}`, background: CARD, whiteSpace: "nowrap" }}
                    >
                      Marcar pagado
                    </button>
                  )}
                  <button onClick={() => setAlertasOcultas(prev => [...prev, a.id])} style={{ color: MUTED, fontSize: 16, lineHeight: 1, fontFamily: FONT_BODY }}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}

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
            plantilla={floorplans[selectedEvent.salon]}
            dibujoInicial={selectedEvent.planoDibujo}
            onGuardar={handleSavePlano}
            onBack={() => setView("ficha")}
            isAdmin={isAdmin}
          />
        )}

        {view === "estadisticas" && <Stats events={events} />}

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
