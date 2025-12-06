-- Fix infinite recursion in RLS policies by using a SECURITY DEFINER function

-- 1. Create a helper function to get the current user's role without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. Update policies on public.profiles

-- Drop existing recursive policy
DROP POLICY IF EXISTS "Supervisors can view all profiles" ON public.profiles;

-- Recreate with helper function
CREATE POLICY "Supervisors can view all profiles" ON public.profiles
  FOR SELECT USING (
    get_user_role() = 'supervisor'
  );

-- 3. Update policies on public.patients

-- Drop existing recursive policy
DROP POLICY IF EXISTS "Doctors view assigned patients" ON public.patients;

-- Recreate with helper function
CREATE POLICY "Doctors view assigned patients" ON public.patients
  FOR SELECT USING (
    auth.uid() = assigned_doctor_id
    OR get_user_role() = 'supervisor'
  );
