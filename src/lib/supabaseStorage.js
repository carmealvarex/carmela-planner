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
   loadShared ahora devuelve { value, ok }:
     - ok === true  -> la lectura a Supabase funcionó (haya o no filas).
     - ok === false -> algo falló (red, timeout, permisos, etc). En este
       caso "value" trae el fallback, pero NO hay que confiar en él como
       si fuera el dato real: el llamador debe evitar guardar/sobrescribir
       cuando ok es false. Antes esto no se distinguía, y una falla de
       red silenciosa terminaba pisando datos reales con el fallback.
   ============================================================ */
export async function loadShared(key, fallback) {
  try {
    const { data, error } = await supabase
      .from("kv_store")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    return { value: data ? data.value : fallback, ok: true };
  } catch (e) {
    console.error("storage load error", key, e);
    return { value: fallback, ok: false };
  }
}

/* ============================================================
   saveShared: guarda el valor y, ademas, guarda una copia de respaldo
   con fecha en kv_store_backups (best-effort: si el backup falla no
   frena el guardado principal). Ver README / migración SQL para crear
   esa tabla.
   ============================================================ */
export async function saveShared(key, value) {
  try {
    const { error } = await supabase
      .from("kv_store")
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
  } catch (e) {
    console.error("storage save error", key, e);
    return;
  }

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
    // El backup es una red de seguridad extra: si falla, no rompemos el guardado principal.
    console.error("storage backup error", key, e);
  }
}

/* ============================================================
   Utilidad de recuperación manual: trae los últimos backups guardados
   para una key (por ejemplo "eventos"), del más nuevo al más viejo.
   Útil si algún día hace falta volver atrás.
   ============================================================ */
export async function getBackups(key, limit = 15) {
  const { data, error } = await supabase
    .from("kv_store_backups")
    .select("id, value, saved_at")
    .eq("key", key)
    .order("saved_at", { ascending: false })
    .limit(limit);
  if (error) { console.error("storage getBackups error", key, e); return []; }
  return data || [];
}
