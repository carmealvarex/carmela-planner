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

export async function loadShared(key, fallback) {
  try {
    const { data, error } = await supabase
      .from("kv_store")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    return data ? data.value : fallback;
  } catch (e) {
    console.error("storage load error", key, e);
    return fallback;
  }
}

export async function saveShared(key, value) {
  try {
    const { error } = await supabase
      .from("kv_store")
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
  } catch (e) {
    console.error("storage save error", key, e);
  }
}
