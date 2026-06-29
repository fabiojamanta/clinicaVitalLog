export type TreatmentSessionItem = {
  id: number;
  session_number: number;
  session_date?: string;
  status: string;
  signed: boolean;
};

export type Treatment = {
  id: number;
  attendance_id: number;
  patient_id: number;
  medications: string;
  total_sessions: number;
  notes?: string;
  doctor_user_name?: string;
  created_at?: string;
  sessions_done: number;
  sessions: TreatmentSessionItem[];
};

export type AttendanceListItem = {
  id: number;
  patient_id: number;
  patient_name: string;
  attendance_date: string;
  created_at?: string;
  workflow_status: string;
  phase_label: string;
  current_section: AttendanceSection;
};

export type AttendanceExit = {
  id: number;
  product_id: number;
  lot_id: number;
  quantity: number;
  exit_date: string;
  product_name: string;
  lot_number: string;
};

export type VitalSign = {
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  heart_rate?: number | null;
  temperature?: number | null;
  weight?: number | null;
  height?: number | null;
  spo2?: number | null;
  glycemia?: number | null;
  notes?: string | null;
  recorded_by_name?: string;
  recorded_at?: string;
  bmi?: number | null;
};

export type BookingPayment = {
  payment_type: string;
  amount: number;
  payment_method: string;
  paid_at: string;
};

export type BookingSummary = {
  id: number;
  scheduled_date: string;
  total_amount: number;
  deposit_amount: number;
  balance_amount: number;
  status: string;
  payments: BookingPayment[];
};

export type Attendance = {
  id: number;
  patient_id: number;
  patient_name: string;
  attendance_date: string;
  doctor_notes?: string;
  prescription?: string;
  external_prescription?: string;
  tech_notes?: string;
  nursing_notes?: string;
  doctor_user_name?: string;
  tech_user_name?: string;
  nursing_user_name?: string;
  vitals_user_name?: string;
  doctor_updated_at?: string;
  tech_updated_at?: string;
  nursing_updated_at?: string;
  vitals_recorded_at?: string;
  workflow_status?: string;
  booking?: BookingSummary | null;
  vitals?: VitalSign | null;
  exits: AttendanceExit[];
};

export type AttendanceSection =
  | 'historico'
  | 'sinais-vitais'
  | 'medico'
  | 'tecnica'
  | 'dispensar'
  | 'finalizar';
