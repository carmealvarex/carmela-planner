import { fechasEvento, toISO, uid } from "./helpers.js";

// Un "día" dentro de un evento de varios días: tiene su propio salón, su propia tarifa
// (completa / media / cortesía) y su propia comida (vale + comanda), independiente de los
// demás días del mismo evento. Se usa SOLO cuando el evento dura más de un día
// (ver esMultiDia en helpers.js); los eventos de un solo día siguen usando los campos
// "planos" de siempre (ev.salon, ev.tarifaTipo, ev.vale, ev.comanda) sin tocar nada.
export function blankDia(fecha, base) {
  return {
    fecha,
    salon: base?.salon || "", salonOtro: base?.salonOtro || "",
    tarifaTipo: base?.tarifaTipo || "completa",
    tarifaEspecialActiva: false, tarifaEspecial: "",
    valorSalon: "", // snapshot histórico del valor de salón aplicado ese día en particular
    salonAdicionalActivo: base?.salonAdicionalActivo || false, salonAdicional: base?.salonAdicional || "", salonAdicionalOtro: base?.salonAdicionalOtro || "",
    tarifaTipoAdicional: base?.tarifaTipoAdicional || "completa",
    tarifaEspecialActivaAdicional: false, tarifaEspecialAdicional: "",
    valorSalonAdicional: "",
    // Comida de ESE día en particular (equivalente a vale.tipos, pero por día).
    valeTipos: [],
    // Ítems de cocina de ESE día en particular (equivalente a comanda.items, pero por día).
    comandaItems: [],
  };
}

// Mantiene ev.dias sincronizado con el rango de fechas del evento (fecha → fechaFin):
// agrega días nuevos (clonando salón/tarifa del último día existente, para no tener que
// cargarlo de cero) y quita los que ya no correspondan si se acorta el rango.
// No hace nada si el evento es de un solo día.
export function sincronizarDias(ev) {
  const fechas = fechasEvento(ev);
  if (fechas.length < 2) return ev.dias || [];
  const actuales = ev.dias || [];
  const porFecha = Object.fromEntries(actuales.map(d => [d.fecha, d]));
  const ultimo = actuales[actuales.length - 1];
  return fechas.map(f => porFecha[f] || blankDia(f, ultimo || ev));
}

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
    // Numeración correlativa de descarga de documentos (voucher/ficha/comanda), asignada una
    // sola vez al guardar la ficha por primera vez, igual que el N° de vale — para que el
    // nombre del archivo descargado sea siempre el mismo y no se pise con otro evento.
    numeracion: { voucher: "", ficha: "", comanda: "" },
    // Comanda: documento de Cocina. Detalle de invitados/horario/salón/cronograma
    // + qué hay que cocinar (ítems con su detalle) + catering contratado.
    comanda: { cubiertos: "", detalle: "", caterer: "", items: [] },
    // Desglose por día, solo para eventos de varios días (ver blankDia/sincronizarDias arriba).
    // Vacío en eventos de un solo día: en ese caso se usan los campos planos de siempre.
    dias: [],
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

  // Evento de varios días con desglose cargado día por día: cada día suma su propio salón
  // (con su propia tarifa/cortesía), su salón adicional si tiene, y su propia comida (vale).
  // No se usa overrideSalon acá (eso es solo para previsualizar mientras se edita un evento
  // de un solo día): en modo por-día cada fila ya trae su valor congelado.
  if (dias > 1 && (ev.dias || []).length) {
    const filasDias = ev.dias.flatMap(d => {
      const filas = [];
      if (d.salon) {
        filas.push({ id: `auto-salon-${d.fecha}`, detalle: `Salón (${d.salon}) — ${fmtFechaCortaSeguro(d.fecha)}`, cantidad: 1, valorUnitario: Number(d.valorSalon) || 0, auto: true });
      }
      if (d.salonAdicionalActivo && d.salonAdicional) {
        filas.push({ id: `auto-salon-adic-${d.fecha}`, detalle: `Salón adicional (${d.salonAdicional}) — ${fmtFechaCortaSeguro(d.fecha)}`, cantidad: 1, valorUnitario: Number(d.valorSalonAdicional) || 0, auto: true });
      }
      (d.valeTipos || []).forEach(t => {
        filas.push({ id: `auto-vale-${d.fecha}-${t.id}`, detalle: `${t.tipo} — ${fmtFechaCortaSeguro(d.fecha)}`, cantidad: Number(t.cantidad) || 0, valorUnitario: Number(t.valorUnitario) || 0, auto: true });
      });
      return filas;
    });
    const filas = [...filasDias, ...items];
    const totalConIva = filas.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.valorUnitario) || 0), 0);
    const sinIva = totalConIva / 1.21;
    const iva = totalConIva - sinIva;
    return { filas, sinIva, iva, totalConIva };
  }

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

// Formato corto de fecha para las filas automáticas de la cotización (evita import circular
// con helpers.js para fmtFechaCorta, así que se resuelve acá mismo con la misma lógica).
function fmtFechaCortaSeguro(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}
