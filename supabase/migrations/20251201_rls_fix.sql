-- supabase/migrations/20251201_rls_fix.sql

-- Re-create patients table to align with Auth and mCODE
-- We drop dependent tables first
DROP TABLE IF EXISTS public.conditions;
DROP TABLE IF EXISTS public.observations;
DROP TABLE IF EXISTS public.patients;

CREATE TABLE public.patients (
    id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY, -- Links to Auth User
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Identifiers
    mrn TEXT UNIQUE NOT NULL,

    -- Demographics (mCODE)
    family_name TEXT NOT NULL,
    given_name TEXT NOT NULL,
    date_of_birth DATE,
    biological_sex TEXT CHECK (biological_sex IN ('male', 'female', 'other', 'unknown')),
    address_city TEXT,
    address_province TEXT,
    country TEXT DEFAULT 'China',
    active BOOLEAN DEFAULT TRUE,

    -- RBAC
    assigned_doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL
);

-- Re-create observations (mCODE)
CREATE TABLE public.observations (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_datetime TIMESTAMPTZ NOT NULL,
    category TEXT CHECK (category IN ('laboratory', 'vital-signs', 'imaging', 'tumor-marker', 'procedure', 'event')),
    code TEXT NOT NULL,
    code_display TEXT NOT NULL,
    status TEXT CHECK (status IN ('preliminary', 'final', 'amended', 'cancelled')),
    value_quantity NUMERIC,
    value_unit TEXT,
    value_string TEXT,
    interpretation TEXT CHECK (interpretation IN ('High', 'Low', 'Normal', 'Abnormal'))
);

-- Re-create conditions (mCODE)
CREATE TABLE public.conditions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clinical_status TEXT CHECK (clinical_status IN ('active', 'recurrence', 'relapse', 'remission', 'resolved')),
    condition_type TEXT NOT NULL CHECK (condition_type IN ('primary', 'secondary')),
    date_of_diagnosis DATE,
    diagnosis_code TEXT NOT NULL,
    diagnosis_display TEXT NOT NULL,
    body_site TEXT,
    histology_morphology_behavior TEXT,
    stage_tnm_clinical TEXT
);

-- Enable RLS
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conditions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Patients
CREATE POLICY "Patients view own record" ON public.patients
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Doctors view assigned patients" ON public.patients
  FOR SELECT USING (
    auth.uid() = assigned_doctor_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

-- Observations
CREATE POLICY "Patients view own observations" ON public.observations
  FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY "Doctors view assigned patient observations" ON public.observations
  FOR SELECT USING (
    patient_id IN (
        SELECT id FROM public.patients WHERE assigned_doctor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

-- Conditions
CREATE POLICY "Patients view own conditions" ON public.conditions
  FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY "Doctors view assigned patient conditions" ON public.conditions
  FOR SELECT USING (
    patient_id IN (
        SELECT id FROM public.patients WHERE assigned_doctor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

-- Indexes
CREATE INDEX idx_observations_patient_id ON public.observations(patient_id);
CREATE INDEX idx_conditions_patient_id ON public.conditions(patient_id);
CREATE INDEX idx_observations_category_date ON public.observations(category, effective_datetime DESC);
