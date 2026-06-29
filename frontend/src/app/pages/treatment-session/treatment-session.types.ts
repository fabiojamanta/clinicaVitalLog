export type SessionExit = {
  id: number;
  product_name: string;
  lot_number: string;
  quantity: number;
  exit_date: string;
};

export type TreatmentSession = {
  id: number;
  treatment_id: number;
  session_number: number;
  total_sessions: number;
  patient_id: number;
  patient_name?: string;
  patient_phone?: string;
  medications: string;
  treatment_notes?: string;
  doctor_user_name?: string;
  session_date?: string;
  tech_notes?: string;
  tech_user_name?: string;
  tech_updated_at?: string;
  nursing_notes?: string;
  nursing_user_name?: string;
  nursing_updated_at?: string;
  patient_signature?: string;
  signed_at?: string;
  status: string;
  exits: SessionExit[];
};

export type SessionSection = 'resumo' | 'medicamentos' | 'aplicacao' | 'assinatura' | 'enfermagem';
