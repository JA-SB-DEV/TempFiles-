-- EJECUTA ESTO EN EL SQL EDITOR DE SUPABASE
-- Este script es seguro de ejecutar múltiples veces (idempotente)

-- 1. Crear la tabla 'temp_files' si no existe
CREATE TABLE IF NOT EXISTS temp_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL,
  file_path text NOT NULL,
  type text NOT NULL,
  mime_type text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- 2. Habilitar seguridad a nivel de fila (RLS)
ALTER TABLE temp_files ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de acceso (Borrar previas para evitar conflictos y re-crear)
DROP POLICY IF EXISTS "Cualquiera puede subir" ON temp_files;
CREATE POLICY "Cualquiera puede subir"
ON temp_files FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Cualquiera puede leer" ON temp_files;
CREATE POLICY "Cualquiera puede leer"
ON temp_files FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Cualquiera puede borrar" ON temp_files;
CREATE POLICY "Cualquiera puede borrar"
ON temp_files FOR DELETE
USING (true);

-- IMPORTANTE: CONFIGURACIÓN DEL STORAGE (ALMACENAMIENTO)
-- Esto no se puede hacer por SQL estándar en Supabase, debes hacerlo en el panel:
-- 1. Ve a la sección "Storage" en el menú lateral.
-- 2. Crea un nuevo Bucket llamado: chronos_files
-- 3. Hazlo PÚBLICO (Public Bucket) o configura las políticas de Storage.
--    (Para empezar, hacerlo público es lo más fácil).
