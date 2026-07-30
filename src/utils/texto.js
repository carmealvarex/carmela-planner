import { MESES } from "../constants.js";
import { addDays, fmtMoney, fmtRangoFecha, fromISO } from "./helpers.js";
import { totalItemsEvento } from "./eventHelpers.js";

export function estadoTexto(ev) {
  if (ev.estadoPago === "total") return "Pago total ✅";
  if (ev.estadoPago === "parcial" || ev.estadoPago === "sena") {
    const { totalConIva } = totalItemsEvento(ev);
    const pagado = Number(ev.adelanto) || 0;
    const falta = totalConIva - pagado;
    const etiqueta = ev.estadoPago === "sena" ? "Seña" : "Pago parcial — seña/adelanto";
    return `${etiqueta} $ ${fmtMoney(pagado)} de $ ${fmtMoney(totalConIva)} · Falta facturar $ ${fmtMoney(falta)} 🟡`;
  }
  return "Pendiente de pago ⏳";
}

export function checklistTexto(ev) {
  const items = [];
  if (ev.incluye?.length) items.push(`Incluye: ${ev.incluye.join(", ")}`);
  if (ev.tecnica?.length) items.push(`Técnica: ${ev.tecnica.join(", ")}`);
  return items.join(" · ");
}

export function textoEvento(ev) {
  const lineas = [];
  lineas.push(`*Nombre de evento:* ${ev.nombreEvento || ev.servicio || "(sin nombre)"}`);
  lineas.push(`Horario: ${ev.horaInicio || "--:--"} a ${ev.horaFin || "--:--"}`);
  lineas.push(`Fecha: ${fmtRangoFecha(ev)}`);
  lineas.push(`Cantidad de personas: ${ev.personas || "-"}`);
  lineas.push(`Salón: ${ev.salon || "(sin definir)"}`);
  if (ev.servicio) lineas.push(`Concepto: ${ev.servicio}`);
  if (ev.tarifaTipo) lineas.push(`Tarifa: ${ev.tarifaTipo === "completa" ? "Completa" : "Media tarifa"}`);
  const check = checklistTexto(ev);
  if (check) lineas.push(check);
  if (ev.formatoArmado) lineas.push(`Formato de armado: ${ev.formatoArmado}`);
  const empresas = [];
  if (ev.empresaOrganiza) empresas.push(`Organiza: ${ev.empresaOrganiza}`);
  if (ev.empresaContrata) empresas.push(`Contrata: ${ev.empresaContrata}`);
  if (ev.empresaPaga) empresas.push(`Paga: ${ev.empresaPaga}`);
  if (empresas.length) lineas.push(empresas.join(" / "));
  if (ev.cronograma?.length) {
    lineas.push("Cronograma:");
    ev.cronograma.slice().sort((a, b) => (a.hora || "").localeCompare(b.hora || "")).forEach(c => {
      lineas.push(`  ${c.hora || "--:--"} — ${c.detalle || ""}`);
    });
  }
  if (ev.notas) lineas.push(`Notas: ${ev.notas}`);
  lineas.push("");
  lineas.push(`Estado de pago: ${estadoTexto(ev)}`);
  return lineas.join("\n");
}

export function textoSemana(events, weekStart) {
  const desde = weekStart, hasta = addDays(weekStart, 6);
  const enSemana = events
    .filter(e => { const fi = fromISO(e.fecha), ff = e.fechaFin && e.fechaFin > e.fecha ? fromISO(e.fechaFin) : fi; return ff >= desde && fi <= hasta; })
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.horaInicio || "").localeCompare(b.horaInicio || ""));
  const header = `*Semana del ${desde.getDate()} al ${hasta.getDate()} de ${MESES[hasta.getMonth()]}*\n`;
  if (!enSemana.length) return header + "\nSin eventos cargados esta semana.";
  return header + "\n" + enSemana.map(textoEvento).join("\n—\n");
}

export function textoJefeAreas(ev) {
  const base = textoEvento(ev);
  return `📌 *Aviso para Jefe de Áreas*\n\n${base}\n\nPor favor coordinar con los sectores correspondientes.`;
}

export function waLink(telefono, texto) {
  const t = encodeURIComponent(texto);
  if (telefono && telefono.trim()) {
    const num = telefono.replace(/[^\d]/g, "");
    return `https://wa.me/${num}?text=${t}`;
  }
  return `https://wa.me/?text=${t}`;
}
