import { fechasEvento, fmtFecha, toISO, uid } from "./helpers.js";

export function blankEvent(fecha) {
  return {
    id: uid(), fecha: fecha || toISO(new Date()), fechaFin: "", salon: "", salonOtro: "",
    horaInicio: "09:00", horaFin: "13:00", horaArmado: "", horaDesarme: "",
    horaInicioManual: false, horaFinManual: false, horaArmadoManual: false, horaDesarmeManual: false,
    nombreEvento: "",
    personas: "", servicio: "", incluye: [], tecnica: [],
    formatoArmado: "",
    colorEvento: "",
    // Tarifa por día: cada fecha del evento tiene su propio tipo ("completa" | "media" | "cortesia").
    // Se sincroniza automáticamente con la duración del evento vía sincronizarDiasTarifa().
    diasTarifa: [], // [{ fecha: "2026-08-29", tipo: "completa" }, ...]
    tarifaEspecialActiva: false, tarifaEspecial: "",
    valorSalon: "", // snapshot histórico del valor total de salón aplicado al momento de guardar
    // Salón adicional: para cuando la empresa contrata dos salones en simultáneo en el mismo
    // evento (ej: una sala chica para directivos + un salón grande para capacitación).
    salonAdicionalActivo: false, salonAdicional: "", salonAdicionalOtro: "",
    diasTarifaAdicional: [],
    tarifaEspecialActivaAdicional: false, tarifaEspecialAdicional: "",
    valorSalonAdicional: "", // snapshot histórico del valor del salón adicional
    empresaOrganiza: "", empresaContrata: "", empresaPaga: "", empresaFactura: "",
    cuit: "", razonSocial: "", direccionFiscal: "", tipoFactura: "",
    contactoNombre: "", contactoVia: "", // legado, se migra a `contactos` al abrir la ficha
    contactos: [{ nombre: "", via: "" }],
    esHuesped: false,
    huespedes: [],
    estadoPago: "pendiente", adelanto: "", comprobanteTexto: "", comprobanteLink: "",
    retenciones: "no", // legado, se migra a `facturas` al abrir la ficha
    facturas: [],
    itemsPresupuesto: [],
    // Vale: documento de Administración. Tiene que coincidir con el N° de factura,
    // cuántos salones se vendieron y cuántos cubiertos, discriminados por tipo.
    // Cada tipo puede llevar una `fecha` opcional (ej: coffee break del viernes 29);
    // si queda vacía, se entiende que aplica a todo el evento.
    vale: { numero: "", salonesVendidos: "1", tipos: [] },
    // Comanda: documento de Cocina. Detalle de invitados/horario/salón/cronograma
    // + qué hay que cocinar (ítems con su detalle, también con `fecha` opcional) + catering contratado.
    comanda: { cubiertos: "", detalle: "", caterer: "", items: [] },
    cronograma: [],
    planoDibujo: "",
    notificarJefeAreas: false,
    notas: "",
    controlInterno: "",
    recordatorios: [], // avisos personalizados: [{ id, texto, diasAntes }]
  };
}

const ETIQUETAS_TARIFA = { completa: "tarifa completa", media: "media tarifa", cortesia: "cortesía" };
export function etiquetaTarifa(tipo) {
  return ETIQUETAS_TARIFA[tipo] || ETIQUETAS_TARIFA.completa;
}

// Dado el tipo de un día ("completa"/"media"/"cortesia") y el tarifario del salón
// ({ completa, media }), devuelve el valor final de ese día. Cortesía siempre es $0.
export function valorTarifaDia(tipo, tarifaSalon) {
  if (tipo === "cortesia") return 0;
  if (!tarifaSalon) return 0;
  return tipo === "media" ? (Number(tarifaSalon.media) || 0) : (Number(tarifaSalon.completa) || 0);
}

// Sincroniza el array de tarifas por día con las fechas reales del evento: si el evento
// se alarga o se acorta, agrega o saca días conservando el tipo ya elegido para las fechas
// que se mantienen. Los días nuevos entran por defecto en "completa".
export function sincronizarDiasTarifa(fechas, diasTarifaPrevios) {
  const previos = diasTarifaPrevios || [];
  return fechas.map(fecha => {
    const existente = previos.find(d => d.fecha === fecha);
    return { fecha, tipo: existente?.tipo || "completa" };
  });
}

// Arma las filas de cotización de un salón (principal o adicional), día por día.
// Si hay tarifa especial activa, se respeta el comportamiento histórico: un valor único
// que se cobra una vez por cada día del evento.
function filasSalon(ev, tarifas, { adicional = false } = {}) {
  const fechas = fechasEvento(ev);
  const salonKey = adicional ? (ev.salonAdicionalActivo ? ev.salonAdicional : "") : ev.salon;
  if (!salonKey || !fechas.length) return [];

  const especialActiva = adicional ? ev.tarifaEspecialActivaAdicional : ev.tarifaEspecialActiva;
  const especialValor = adicional ? ev.tarifaEspecialAdicional : ev.tarifaEspecial;
  const prefijo = adicional ? "auto-salon-adicional" : "auto-salon";
  const etiquetaSalon = adicional ? `Salón adicional (${salonKey})` : `Salón (${salonKey})`;

  if (especialActiva) {
    const valor = Number(especialValor) || 0;
    return [{
      id: `${prefijo}-especial`,
      detalle: `${etiquetaSalon} — tarifa especial${fechas.length > 1 ? ` (${fechas.length} días)` : ""}`,
      cantidad: fechas.length, valorUnitario: valor, auto: true,
    }];
  }

  const tarifaSalon = tarifas?.[salonKey];
  const diasPrevios = adicional ? (ev.diasTarifaAdicional || []) : (ev.diasTarifa || []);
  const dias = sincronizarDiasTarifa(fechas, diasPrevios);

  return dias.map((d, idx) => ({
    id: `${prefijo}-dia-${idx}`,
    detalle: `${etiquetaSalon} — ${fmtFecha(d.fecha)} (${etiquetaTarifa(d.tipo)})`,
    cantidad: 1,
    valorUnitario: valorTarifaDia(d.tipo, tarifaSalon),
    auto: true,
  }));
}

// Agrupa ítems (del Vale o de la Comanda) según la fecha del evento a la que corresponden.
// Los que no tienen `fecha` cargada se devuelven aparte, como "generales" del evento entero
// (así las fichas viejas, sin discriminar por día, se siguen viendo igual que antes).
export function agruparPorDia(items, ev) {
  const fechas = fechasEvento(ev);
  const conFecha = fechas.map(fecha => ({
    fecha,
    items: (items || []).filter(it => it.fecha === fecha),
  }));
  const generales = (items || []).filter(it => !it.fecha);
  return { conFecha, generales };
}

// true si ya están cargados los 4 datos fiscales básicos para poder facturar.
export function datosFiscalesCompletos(ev) {
  return !!(ev?.cuit?.trim() && ev?.razonSocial?.trim() && ev?.direccionFiscal?.trim() && ev?.tipoFactura?.trim());
}

// true si ya están definidos quién organiza, quién contrata, quién paga y quién factura.
// Se usa para no mostrar ese bloque en la Ficha/Voucher hasta que esté completo.
export function datosResponsablesCompletos(ev) {
  return !!(ev?.empresaOrganiza?.trim() && ev?.empresaContrata?.trim() && ev?.empresaPaga?.trim() && ev?.empresaFactura?.trim());
}

// Calcula el total del evento a partir de las filas automáticas de salón (día por día,
// según diasTarifa/diasTarifaAdicional o la tarifa especial) más los ítems del Vale
// (comida) y los ítems sueltos cargados a mano. Los precios que carga Carmela (salón e
// ítems) son SIEMPRE precios finales, con IVA ya incluido (así se los cobra al cliente):
// el programa no suma IVA, lo DISCRIMINA hacia atrás a partir de ese total, igual que la
// factura oficial del hotel (neto = total / 1.21, IVA = total - neto).
//
// `tarifas` es el tarifario de Ajustes ({ [salon]: { completa, media } }); hace falta para
// poder calcular el valor de cada día. Mientras se está editando el formulario (antes de
// guardar) siempre hay que pasarlo, porque ev.valorSalon todavía no está actualizado.
export function totalItemsEvento(ev, tarifas) {
  const items = ev.itemsPresupuesto || [];
  const filaSalon = filasSalon(ev, tarifas, { adicional: false });
  const filaSalonAdicional = filasSalon(ev, tarifas, { adicional: true });
  // Los ítems cargados en el Vale (comida: coffee break, almuerzo, cena, etc.) se suman
  // automáticamente acá, igual que el salón — así no hace falta cargarlos dos veces
  // (una en el Vale y otra en la cotización). Si tienen `fecha`, esa fecha queda reflejada
  // en el detalle para poder distinguir qué corresponde a cada día del evento.
  const filasVale = (ev.vale?.tipos || []).map(t => ({
    id: `auto-vale-${t.id}`,
    detalle: t.fecha ? `${t.tipo} — ${fmtFecha(t.fecha)}` : t.tipo,
    cantidad: Number(t.cantidad) || 0, valorUnitario: Number(t.valorUnitario) || 0, auto: true,
  }));
  const filas = [...filaSalon, ...filaSalonAdicional, ...filasVale, ...items];
  const totalConIva = filas.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.valorUnitario) || 0), 0);
  const sinIva = totalConIva / 1.21;
  const iva = totalConIva - sinIva;
  const totalSalonPrincipal = filaSalon.reduce((s, f) => s + f.valorUnitario, 0);
  const totalSalonAdicional = filaSalonAdicional.reduce((s, f) => s + f.valorUnitario, 0);
  return { filas, sinIva, iva, totalConIva, totalSalonPrincipal, totalSalonAdicional };
}
