-- Seed Initial Users (SciX, Zhang Li, Admin)

-- 1. Create Doctor "SciX"
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'scix@oncotracker.com',
    crypt('Zx987@', gen_salt('bf')),
    now(),
    '{"full_name": "SciX", "role": "doctor"}'
);

-- Profile created by trigger

INSERT INTO public.doctors (id, specialty, license_number)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Oncology',
    'LIC-SCIX-001'
);

-- 2. Create Patient "张莉" (Zhang Li)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'zhangli@oncotracker.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"full_name": "张莉", "role": "patient"}'
);

-- Profile created by trigger

INSERT INTO public.patients (id, mrn, family_name, given_name, date_of_birth, biological_sex, assigned_doctor_id)
VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'MRN-ZHANG-001',
    'Zhang',
    'Li',
    '1980-01-01',
    'female',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' -- Assigned to SciX
);

-- 3. Create Supervisor "Admin"
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33',
    'admin@oncotracker.com',
    crypt('OncoSciX@', gen_salt('bf')),
    now(),
    '{"full_name": "Admin", "role": "supervisor"}'
);

-- Profile created by trigger
