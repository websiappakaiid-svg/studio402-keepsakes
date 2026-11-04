-- =============================================================================
-- ourpage / LoveOS Template 1 — Supabase Cloud Database Schema
-- =============================================================================
-- Jalankan skrip ini langsung di Supabase SQL Editor:
-- 1. Buka https://supabase.com -> Pilih project Anda
-- 2. Masuk ke menu "SQL Editor" di bilah kiri
-- 3. Paste seluruh isi skrip ini lalu klik "Run" (Tombol hijau)
-- =============================================================================

-- 1. Buat Tabel Khusus untuk Template 1: loveos_projects
-- (Tabel ini sepenuhnya terisolasi dan mandiri, tidak akan bertabrakan dengan template lain di masa depan)
CREATE TABLE IF NOT EXISTS public.loveos_projects (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    template TEXT DEFAULT 'loveos',
    design_code TEXT,
    config_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'draft',
    followup_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- 2. Buat Index agar query pencarian cepat (URL Slug & Email Pembeli)
CREATE INDEX IF NOT EXISTS idx_loveos_projects_slug ON public.loveos_projects (slug);
CREATE INDEX IF NOT EXISTS idx_loveos_projects_email ON public.loveos_projects (email);
CREATE INDEX IF NOT EXISTS idx_loveos_projects_status ON public.loveos_projects (status);

-- 3. Konfigurasi Row Level Security (RLS)
-- Mengizinkan backend server / anon API key melakukan INSERT, SELECT, dan UPDATE tanpa error 42501
ALTER TABLE public.loveos_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access for loveos_projects" ON public.loveos_projects;
CREATE POLICY "Allow public access for loveos_projects"
    ON public.loveos_projects
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- 4. Beri Hak Akses (Grant) ke Role anon dan authenticated
GRANT ALL ON public.loveos_projects TO anon;
GRANT ALL ON public.loveos_projects TO authenticated;
GRANT ALL ON public.loveos_projects TO service_role;

-- =============================================================================
-- PETUNJUK PENAMBAHAN TEMPLATE BARU DI MASA DEPAN (TEMPLATE 2, 3, DST):
-- =============================================================================
-- Jika suatu saat Anda ingin membuat Template 2 (misal nama: 'arcade' atau 'magazine'),
-- Anda CUKUP jalankan SQL terpisah berikut TANPA mengganggu tabel template 1 sama sekali:
--
-- CREATE TABLE IF NOT EXISTS public.template2_projects (
--     id TEXT PRIMARY KEY,
--     slug TEXT UNIQUE NOT NULL,
--     email TEXT NOT NULL,
--     template TEXT DEFAULT 'template2',
--     design_code TEXT,
--     config_data JSONB NOT NULL DEFAULT '{}'::jsonb,
--     status TEXT DEFAULT 'draft',
--     followup_sent BOOLEAN DEFAULT false,
--     created_at TIMESTAMPTZ DEFAULT NOW(),
--     updated_at TIMESTAMPTZ DEFAULT NOW(),
--     expires_at TIMESTAMPTZ
-- );
-- ALTER TABLE public.template2_projects ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public access for template2_projects" ON public.template2_projects FOR ALL TO public USING (true) WITH CHECK (true);
-- GRANT ALL ON public.template2_projects TO anon, authenticated, service_role;
-- =============================================================================
