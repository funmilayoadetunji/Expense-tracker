import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api, session } from "./api.js";

const COLORS = ["#0f766e", "#1d4ed8", "#b45309", "#7c3aed", "#be123c", "#4d7c0f", "#0e7490", "#64748b"];
const money = (n) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);
const today = () => new Date().toISOString().slice(0, 10);
const monthLabel = (m) => new Date(m + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" });

function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const s = await api(`/auth/${mode === "login" ? "login" : "register"}`, { method: "POST", body: f });
      session.set(s); onAuth(s);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <main className="auth">
      <h1>Ledgerly</h1>
      <p className="lede">Log what you spend. See where it goes.</p>
      <form onSubmit={submit} className="card">
        <label>Email<input type="email" required autoComplete="email" value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>Password<input type="password" required minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"} value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="primary" disabled={busy}>{mode === "login" ? "Sign in" : "Create account"}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}

function AddExpense({ categories, onAdded }) {
  const blank = { amount: "", category: "Food", note: "", date: today() };
  const [f, setF] = useState(blank);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault(); setError("");
    try { await api("/expenses", { method: "POST", body: f }); setF({ ...blank, category: f.category }); onAdded(); }
    catch (err) { setError(err.message); }
  }
  return (
    <form className="card add" onSubmit={submit}>
      <h2>Add expense</h2>
      <div className="row">
        <label>Amount (£)<input type="number" step="0.01" min="0.01" required inputMode="decimal" value={f.amount}
          onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        <label>Date<input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
      </div>
      <div className="row">
        <label>Category<select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Note<input maxLength={200} placeholder="Optional" value={f.note}
          onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      <button className="primary">Add expense</button>
    </form>
  );
}

function Dashboard({ user, onLogout }) {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({ by_category: [], monthly: [] });
  const [month, setMonth] = useState(today().slice(0, 7));
  const [loading, setLoading] = useState(true);

  async function load() {
    const [e, s] = await Promise.all([api("/expenses"), api(`/summary?month=${month}`)]);
    setExpenses(e); setSummary(s); setLoading(false);
  }
  useEffect(() => { api("/categories").then(setCategories); }, []);
  useEffect(() => { load(); }, [month]);

  const monthTotal = useMemo(() => summary.by_category.reduce((a, c) => a + c.total, 0), [summary]);
  const visible = expenses.filter((x) => x.date.startsWith(month));
  const remove = async (id) => { await api(`/expenses/${id}`, { method: "DELETE" }); load(); };

  return (
    <main className="dash">
      <header>
        <strong className="brand">Ledgerly</strong>
        <span className="who">{user.email}</span>
        <button className="link" onClick={() => { session.clear(); onLogout(); }}>Sign out</button>
      </header>

      <section className="hero">
        <input type="month" aria-label="Month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        <p className="total">{money(monthTotal)}</p>
        <p className="sub">spent in {monthLabel(month)} · {visible.length} {visible.length === 1 ? "expense" : "expenses"}</p>
      </section>

      <div className="grid">
        <AddExpense categories={categories} onAdded={load} />

        <section className="card">
          <h2>By category</h2>
          {summary.by_category.length === 0 ? <p className="empty">Nothing logged for this month yet.</p> : (
            <div className="pie">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart><Pie data={summary.by_category} dataKey="total" nameKey="category" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {summary.by_category.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>
                  <Tooltip formatter={(v) => money(v)} /></PieChart>
              </ResponsiveContainer>
              <ul className="legend">{summary.by_category.map((c, i) => (
                <li key={c.category}><i style={{ background: COLORS[i % COLORS.length] }} />{c.category}<b>{money(c.total)}</b></li>))}</ul>
            </div>)}
        </section>

        <section className="card wide">
          <h2>Last 6 months</h2>
          {summary.monthly.length === 0 ? <p className="empty">Add an expense to see your trend.</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={summary.monthly}><XAxis dataKey="month" tickFormatter={(m) => monthLabel(m).slice(0, 3)} tickLine={false} />
                <YAxis width={48} tickLine={false} axisLine={false} tickFormatter={(v) => `£${v}`} />
                <Tooltip formatter={(v) => money(v)} labelFormatter={monthLabel} cursor={{ fill: "#e8eef5" }} />
                <Bar dataKey="total" fill="#0f766e" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>)}
        </section>

        <section className="card wide">
          <h2>{monthLabel(month)}</h2>
          {loading ? <p className="empty">Loading…</p> : visible.length === 0 ? <p className="empty">No expenses this month. Add one to get started.</p> : (
            <ul className="list">{visible.map((x) => (
              <li key={x.id}>
                <span className="date">{new Date(x.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                <span className="what"><b>{x.category}</b>{x.note && <small>{x.note}</small>}</span>
                <span className="amt">{money(x.amount)}</span>
                <button className="link danger" aria-label={`Delete ${x.category} expense`} onClick={() => remove(x.id)}>Delete</button>
              </li>))}</ul>)}
        </section>
      </div>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(session.get());
  return user ? <Dashboard user={user} onLogout={() => setUser(null)} /> : <Auth onAuth={setUser} />;
}
