# Carmela Álvarez · Event Planner — app instalable (PWA)

Esta carpeta es un proyecto React (Vite) listo para desplegar como sitio propio,
con datos compartidos en la nube (Supabase) para que varias personas vean y
carguen la misma información desde distintos celulares, y se pueda **instalar
como ícono** en el celular (PWA).

## 1) Crear la base de datos (Supabase — gratis)

1. Entrá a https://supabase.com → creá una cuenta → **New project**.
2. Cuando esté listo, andá a **SQL Editor** → pegá esto y ejecutalo:

   ```sql
   create table kv_store (
     key text primary key,
     value jsonb not null,
     updated_at timestamptz default now()
   );

   alter table kv_store enable row level security;

   create policy "lectura y escritura pública"
   on kv_store for all
   using (true)
   with check (true);

   -- Necesario en proyectos nuevos de Supabase: expone la tabla
   -- explícitamente a la API (antes era automático).
   grant select, insert, update, delete on kv_store to anon, authenticated;
   ```

   > Nota: esta política deja la tabla abierta a quien tenga el link de la app
   > (no hay usuarios/login separados). Es el mismo esquema de "todos ven y
   > editan lo mismo" que ya tenía la versión de artifact. Si más adelante
   > querés login por persona, se puede agregar Supabase Auth.

3. Andá a **Project Settings → API**. Copiá:
   - **Project URL**
   - **anon public key**

## 2) Configurar el proyecto

1. Descomprimí esta carpeta y abrí una terminal adentro.
2. Copiá `.env.example` a `.env` y completá con los datos del paso 1:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key
   ```
3. Instalá dependencias y probá localmente:
   ```
   npm install
   npm run dev
   ```
   Abrí la URL que te muestra (típicamente http://localhost:5173).

## 3) Publicarla en internet (Vercel — gratis)

1. Subí esta carpeta a un repositorio de GitHub (podés arrastrar los archivos
   desde github.com/new sin usar la terminal, si preferís).
2. Entrá a https://vercel.com → **Add New Project** → elegí el repositorio.
3. En **Environment Variables** cargá `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` con los mismos valores del `.env`.
4. Deploy. Vercel te da un link tipo `https://tu-app.vercel.app`.

   (Netlify funciona igual de bien si lo preferís: mismo proceso, variables
   de entorno en Site settings → Environment variables.)

## 4) Instalarla como ícono en el celular

- **Android (Chrome)**: abrí el link publicado → menú (⋮) → **"Instalar app"**
  o **"Agregar a pantalla de inicio"**.
- **iPhone (Safari)**: abrí el link → botón compartir (□↑) → **"Agregar a
  pantalla de inicio"**.

Va a quedar como un ícono más, abre en pantalla completa (sin la barra del
navegador) y funciona igual para todas las personas que la instalen, siempre
mostrando los mismos datos (porque están guardados en Supabase, no en cada
celular).

## Qué cambió respecto a la versión de artifact de Claude

- `window.storage` (solo existe dentro de Claude) se reemplazó por
  `src/lib/supabaseStorage.js`, que habla con tu propia base de datos.
- Se agregó `vite-plugin-pwa` + `manifest` + íconos para que sea instalable.
- El resto de la lógica (calendario, fichas, vales, planos, PIN de admin) es
  exactamente la misma.
