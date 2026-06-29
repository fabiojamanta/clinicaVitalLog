"""Smoke test de segurança OWASP."""
import os
import tempfile

tmp_db = os.path.join(tempfile.mkdtemp(), "security_smoke.db")
os.environ["DATABASE_URL"] = f"sqlite:///{tmp_db}"
os.environ["ENV"] = "development"
os.environ.pop("RENDER", None)

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import User, Profile  # noqa: E402
from app.security import get_password_hash  # noqa: E402
from app.login_lockout import clear_failures  # noqa: E402
from test_client_util import mutation_headers, read_headers  # noqa: E402

client = TestClient(app)
CSRF = {"X-Requested-With": "XMLHttpRequest"}
SIG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


def check(cond, msg):
    assert cond, msg
    print(f"ok - {msg}")


db = SessionLocal()
admin_p = db.query(Profile).filter_by(slug="administrador").first()
medico_p = db.query(Profile).filter_by(slug="medico").first()
db.add(User(
    clinic_id=1, profile_id=admin_p.id, name="Admin", email="admin@test.com",
    password_hash=get_password_hash("teste1234"), active=True,
))
db.add(User(
    clinic_id=1, profile_id=medico_p.id, name="Medico", email="medico@test.com",
    password_hash=get_password_hash("teste1234"), active=True,
))
db.commit()
db.close()


def login(email: str, password: str = "teste1234"):
    clear_failures(email)
    r = client.post("/auth/login", json={"email": email, "password": password}, headers=CSRF)
    assert r.status_code == 200, r.text
    data = r.json()
    check("access_token" not in data, "login não expõe access_token no JSON")
    check("user" in data, "login retorna user")
    return data["user"]


login("admin@test.com")
r = client.get("/auth/me", headers=read_headers(client))
check(r.status_code == 200, "sessão via cookie HttpOnly funciona")

client.post("/auth/logout", headers=mutation_headers(client))
login("admin@test.com")
r = client.post("/clients", json={"name": "X", "client_type": "paciente", "active": True}, headers=read_headers(client))
check(r.status_code == 403, "mutação autenticada sem CSRF retorna 403")

from app.database import SessionLocal as SL  # noqa: E402
from app.models import Client, ClientType, Attendance, Treatment, TreatmentSession  # noqa: E402
from app.datetime_utils import now_br, today_br  # noqa: E402
import secrets  # noqa: E402
from datetime import timedelta  # noqa: E402

db = SL()
patient = Client(clinic_id=1, name="Paciente Secreto", client_type=ClientType.paciente, active=True)
db.add(patient)
db.flush()
att = Attendance(clinic_id=1, patient_id=patient.id, attendance_date=today_br())
db.add(att)
db.flush()
t = Treatment(
    clinic_id=1, attendance_id=att.id, patient_id=patient.id,
    medications="Vitamina C", total_sessions=1,
)
db.add(t)
db.flush()
sess = TreatmentSession(
    treatment_id=t.id, session_number=1, session_date=today_br(),
    signature_token=secrets.token_urlsafe(32),
    signature_token_expires_at=now_br() + timedelta(minutes=30),
)
db.add(sess)
db.commit()
token = sess.signature_token
db.close()

r = client.get(f"/public/sign/{token}")
check(r.status_code == 200, "preview público acessível")
preview = r.json()
check("patient_name" not in preview, "preview não expõe patient_name")
check("medications" not in preview, "preview não expõe medications")

r = client.post(f"/public/sign/{token}/prepare")
check(r.status_code == 200, "prepare retorna detalhes")
check(r.json().get("patient_name") == "Paciente Secreto", "prepare expõe dados após confirmação")

for _ in range(5):
    client.post(
        "/auth/login",
        json={"email": "admin@test.com", "password": "wrongpass1"},
        headers=CSRF,
    )
r = client.post(
    "/auth/login",
    json={"email": "admin@test.com", "password": "teste1234"},
    headers=CSRF,
)
check(r.status_code == 429, "lockout após múltiplas falhas de login")

print("\nTodos os testes de segurança passaram.")
