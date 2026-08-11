import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Configurá el archivo .env (ver README.md)."
  );
}

export const supabase = createClient(url || "", anonKey || "");

/* ============================================================
   Tabla esperada en Supabase (ver README.md para el SQL):

   create table kv_store (
     key   text primary key,
     value jsonb not null,
     updated_at timestamptz default now()
   );

   Todas las filas son compartidas entre todos los dispositivos
   que usen esta misma app (no hay separación por usuario).
   ============================================================ */

/* ============================================================
   loadShared devuelve { value, ok, updatedAt }:
     - ok === true  -> la lectura a Supabase funcionó (haya o no filas).
     - ok === false -> algo falló (red, timeout, permisos, etc). En este
       caso "value" trae el fallback, pero NO hay que confiar en él como
       si fuera el dato real: el llamador debe evitar guardar/sobrescribir
       cuando ok es false.
     - updatedAt -> la marca de tiempo con la que quedó guardado este
       valor en el servidor. Guardala y pasala de vuelta a saveShared
       para poder detectar si alguien más lo cambió mientras tanto
       (ver saveShared más abajo).
   ============================================================ */
export async function loadShared(key, fallback) {
  try {
    const { data, error } = await supabase
      .from("kv_store")
      .select("value, updated_at")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    return { value: data ? data.value : fallback, ok: true, updatedAt: data ? data.updated_at : null };
  } catch (e) {
    console.error("storage load error", key, e);
    return { value: fallback, ok: false, updatedAt: null };
  }
}

/* ============================================================
   saveShared(key, value, expectedUpdatedAt?)

   Si se pasa expectedUpdatedAt (la marca de tiempo que devolvió el último
   loadShared/saveShared para esa key), el guardado es "seguro": solo pisa
   el valor en el servidor si nadie lo cambió desde la última vez que lo
   leímos nosotros. Si en el medio otra computadora guardó algo, ESTE
   guardado NO se aplica (para no pisar en silencio esos cambios) y
   devuelve { conflict: true } para que quien llama decida qué hacer
   (típicamente: releer el valor más nuevo del servidor y avisarle a
   la persona en vez de perder datos calladamente).

   Si NO se pasa expectedUpdatedAt, guarda "a la fuerza" (upsert normal,
   como antes) — útil para keys donde no importa tanto un pisado
   ocasional (configuración, preferencias chicas, etc).

   Devuelve { ok, conflict, updatedAt }.
   ============================================================ */
export async function saveShared(key, value, expectedUpdatedAt) {
  const nuevaMarca = new Date().toISOString();
  try {
    if (expectedUpdatedAt) {
      const { data, error } = await supabase
        .from("kv_store")
        .update({ value, updated_at: nuevaMarca })
        .eq("key", key)
        .eq("updated_at", expectedUpdatedAt)
        .select("updated_at");
      if (error) throw error;
      if (!data || data.length === 0) {
        // 0 filas afectadas: o no existía todavía, o (mucho más probable)
        // alguien la actualizó después de que nosotros la leímos.
        return { ok: true, conflict: true, updatedAt: expectedUpdatedAt };
      }
      guardarBackup(key, value);
      return { ok: true, conflict: false, updatedAt: data[0].updated_at };
    } else {
      const { data, error } = await supabase
        .from("kv_store")
        .upsert({ key, value, updated_at: nuevaMarca })
        .select("updated_at");
      if (error) throw error;
      guardarBackup(key, value);
      return { ok: true, conflict: false, updatedAt: data?.[0]?.updated_at || nuevaMarca };
    }
  } catch (e) {
    console.error("storage save error", key, e);
    return { ok: false, conflict: false, updatedAt: expectedUpdatedAt || null };
  }
}

// Backup best-effort: si falla, no rompe el guardado principal (ya se aplicó).
async function guardarBackup(key, value) {
  try {
    await supabase.from("kv_store_backups").insert({ key, value });
    // Deja solo los ultimos 15 backups por key, para no acumular espacio infinito.
    const { data: viejos } = await supabase
      .from("kv_store_backups")
      .select("id")
      .eq("key", key)
      .order("saved_at", { ascending: false })
      .range(15, 1000);
    if (viejos && viejos.length) {
      await supabase.from("kv_store_backups").delete().in("id", viejos.map(v => v.id));
    }
  } catch (e) {
    console.error("storage backup error", key, e);
  }
}

/* ============================================================
   ARCHIVOS GRANDES (fotos, planos dibujados, adjuntos)

   Antes, las fotos y planos se guardaban pegados directo adentro del
   evento (como texto base64), lo que hacía que TODO el bloque de
   eventos pesara cada vez más y la app tardara mucho en abrir (tenía
   que bajar todas las fotos de todos los eventos antes de mostrar
   nada). Ahora esas fotos/archivos se suben acá, al espacio de
   Storage de Supabase, y el evento solo guarda un link corto a la foto.

   Requiere que exista un bucket público llamado "archivos" en tu
   proyecto de Supabase (Storage → New bucket → marcarlo como Public).
   ============================================================ */
const BUCKET_ARCHIVOS = "archivos";

// Convierte un data URL (lo que devuelve canvas.toDataURL() o
// FileReader.readAsDataURL()) en un Blob, para poder subirlo.
function dataURLtoBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/* ============================================================
   esDataUrl(valor)
   Devuelve true si el valor es un archivo pegado a la manera vieja
   (texto base64 gigante) en vez de un link corto. Sirve para detectar
   fotos/planos viejos que todavía no se migraron al Storage.
   ============================================================ */
export function esDataUrl(valor) {
  return typeof valor === "string" && valor.startsWith("data:");
}

/* ============================================================
   uploadFile(path, archivo, contentType?)

   Sube una foto/archivo al Storage de Supabase. "archivo" puede ser:
     - un File/Blob (lo que devuelve un <input type="file">), o
     - un data URL en texto (lo que devuelve canvas.toDataURL()).

   Devuelve { ok, url }. "url" es el link público para guardar en el
   evento en vez del archivo entero.
   ============================================================ */
export async function uploadFile(path, archivo, contentType) {
  try {
    const blob = typeof archivo === "string" ? dataURLtoBlob(archivo) : archivo;
    const { error } = await supabase.storage
      .from(BUCKET_ARCHIVOS)
      .upload(path, blob, {
        upsert: true,
        contentType: contentType || blob.type || "application/octet-stream",
      });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET_ARCHIVOS).getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch (e) {
    console.error("storage uploadFile error", path, e);
    return { ok: false, url: null };
  }
}

// Borra un archivo del Storage (best-effort: si falla, no rompe nada más).
export async function deleteFile(path) {
  try {
    const { error } = await supabase.storage.from(BUCKET_ARCHIVOS).remove([path]);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.error("storage deleteFile error", path, e);
    return { ok: false };
  }
}

/* ============================================================
   Utilidad de recuperación manual: trae los últimos backups guardados
   para una key (por ejemplo "eventos"), del más nuevo al más viejo.
   Útil si algún día hace falta volver atrás.
   ============================================================ */
export async function getBackups(key, limit = 15) {
  try {
    const { data, error } = await supabase
      .from("kv_store_backups")
      .select("id, value, saved_at")
      .eq("key", key)
      .order("saved_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("storage getBackups error", key, e);
    return [];
  }
}
