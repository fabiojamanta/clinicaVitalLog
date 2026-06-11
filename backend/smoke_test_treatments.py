"""Smoke test do fluxo de tratamentos/sessões (roda contra um banco temporário)."""
import os
import tempfile

tmp_db = os.path.join(tempfile.mkdtemp(), "smoke.db")
os.environ["DATABASE_URL"] = f"sqlite:///{tmp_db}"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import User, Profile, Client, ClientType  # noqa: E402
from app.security import get_password_hash  # noqa: E402

client = TestClient(app)

SIG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


def seed_users():
    db = SessionLocal()
    profiles = {p.slug: p for p in db.query(Profile).all()}
    for name, email, slug in [
        ("Medico", "medico@x.com", "medico"),
        ("Tecnica", "tecnica@x.com", "tecnica_enfermagem"),
        ("Enfermeira", "enf@x.com", "enfermeira"),
        ("Vendedor", "vend@x.com", "vendedor"),
    ]:
        p = profiles[slug]
        db.add(User(clinic_id=1, profile_id=p.id, name=name, email=email,
                    password_hash=get_password_hash("teste123"), active=True))
    patient = Client(clinic_id=1, name="Paciente Teste", client_type=ClientType.paciente, phone="5511999999999")
    db.add(patient)
    db.commit()
    pid = patient.id
    db.close()
    return pid


def login(email):
    r = client.post("/auth/login", json={"email": email, "password": "teste123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def check(cond, msg):
    assert cond, msg
    print(f"ok - {msg}")


pid = seed_users()
med = login("medico@x.com")
tec = login("tecnica@x.com")
enf = login("enf@x.com")
vend = login("vend@x.com")

r = client.post("/attendances", json={"patient_id": pid, "attendance_date": "2026-06-11"}, headers=med)
check(r.status_code == 200, "criar atendimento")
att_id = r.json()["id"]

r = client.put(f"/attendances/{att_id}/doctor", json={"notes": "consulta", "prescription": ""}, headers=med)
check(r.status_code == 400, "médico bloqueado sem sinais vitais")

rows = client.get("/attendances/pending", headers=enf).json()
check(any(x["pending_action"] == "registrar_sinais_vitais" for x in rows if x["item_type"] == "atendimento"),
      "enfermeira vê pendência de sinais vitais")

r = client.put(f"/attendances/{att_id}/vitals",
               json={"systolic_bp": 120, "diastolic_bp": 80, "heart_rate": 72, "temperature": 36.5,
                     "weight": 70, "height": 170, "spo2": 98, "glycemia": 95}, headers=enf)
check(r.status_code == 200 and r.json()["vitals_recorded_at"], "enfermeira registra sinais vitais")

r = client.put(f"/attendances/{att_id}/doctor", json={"notes": "consulta", "prescription": ""}, headers=med)
check(r.status_code == 200, "médico salva após sinais vitais")

r = client.post(f"/attendances/{att_id}/treatments",
                json={"medications": "Vitamina C 500mg IV", "total_sessions": 3, "notes": "semanal"}, headers=med)
check(r.status_code == 200, "criar tratamento")
treatment = r.json()
s1 = treatment["sessions"][0]["id"]

r = client.post(f"/attendances/{att_id}/treatments", json={"medications": "x", "total_sessions": 1}, headers=tec)
check(r.status_code == 403, "técnica não cria tratamento")

rows = client.get("/attendances/pending", headers=tec).json()
sess_rows = [x for x in rows if x["item_type"] == "sessao"]
check(len(sess_rows) == 1 and sess_rows[0]["session_id"] == s1, "técnica vê próxima sessão")

r = client.put(f"/treatment-sessions/{s1}/tech", json={"session_date": "2026-06-11", "notes": "aplicado ok"}, headers=tec)
check(r.status_code == 200 and r.json()["status"] == "aguardando_enfermagem", "técnica aplica sessão")

r = client.post(f"/treatment-sessions/{s1}/signature-link", headers=tec)
check(r.status_code == 200, "gerar link de assinatura")
token = r.json()["token"]
r = client.post(f"/public/sign/{token}", json={"signature": SIG})
check(r.status_code == 200, "assinatura remota")

r = client.put(f"/treatment-sessions/{s1}/nursing", json={"notes": "revisado"}, headers=enf)
check(r.status_code == 200 and r.json()["status"] == "concluido", "enfermeira finaliza sessão")

r = client.get(f"/treatment-sessions/{s1}/receipt.pdf", headers=enf)
check(r.status_code == 200 and r.content[:4] == b"%PDF", "comprovante PDF")

r = client.post("/bookings", json={
    "patient_id": pid, "scheduled_date": "2026-06-15", "total_amount": 1000,
    "payment_method": "pix",
}, headers=vend)
check(r.status_code == 200 and float(r.json()["deposit_amount"]) == 300.0, "reserva 30%")
booking_id = r.json()["id"]

r = client.post(f"/bookings/{booking_id}/check-in", json={"payment_method": "dinheiro"}, headers=vend)
check(r.status_code == 200 and r.json()["attendance_id"], "check-in")

r = client.put(f"/attendances/{att_id}/doctor",
               json={"notes": "consulta", "prescription": "", "external_prescription": "Dipirona 500mg"},
               headers=med)
check(r.status_code == 200, "receita externa")
r = client.get(f"/attendances/{att_id}/external-prescription.pdf", headers=med)
check(r.status_code == 200 and r.content[:4] == b"%PDF", "PDF receita externa")

r = client.get(f"/patients/{pid}/vital-signs", headers=med)
check(r.status_code == 200 and len(r.json()) >= 1, "histórico vitais")

print("\nTodos os testes passaram.")
