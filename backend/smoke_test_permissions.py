"""Smoke test do painel de permissões e perfis dinâmicos."""
import os
import tempfile

tmp_db = os.path.join(tempfile.mkdtemp(), "perm_smoke.db")
os.environ["DATABASE_URL"] = f"sqlite:///{tmp_db}"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import User, Profile  # noqa: E402
from app.security import get_password_hash  # noqa: E402

client = TestClient(app)


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
    password_hash=get_password_hash("teste123"), active=True,
))
db.add(User(
    clinic_id=1, profile_id=consulta_p.id, name="Consulta", email="consulta@test.com",
    password_hash=get_password_hash("teste123"), active=True,
))
db.commit()
db.close()


def login(email):
    r = client.post("/auth/login", json={"email": email, "password": "teste123"})
    assert r.status_code == 200, r.text
    data = r.json()
    check("profile" in data["user"], "login retorna profile")
    check("permissions" in data["user"], "login retorna permissions")
    return {"Authorization": f"Bearer {data['access_token']}"}, data["user"]


admin_h, admin_u = login("admin@test.com")
consulta_h, consulta_u = login("consulta@test.com")

check(admin_u["profile"]["is_admin"], "admin is_admin")
check(consulta_u["permissions"].get("clientes") == "read", "consulta clientes read")

r = client.get("/users", headers=consulta_h)
check(r.status_code == 403, "consulta não lista usuários")

r = client.post("/users", headers=admin_h, json={
    "name": "Novo", "email": "novo@test.com", "password": "teste123",
    "profile_id": estoque_profile_id, "active": True,
})
check(r.status_code == 200 and "cargo" not in r.json() and "role" not in r.json(), "criar user com profile_id")
check(r.json().get("profile_name") == "Estoque", "profile_name na resposta")

r = client.post("/profiles", headers=admin_h, json={
    "name": "Recepção Teste", "slug": "recepcao_teste",
})
check(r.status_code == 200, "criar perfil customizado")
custom_id = r.json()["id"]

r = client.put(f"/profiles/{consulta_profile_id}/permissions", headers=admin_h, json={
    "permissions": [{"menu_key": "clientes", "access_level": "hidden"}],
})
check(r.status_code == 200, "atualizar permissões")

_, consulta_u2 = login("consulta@test.com")
check(consulta_u2["permissions"].get("clientes") == "hidden", "perm hidden após update")

r = client.get("/clients", headers=consulta_h)
check(r.status_code == 403, "clientes hidden -> 403")

r = client.get("/menu-catalog", headers=admin_h)
check(r.status_code == 200 and len(r.json()) >= 10, "menu catalog dinâmico")

r = client.delete(f"/profiles/{custom_id}", headers=admin_h)
check(r.status_code == 200, "excluir perfil customizado")

# consulta com clientes read: GET ok, POST 403
r = client.put(f"/profiles/{consulta_profile_id}/permissions", headers=admin_h, json={
    "permissions": [{"menu_key": "clientes", "access_level": "read"}],
})
check(r.status_code == 200, "restaurar clientes read")
consulta_h3, _ = login("consulta@test.com")
r = client.get("/clients", headers=consulta_h3)
check(r.status_code == 200, "consulta GET clientes com read")
r = client.post("/clients", headers=consulta_h3, json={
    "name": "X", "client_type": "paciente", "active": True,
})
check(r.status_code == 403, "consulta POST clientes bloqueado")

# admin bypass
r = client.get("/users", headers=admin_h)
check(r.status_code == 200, "admin bypass em usuários")

print("\nTodos os testes de permissões passaram.")
