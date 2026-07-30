import { fechasEvento, toISO, uid } from "./helpers.js";

export function blankEvent(fecha) {
  return {
    id: uid(), fecha: fecha || toISO(new Date()), fechaFin: "", salon: "", salonOtro: "",
    horaInicio: "09:00", horaFin: "13:00", horaArmado: "", horaDesarme: "",
    horaInicioManual: false, horaFinManual: false, horaArmadoManual: false, horaDesarmeManual: false,
    nombreEvento: "",
    personas: "", servicio: "", incluye: [], tecnica: [],
    formatoArmado: "",
    colorEvento: "",
    tarifaTipo: "completa",
    tarifaEspecialActiva: false, tarifaEspecial: "",
    valorSalon: "", // snapshot histórico del valor de salón aplicado al momento de guardar
    // Salón adicional: para cuando la empresa contrata dos salones en simultáneo en el mismo
    // evento (ej: una sala chica para directivos + un salón grande para capacitación).
    salonAdicionalActivo: false, salonAdicional: "", salonAdicionalOtro: "",
    tarifaTipoAdicional: "completa",
    tarifaEspecialActivaAdicional: false, tarifaEspecialAdicional: "",
    valorSalonAdicional: "", // snapshot histórico del valor del salón adicional
    empresaOrganiza: "", empresaContrata: "", empresaPaga: "",
    cuit: "",
    razonSocial: "", direccionFiscal: "", tipoFactura: "", condicionIva: "",
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
    vale: { numero: "", salonesVendidos: "1", tipos: [] },
    // Comanda: documento de Cocina. Detalle de invitados/horario/salón/cronograma
    // + qué hay que cocinar (ítems con su detalle) + catering contratado.
    comanda: { cubiertos: "", detalle: "", caterer: "", items: [] },
    cronograma: [],
    planoDibujo: "",
    notificarJefeAreas: false,
    notas: "",
    controlInterno: "",
    recordatorios: [], // avisos personalizados: [{ id, texto, diasAntes }]
  };
}

// Calcula el total del evento a partir de la fila automática de salón (congelada en valorSalon)
// más los ítems de comida/otros cargados a mano. Los precios que carga Carmela (salón e ítems)
// son SIEMPRE precios finales, con IVA ya incluido (así se los cobra al cliente) — el programa
// no suma IVA, lo DISCRIMINA hacia atrás a partir de ese total, igual que la factura oficial
// del hotel (neto = total / 1.21, IVA = total - neto).
// overrideSalon se usa mientras se está editando el formulario (antes de guardar), porque
// ahí ev.valorSalon todavía no se actualizó con el valor vigente de la tarifa/tarifa especial.
// Puede ser un número (compatibilidad vieja, solo salón principal) o un objeto
// { principal, adicional } para previsualizar también el salón adicional en edición.
// La cantidad del salón (y del salón adicional, si lo hay) se calcula sola a partir de
// la cantidad de días que dura el evento (fecha → fechaFin): un evento de 2 días de salón
// carga automáticamente 2 días de tarifa, sin que haya que tocar nada a mano.
export function totalItemsEvento(ev, overrideSalon) {
  const items = ev.itemsPresupuesto || [];
  const dias = fechasEvento(ev).length;
  const overridePrincipal = overrideSalon != null && typeof overrideSalon === "object" ? overrideSalon.principal : overrideSalon;
  const overrideAdicional = overrideSalon != null && typeof overrideSalon === "object" ? overrideSalon.adicional : undefined;
  const valorSalon = overridePrincipal != null ? (Number(overridePrincipal) || 0) : (Number(ev.valorSalon) || 0);
  const detalleSalon = `Salón (${ev.salon})${dias > 1 ? ` — ${dias} días` : ""}`;
  const filaSalon = ev.salon ? [{ id: "auto-salon", detalle: detalleSalon, cantidad: dias, valorUnitario: valorSalon, auto: true }] : [];
  // Salón adicional: para cuando un mismo evento usa dos salones en simultáneo
  // (ej: una empresa contrata un salón chico para directivos y uno grande para capacitación).
  const valorSalonAdicional = overrideAdicional != null ? (Number(overrideAdicional) || 0) : (Number(ev.valorSalonAdicional) || 0);
  const detalleSalonAdicional = `Salón adicional (${ev.salonAdicional})${dias > 1 ? ` — ${dias} días` : ""}`;
  const filaSalonAdicional = ev.salonAdicional ? [{ id: "auto-salon-adicional", detalle: detalleSalonAdicional, cantidad: dias, valorUnitario: valorSalonAdicional, auto: true }] : [];
  // Los ítems cargados en el Vale (comida: coffee break, almuerzo, cena, etc.) se suman
  // automáticamente acá, igual que el salón — así no hace falta cargarlos dos veces
  // (una en el Vale y otra en la cotización).
  const filasVale = (ev.vale?.tipos || []).map(t => ({
    id: `auto-vale-${t.id}`, detalle: t.tipo, cantidad: Number(t.cantidad) || 0, valorUnitario: Number(t.valorUnitario) || 0, auto: true,
  }));
  const filas = [...filaSalon, ...filaSalonAdicional, ...filasVale, ...items];
  const totalConIva = filas.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.valorUnitario) || 0), 0);
  const sinIva = totalConIva / 1.21;
  const iva = totalConIva - sinIva;
  return { filas, sinIva, iva, totalConIva };
}
