export interface FormalDatasetRow {
    "Unnamed: 0"?: string; // Date (Column A)
    "Unnamed: 1"?: string; // Phase/项目 (Column B)
    "Unnamed: 2"?: string; // Cycle/周期 (Column C)
    "Unnamed: 3"?: string; // Previous Cycle/前序周期 (Column D, often empty)
    "Unnamed: 4"?: string; // Scheme/方案 (Column E)
    "Unnamed: 5"?: string; // Event/处置 (Column F)
    "Unnamed: 6"?: string; // Scheme Detail/方案详情 (Column G)
    [key: string]: string | undefined; // Metrics start at Column H (Unnamed: 7)
}

export interface FormalDataset {
    FormalDataset: FormalDatasetRow[];
    patientName?: string;
}

export interface Phase {
    start: Date;
    end: Date;
    name: string;
    cycle: string;
    scheme: string;
    duration: number;
    type: 'surgery' | 'medication';
}

export interface EventMarker {
    date: Date;
    name: string;
    overlapIndex: number;
}

export interface MetricDataPoint {
    date: Date;
    value: number;
    isAlert: boolean;
}

export interface Metric {
    id: string;
    name: string;
    data: MetricDataPoint[];
    color: string;
    scale: number;
    offset: number;
    opacity: number;
    showLine: boolean;
    showValues: boolean;
    mid: number;
    active: boolean;
    expanded: boolean;
    unit: string;
    rangeMin: number;
    rangeMax: number;
    threshold: number | null;
    baseScale: number;
}

export interface AppStateData {
    phases: Phase[];
    events: EventMarker[];
    metrics: Record<string, Metric>;
    schemes: any[];
    totalPoints: number;
}

export interface AppStateView {
    showPhases: boolean;
    showEvents: boolean;
    showSchemes: boolean;
    phaseOpacity: number;
    margin: { top: number; right: number; bottom: number; left: number };
    width: number;
    height: number;
    chartFlexRatio: number;
    isPrinting: boolean;
    printDomain?: [Date, Date] | null;
}

export type UserRole = 'patient' | 'doctor' | 'supervisor';

export interface UserProfile {
    id: string;
    email: string;
    role: UserRole;
    is_approved: boolean;
    full_name: string;
    created_at: string;
}

export interface DoctorProfile extends UserProfile {
    specialty?: string;
    license_number?: string;
}

export interface PatientProfile extends UserProfile {
    mrn?: string;
    dob?: string;
    gender?: string;
    assigned_doctor_id?: string;
}
