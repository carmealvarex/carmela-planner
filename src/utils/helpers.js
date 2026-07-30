import { DIAS, MESES } from "../constants.js";

export function uid() { return Math.random().toString(36).slice(2, 10); }

export function pad(n) { return String(n).padStart(2, "0"); }
export function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function fromISO(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
export function fmtFecha(iso) {
  const d = fromISO(iso);
  return `${DIAS[(d.getDay() + 6) % 7]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
// Devuelve todas las fechas ISO que ocupa un evento (para eventos de varios días,
// ej: 14 al 18 de agosto). Si no tiene fechaFin (o es igual/anterior a fecha), es de un solo día.
export function fechasEvento(ev) {
  const dias = [];
  const inicio = fromISO(ev.fecha);
  const fin = ev.fechaFin && ev.fechaFin > ev.fecha ? fromISO(ev.fechaFin) : inicio;
  let cur = inicio;
  let guard = 0;
  while (cur <= fin && guard < 60) { // tope de seguridad: 60 días
    dias.push(toISO(cur));
    cur = addDays(cur, 1);
    guard++;
  }
  return dias;
}
export function eventoEnDia(ev, iso) {
  if (!ev.fechaFin || ev.fechaFin <= ev.fecha) return ev.fecha === iso;
  return iso >= ev.fecha && iso <= ev.fechaFin;
}
export function esMultiDia(ev) { return !!ev.fechaFin && ev.fechaFin > ev.fecha; }
// Cantidad de días entre hoy y una fecha ISO (positivo = futuro, 0 = hoy, negativo = ya pasó).
export function diasHasta(fechaISO) {
  if (!fechaISO) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const f = fromISO(fechaISO); f.setHours(0, 0, 0, 0);
  return Math.round((f - hoy) / 86400000);
}
// Formato lindo del rango de fechas: "14 al 18 de agosto" (o "30 de julio al 2 de agosto" si cruza de mes).
export function fmtRangoFecha(ev) {
  if (!esMultiDia(ev)) return fmtFecha(ev.fecha);
  const d1 = fromISO(ev.fecha), d2 = fromISO(ev.fechaFin);
  const mismodMes = d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  if (mismodMes) return `${d1.getDate()} al ${d2.getDate()} de ${MESES[d1.getMonth()]}`;
  return `${d1.getDate()} de ${MESES[d1.getMonth()]} al ${d2.getDate()} de ${MESES[d2.getMonth()]}`;
}
export function mondayOf(d) {
  const day = (d.getDay() + 6) % 7;
  const m = new Date(d);
  m.setDate(d.getDate() - day);
  return m;
}
export function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

export function horasEntre(hi, hf) {
  if (!hi || !hf) return 0;
  const [h1, m1] = hi.split(":").map(Number);
  const [h2, m2] = hf.split(":").map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

// Formato de dinero para toda la app: punto de miles, coma decimal, siempre 2 decimales.
// Ej: 54000 -> "54.000,00" · 100000 -> "100.000,00". Usar SIEMPRE esta función para
// mostrar cualquier monto (nunca .toFixed(2) ni toLocaleString sueltos), así queda
// consistente en toda la aplicación.
export function fmtMoney(n) {
  const num = Number(n);
  if (!isFinite(num)) return "0,00";
  return num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Formato de fecha corto para nombres de archivo: "29-08-2026".
export function fmtFechaCorta(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

// Limpia un texto para que sirva como parte de un nombre de archivo:
// saca espacios (los reemplaza por "_") y cualquier carácter que no sea letra/número/guion.
export function slugArchivo(s) {
  return (s || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]+/g, "");
}

export function getMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // lunes=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
