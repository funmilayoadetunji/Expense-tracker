import os, tempfile
os.environ["DATABASE_PATH"] = os.path.join(tempfile.mkdtemp(), "t.db")
from app import app

def test_flow():
    c = app.test_client()
    t = c.post("/api/auth/register", json={"email": "a@b.co", "password": "password1"}).json["token"]
    h = {"Authorization": f"Bearer {t}"}
    assert c.get("/api/expenses").status_code == 401
    r = c.post("/api/expenses", headers=h, json={"amount": 12.5, "category": "Food", "date": "2026-10-01"})
    assert r.status_code == 201
    assert c.post("/api/expenses", headers=h, json={"amount": -1, "category": "Food", "date": "2026-10-01"}).status_code == 400
    assert c.get("/api/summary?month=2026-10", headers=h).json["by_category"][0]["total"] == 12.5
    t2 = c.post("/api/auth/register", json={"email": "x@y.co", "password": "password2"}).json["token"]
    h2 = {"Authorization": f"Bearer {t2}"}
    assert c.get("/api/expenses", headers=h2).json == []
    assert c.delete(f"/api/expenses/{r.json['id']}", headers=h2).status_code == 404
