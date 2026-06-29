"""Smoke test do painel de permissões e perfis dinâmicos."""
import os
import tempfile

tmp_db = os.path.join(tempfile.mkdtemp(), "perm_smoke.db")
os.environ["DATABASE_URL"] = f"sqlite:///{tmp_db}"
os.environ["ENV"] = "development"
os.environ.pop("RENDER", None)

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import User, Profile, Client  # noqa: E402
from app.security import get_password_hash  # noqa: E402
from test_client_util import mutation_headers, read_headers  # noqa: E402

client = TestClient(app)
CSRF = {"X-Requested-With": "XMLHttpRequest"}
PASSWORD = "teste1234"


def check(cond, msg):
    assert cond, msg
    print(f"ok - {msg}")


db = SessionLocal()
admin_p = db.query(Profile).filter_by(slug="administrador").first()
consulta_p = db.query(Profile).filter_by(slug="consulta").first()
estoque_p = db.query(Profile).filter_by(slug="estoque").first()
consulta_profile_id = consulta_p.id
estoque_profile_id = estoque_p.id
db.add(User(
    clinic_id=1, profile_id=admin_p.id, name="Admin", email="admin@test.com",
    password_hash=get_password_hash(PASSWORD), active=True,
))
db.add(User(
    clinic_id=1, profile_id=consulta_p.id, name="Consulta", email="consulta@test.com",
    password_hash=get_password_hash(PASSWORD), active=True,
))
db.add(Client(clinic_id=1, name="Ana Paciente Teste", client_type="paciente", active=True))
db.commit()
db.close()


def login(email):
    r = client.post("/auth/login", json={"email": email, "password": PASSWORD}, headers=CSRF)
    assert r.status_code == 200, r.text
    data = r.json()
    check("profile" in data["user"], "login retorna profile")
    check("permissions" in data["user"], "login retorna permissions")
    check("access_token" not in data, "login não expõe token")
    return data["user"]


login("admin@test.com")
login("consulta@test.com")

r = client.get("/users", headers=read_headers(client))
check(r.status_code == 403, "consulta não lista usuários")

login("admin@test.com")
r = client.post("/users", headers=mutation_headers(client), json={
    "name": "Novo", "email": "novo@test.com", "password": PASSWORD,
    "profile_id": estoque_profile_id, "active": True,
})
check(r.status_code == 200 and "cargo" not in r.json() and "role" not in r.json(), "criar user com profile_id")
check(r.json().get("profile_name") == "Estoque", "profile_name na resposta")

login("admin@test.com")
r = client.post("/profiles", headers=mutation_headers(client), json={
    "name": "Recepção Teste", "slug": "recepcao_teste",
})
check(r.status_code == 200, "criar perfil customizado")
custom_id = r.json()["id"]

r = client.put(f"/profiles/{consulta_profile_id}/permissions", headers=mutation_headers(client), json={
    "permissions": [{"menu_key": "clientes", "access_level": "hidden"}],
})
check(r.status_code == 200, "atualizar permissões")

login("consulta@test.com")
u = login("consulta@test.com")
check(u["permissions"].get("clientes") == "hidden", "perm hidden após update")

login("consulta@test.com")
r = client.get("/clients", headers=read_headers(client))
check(r.status_code == 403, "clientes hidden -> 403")

login("admin@test.com")
r = client.get("/menu-catalog", headers=read_headers(client))
check(r.status_code == 200 and len(r.json()) >= 10, "menu catalog dinâmico")

r = client.delete(f"/profiles/{custom_id}", headers=mutation_headers(client))
check(r.status_code == 200, "excluir perfil customizado")

login("admin@test.com")
r = client.put(f"/profiles/{consulta_profile_id}/permissions", headers=mutation_headers(client), json={
    "permissions": [{"menu_key": "clientes", "access_level": "read"}],
})
check(r.status_code == 200, "restaurar clientes read")
login("consulta@test.com")
r = client.get("/clients", headers=read_headers(client))
check(r.status_code == 200, "consulta GET clientes com read")
r = client.post("/clients", headers=mutation_headers(client), json={
    "name": "X", "client_type": "paciente", "active": True,
})
check(r.status_code == 403, "consulta POST clientes bloqueado")

login("admin@test.com")
r = client.get("/users", headers=read_headers(client))
check(r.status_code == 200, "admin bypass em usuários")

db = SessionLocal()
enfermeira_p = db.query(Profile).filter_by(slug="enfermeira").first()
medico_p = db.query(Profile).filter_by(slug="medico").first()
db.add(User(
    clinic_id=1, profile_id=enfermeira_p.id, name="Enfermeira", email="enfermeira@test.com",
    password_hash=get_password_hash(PASSWORD), active=True,
))
db.add(User(
    clinic_id=1, profile_id=medico_p.id, name="Medico", email="medico@test.com",
    password_hash=get_password_hash(PASSWORD), active=True,
))
db.commit()
db.close()

login("enfermeira@test.com")
enfermeira_u = client.get("/auth/me", headers=read_headers(client)).json()
check(enfermeira_u["permissions"].get("clientes") in (None, "hidden"), "enfermeira sem clientes")
r = client.get("/clients", headers=read_headers(client))
check(r.status_code == 403, "enfermeira não lista clientes sem q")
r = client.get("/clients", headers=read_headers(client), params={"q": "Ana", "client_type": "paciente"})
check(r.status_code == 200 and len(r.json()) >= 1, "enfermeira busca paciente com q")

login("medico@test.com")
medico_u = client.get("/auth/me", headers=read_headers(client)).json()
check(medico_u["permissions"].get("clientes") in (None, "hidden"), "medico sem clientes")
r = client.get("/clients", headers=read_headers(client), params={"q": "Ana", "client_type": "paciente"})
check(r.status_code == 200, "medico busca paciente com q")
r = client.get("/products", headers=read_headers(client), params={"q": "Med"})
check(r.status_code == 200, "medico busca produto com q")

print("\nTodos os testes de permissões passaram.")
