import os, sqlite3, datetime as dt
from functools import wraps
import jwt
from flask import Flask, g, jsonify, request, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash

SECRET = os.environ.get("SECRET_KEY", "dev-only-change-me")
DB = os.environ.get("DATABASE_PATH", "expenses.db")
CATEGORIES = ["Food", "Transport", "Housing", "Bills", "Health", "Fun", "Shopping", "Other"]

app = Flask(__name__, static_folder="static", static_url_path="")

def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db

@app.teardown_appcontext
def close_db(_):
    d = g.pop("db", None)
    if d: d.close()

def init_db():
    with sqlite3.connect(DB) as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS users(
          id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS expenses(
          id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          amount REAL NOT NULL, category TEXT NOT NULL, note TEXT DEFAULT '', date TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_exp_user_date ON expenses(user_id, date);""")

def token_for(uid):
    exp = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=7)
    return jwt.encode({"sub": str(uid), "exp": exp}, SECRET, algorithm="HS256")

def auth(f):
    @wraps(f)
    def wrapper(*a, **k):
        h = request.headers.get("Authorization", "")
        try:
            g.uid = int(jwt.decode(h.removeprefix("Bearer "), SECRET, algorithms=["HS256"])["sub"])
        except Exception:
            return jsonify(error="Please sign in again."), 401
        return f(*a, **k)
    return wrapper

def err(msg, code=400): return jsonify(error=msg), code

def parse_expense(data):
    try:
        amount = round(float(data.get("amount")), 2)
        date = dt.date.fromisoformat(str(data.get("date")))
    except (TypeError, ValueError):
        return None, "Enter a valid amount and date."
    if not 0 < amount < 1_000_000: return None, "Amount must be between 0 and 1,000,000."
    cat = data.get("category")
    if cat not in CATEGORIES: return None, "Choose a category from the list."
    return (amount, cat, str(data.get("note", ""))[:200], date.isoformat()), None

# ---------- auth ----------
@app.post("/api/auth/register")
def register():
    d = request.get_json(silent=True) or {}
    email, pw = str(d.get("email", "")).strip().lower(), str(d.get("password", ""))
    if "@" not in email or len(email) > 254: return err("Enter a valid email address.")
    if len(pw) < 8: return err("Password must be at least 8 characters.")
    try:
        cur = db().execute("INSERT INTO users(email,password_hash) VALUES(?,?)",
                           (email, generate_password_hash(pw)))
        db().commit()
    except sqlite3.IntegrityError:
        return err("An account with this email already exists.", 409)
    return jsonify(token=token_for(cur.lastrowid), email=email), 201

@app.post("/api/auth/login")
def login():
    d = request.get_json(silent=True) or {}
    email = str(d.get("email", "")).strip().lower()
    u = db().execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not u or not check_password_hash(u["password_hash"], str(d.get("password", ""))):
        return err("Email or password is incorrect.", 401)
    return jsonify(token=token_for(u["id"]), email=email)

# ---------- expenses ----------
@app.get("/api/categories")
def categories(): return jsonify(CATEGORIES)

@app.get("/api/expenses")
@auth
def list_expenses():
    rows = db().execute("SELECT id,amount,category,note,date FROM expenses WHERE user_id=? "
                        "ORDER BY date DESC, id DESC", (g.uid,)).fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/api/expenses")
@auth
def add_expense():
    vals, e = parse_expense(request.get_json(silent=True) or {})
    if e: return err(e)
    cur = db().execute("INSERT INTO expenses(user_id,amount,category,note,date) VALUES(?,?,?,?,?)",
                       (g.uid, *vals))
    db().commit()
    return jsonify(id=cur.lastrowid, amount=vals[0], category=vals[1], note=vals[2], date=vals[3]), 201

@app.delete("/api/expenses/<int:eid>")
@auth
def delete_expense(eid):
    cur = db().execute("DELETE FROM expenses WHERE id=? AND user_id=?", (eid, g.uid))
    db().commit()
    return ("", 204) if cur.rowcount else err("Expense not found.", 404)

@app.get("/api/summary")
@auth
def summary():
    """Aggregates for charts: spend by category for ?month=YYYY-MM, and last 6 months."""
    month = request.args.get("month") or dt.date.today().strftime("%Y-%m")
    by_cat = db().execute("SELECT category, ROUND(SUM(amount),2) total FROM expenses "
        "WHERE user_id=? AND substr(date,1,7)=? GROUP BY category ORDER BY total DESC", (g.uid, month)).fetchall()
    monthly = db().execute("SELECT substr(date,1,7) month, ROUND(SUM(amount),2) total FROM expenses "
        "WHERE user_id=? GROUP BY month ORDER BY month DESC LIMIT 6", (g.uid,)).fetchall()
    return jsonify(month=month, by_category=[dict(r) for r in by_cat],
                   monthly=[dict(r) for r in reversed(monthly)])

@app.get("/api/health")
def health(): return jsonify(status="ok")

# ---------- serve built React app ----------
@app.get("/")
@app.errorhandler(404)
def spa(_=None):
    if request.path.startswith("/api/"): return err("Not found.", 404)
    return send_from_directory(app.static_folder, "index.html")

init_db()
if __name__ == "__main__":
    app.run(debug=True, port=5000)
