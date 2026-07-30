import { addDays, fromISO, pad, toISO, uid } from "./helpers.js";

export function unfoldICS(text) {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}
export function parseICSDate(val) {
  if (!val) return { iso: null, time: null };
  if (/^\d{8}$/.test(val)) {
    return { iso: `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`, time: null };
  }
  const m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (m) {
    const [, y, mo, d, h, mi, s, z] = m;
    if (z === "Z") {
      // Google Calendar exporta en UTC. Argentina es UTC-3 todo el año (sin horario de verano).
      const utcMs = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
      const arg = new Date(utcMs - 3 * 60 * 60 * 1000);
      return {
        iso: `${arg.getUTCFullYear()}-${pad(arg.getUTCMonth() + 1)}-${pad(arg.getUTCDate())}`,
        time: `${pad(arg.getUTCHours())}:${pad(arg.getUTCMinutes())}`,
      };
    }
    return { iso: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
  }
  return { iso: null, time: null };
}
export function parseICS(text) {
  const unfolded = unfoldICS(text);
  const blocks = unfolded.split("BEGIN:VEVENT").slice(1);
  return blocks.map(block => {
    const body = block.split("END:VEVENT")[0];
    const getField = (name) => {
      const re = new RegExp(name + "(?:;[^:\\n]*)?:(.*)");
      const m = body.match(re);
      return m ? m[1].trim() : "";
    };
    const clean = (s) => s.replace(/\\,/g, ",").replace(/\\n/gi, " ").replace(/\\;/g, ";");
    const start = parseICSDate(getField("DTSTART"));
    const end = parseICSDate(getField("DTEND"));
    // Los eventos de todo el día en Google Calendar exportan DTEND como el día siguiente al último
    // (exclusivo), así que si hay hora, restamos un día para el fechaFin cuando corresponda a eventos sin horario.
    let fechaFin = "";
    if (end.iso && start.iso && end.iso > start.iso) {
      if (!start.time && !end.time) {
        // todo el día: DTEND es exclusivo, restamos un día
        const finReal = addDays(fromISO(end.iso), -1);
        fechaFin = toISO(finReal) > start.iso ? toISO(finReal) : "";
      } else {
        fechaFin = end.iso;
      }
    }
    return {
      uid: getField("UID") || uid(),
      summary: clean(getField("SUMMARY")),
      location: clean(getField("LOCATION")),
      description: clean(getField("DESCRIPTION")),
      fecha: start.iso,
      fechaFin,
      horaInicio: start.time || "09:00",
      horaFin: end.time || "13:00",
    };
  }).filter(e => e.fecha);
}

export async function extractICSFromZip(file) {
  const buf = await file.arrayBuffer();
  const data = new DataView(buf);
  const bytes = new Uint8Array(buf);

  const EOCD_SIG = 0x06054b50;
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (data.getUint32(i, true) === EOCD_SIG) { eocdOffset = i; break; }
  }
  if (eocdOffset === -1) throw new Error("No pude leer la estructura del .zip.");

  const cdOffset = data.getUint32(eocdOffset + 16, true);
  const entryCount = data.getUint16(eocdOffset + 10, true);

  let p = cdOffset;
  for (let i = 0; i < entryCount; i++) {
    const sig = data.getUint32(p, true);
    if (sig !== 0x02014b50) throw new Error("El .zip tiene un formato inesperado.");
    const method = data.getUint16(p + 10, true);
    const compSize = data.getUint32(p + 20, true);
    const fnameLen = data.getUint16(p + 28, true);
    const extraLen = data.getUint16(p + 30, true);
    const commentLen = data.getUint16(p + 32, true);
    const localOffset = data.getUint32(p + 42, true);
    const fname = new TextDecoder().decode(bytes.slice(p + 46, p + 46 + fnameLen));

    if (fname.toLowerCase().endsWith(".ics")) {
      const lfhFnameLen = data.getUint16(localOffset + 26, true);
      const lfhExtraLen = data.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + lfhFnameLen + lfhExtraLen;
      const compData = bytes.slice(dataStart, dataStart + compSize);

      if (method === 0) return new TextDecoder("utf-8").decode(compData);
      if (method === 8) {
        if (typeof DecompressionStream === "undefined") {
          throw new Error("Tu navegador no puede descomprimir el .zip automáticamente. Actualizalo o extraé el .ics manualmente antes de subirlo.");
        }
        const ds = new DecompressionStream("deflate-raw");
        const stream = new Blob([compData]).stream().pipeThrough(ds);
        const inflated = new Uint8Array(await new Response(stream).arrayBuffer());
        return new TextDecoder("utf-8").decode(inflated);
      }
      throw new Error("El archivo dentro del .zip usa una compresión no soportada.");
    }
    p += 46 + fnameLen + extraLen + commentLen;
  }
  throw new Error("No encontré ningún archivo .ics dentro del .zip.");
}
