# 33_app — Fase 1 (Alta de artistas)

Incluye:
- Ficha de artista (foto, datos personales, fiscales y bancarios, contrato adjunto).
- Grupo con varios miembros.
- Condiciones económicas por categoría (% artista / % oficina, base bruto/neto, exento oficina).
- Terceros con su tabla de condiciones y exento.
- Listado de artistas.

## Subir a GitHub (web)
Crea cada archivo como aquí, con **Add file → Create new file**. Para rutas con carpetas, escribe la ruta completa (ej. `pages/artists/new.tsx`).

## Vercel — Variables
- `NEXT_PUBLIC_SUPABASE_URL` = tu URL de Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon key

## Supabase — Buckets
- `artist-photos` (privado)
- `contracts` (privado)

## Rutas
- `/artists/new` → Crear artista
- `/artists` → Listado
