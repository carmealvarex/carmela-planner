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
