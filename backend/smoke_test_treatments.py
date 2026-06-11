"""Smoke test do fluxo de tratamentos/sessões (roda contra um banco temporário)."""
import os
import tempfile

tmp_db = os.path.join(tempfile.mkdtemp(), "smoke.db")
os.environ["DATABASE_URL"] = f"sqlite:///{tmp_db}"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import User, UserRole, Client, ClientType  # noqa: E402
from app.security import get_password_hash  # noqa: E402

client = TestClient(app)

SIG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


def seed_users():
    db = SessionLocal()
    for name, email, role in [
        ("Medico", "medico@x.com", UserRole.medico),
        ("Tecnica", "tecnica@x.com", UserRole.tecnica_enfermagem),
        ("Enfermeira", "enf@x.com", UserRole.enfermeira),
        ("Vendedor", "vend@x.com", UserRole.vendedor),
    ]:
        db.add(User(clinic_id=1, name=name, email=email,
                    password_hash=get_password_hash("123"), role=role, active=True))
    db.add(Client(clinic_id=1, name="Paciente Teste", client_type=ClientType.paciente, phone="5511999999999"))
    db.commit()
    db.close()


def login(email):
    r = client.post("/auth/login", json={"email": email, "password": "123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def check(cond, msg):
    assert cond, msg
    print(f"ok - {msg}")


seed_users()
med = login("medico@x.com")
tec = login("tecnica@x.com")
enf = login("enf@x.com")
vend = login("vend@x.com")

pid = next(c["id"] for c in client.get("/clients", headers=med).json() if c["name"] == "Paciente Teste")

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

# Criar tratamento (médico)
r = client.post(f"/attendances/{att_id}/treatments",
                json={"medications": "Vitamina C 500mg IV", "total_sessions": 3, "notes": "semanal"}, headers=med)
check(r.status_code == 200, "criar tratamento")
treatment = r.json()
check(len(treatment["sessions"]) == 3, "3 sessões criadas")
s1 = treatment["sessions"][0]["id"]

# Técnica não pode criar tratamento
r = client.post(f"/attendances/{att_id}/treatments", json={"medications": "x", "total_sessions": 1}, headers=tec)
check(r.status_code == 403, "técnica não cria tratamento")

# Pendências: técnica vê a primeira sessão (e só ela)
rows = client.get("/attendances/pending", headers=tec).json()
sess_rows = [x for x in rows if x["item_type"] == "sessao"]
check(len(sess_rows) == 1 and sess_rows[0]["session_id"] == s1, "técnica vê apenas a próxima sessão pendente")
check(sess_rows[0]["pending_action"] == "aplicar_sessao", "ação aplicar_sessao")

# Enfermeira também vê o item da técnica
rows = client.get("/attendances/pending", headers=enf).json()
check(any(x["item_type"] == "sessao" and x["pending_for"] == "tecnica_enfermagem" for x in rows),
      "enfermeira vê pendência da técnica")

# Filtro por paciente
rows = client.get(f"/attendances/pending?patient_id={pid + 999}", headers=enf).json()
check(rows == [], "filtro por paciente sem resultados")

# Técnica aplica a sessão
r = client.put(f"/treatment-sessions/{s1}/tech", json={"session_date": "2026-06-11", "notes": "aplicado ok"}, headers=tec)
check(r.status_code == 200 and r.json()["status"] == "aguardando_enfermagem", "técnica aplica sessão -> aguardando_enfermagem")

# Enfermeira não finaliza sem assinatura
r = client.put(f"/treatment-sessions/{s1}/nursing", json={"notes": "revisado"}, headers=enf)
check(r.status_code == 400, "finalização bloqueada sem assinatura")

# Link remoto de assinatura
r = client.post(f"/treatment-sessions/{s1}/signature-link", headers=tec)
check(r.status_code == 200, "gerar link de assinatura")
token = r.json()["token"]
r = client.get(f"/public/sign/{token}")
check(r.status_code == 200 and r.json()["patient_name"] == "Paciente Teste", "página pública carrega resumo")
r = client.post(f"/public/sign/{token}", json={"signature": SIG})
check(r.status_code == 200, "assinatura remota registrada")
r = client.get(f"/public/sign/{token}")
check(r.status_code == 404, "token queimado após uso")

# Enfermeira finaliza
r = client.put(f"/treatment-sessions/{s1}/nursing", json={"notes": "revisado"}, headers=enf)
check(r.status_code == 200 and r.json()["status"] == "concluido", "enfermeira finaliza sessão")

# Sessão concluída não aceita mais alterações
r = client.put(f"/treatment-sessions/{s1}/tech", json={"session_date": "2026-06-11", "notes": "x"}, headers=tec)
check(r.status_code == 400, "sessão concluída bloqueada")

# Próxima sessão aparece nas pendências
rows = client.get("/attendances/pending", headers=tec).json()
sess_rows = [x for x in rows if x["item_type"] == "sessao"]
check(len(sess_rows) == 1 and sess_rows[0]["session_number"] == 2, "sessão 2 agora pendente")

# Assinatura presencial na sessão 2
s2 = treatment["sessions"][1]["id"]
r = client.post(f"/treatment-sessions/{s2}/signature", json={"signature": SIG}, headers=enf)
check(r.status_code == 200 and r.json()["signed_at"], "assinatura presencial")
r = client.put(f"/treatment-sessions/{s2}/nursing", json={"session_date": "2026-06-12", "notes": "feito por mim"}, headers=enf)
check(r.status_code == 200 and r.json()["status"] == "concluido", "enfermeira executa sessão sozinha")

# Comprovante PDF
r = client.get(f"/treatment-sessions/{s1}/receipt.pdf", headers=enf)
check(r.status_code == 200 and r.content[:4] == b"%PDF", "comprovante PDF gerado")

# Progresso do tratamento
r = client.get(f"/treatments?patient_id={pid}", headers=med)
check(r.json()[0]["sessions_done"] == 2, "progresso 2/3")

# Reserva 30% + check-in 70%
r = client.post("/bookings", json={
    "patient_id": pid, "scheduled_date": "2026-06-15", "total_amount": 1000,
    "payment_method": "pix",
}, headers=vend)
check(r.status_code == 200 and float(r.json()["deposit_amount"]) == 300.0, "reserva com entrada 30%")
booking_id = r.json()["id"]

r = client.post(f"/bookings/{booking_id}/check-in", json={"payment_method": "dinheiro"}, headers=vend)
check(r.status_code == 200 and r.json()["attendance_id"], "check-in cria atendimento")
booking_att_id = r.json()["attendance_id"]

r = client.get(f"/attendances/{booking_att_id}", headers=med)
check(r.json()["booking"] and r.json()["booking"]["status"] == "presente", "atendimento vinculado à reserva")

# Receita externa PDF
r = client.put(f"/attendances/{att_id}/doctor",
               json={"notes": "consulta", "prescription": "", "external_prescription": "Dipirona 500mg"},
               headers=med)
check(r.status_code == 200, "receita externa salva")
r = client.get(f"/attendances/{att_id}/external-prescription.pdf", headers=med)
check(r.status_code == 200 and r.content[:4] == b"%PDF", "PDF receita externa")

# Histórico de sinais vitais
r = client.get(f"/patients/{pid}/vital-signs", headers=med)
check(r.status_code == 200 and len(r.json()) >= 1, "histórico de sinais vitais")

print("\nTodos os testes passaram.")
