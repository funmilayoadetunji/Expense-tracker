# Ledgerly — Expense Tracker

**🔗 Live demo: https://YOUR-APP-NAME.onrender.com** *(replace after deploying — see "Deploy" below)*

A full-stack expense tracker with user accounts, a responsive dashboard, and charts. React frontend, Flask (Python) backend, shipped as a single Docker container.

## Features

- **User accounts**: register and sign in; passwords hashed with Werkzeug, sessions via signed JWTs (7-day expiry)
- **Per-user data isolation**: every query is scoped to the authenticated user (covered by a test)
- **Expense management**: add and delete expenses with amount, category, date, and note; server-side validation
- **Visualizations**: spend-by-category donut for any month, and a 6-month trend bar chart (Recharts)
- **Responsive UI**: single column on phones; light and dark themes follow the system setting; keyboard-focus styles and 44px touch targets
- **One deployable unit**: Flask serves the built React app and the JSON API from the same origin

## Tech stack

| Layer | Choices |
|---|---|
| Frontend | React 18, Vite, Recharts, plain CSS |
| Backend | Python 3.12, Flask, PyJWT, SQLite, Gunicorn |
| Deploy | Docker (multi-stage), Render |

## Architecture

```
React (Vite build) ──► /api/*  (Flask) ──► SQLite
        ▲                  │
        └── static files ──┘   (served by Flask in production)
```

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | – | Create account, returns token |
| POST | `/api/auth/login` | – | Sign in, returns token |
| GET | `/api/expenses` | ✔ | List my expenses |
| POST | `/api/expenses` | ✔ | Add an expense |
| DELETE | `/api/expenses/:id` | ✔ | Delete one of my expenses |
| GET | `/api/summary?month=YYYY-MM` | ✔ | Category totals + last 6 months (aggregated in SQL) |
| GET | `/api/health` | – | Health check |

## Run locally

```bash
# Terminal 1: API on :5000
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py

# Terminal 2: UI on :5173 (proxies /api to Flask)
cd frontend
npm install
npm run dev
```

Run the backend tests: `pip install pytest && cd backend && pytest`

## Deploy (Render, free tier)

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, select the repo. `render.yaml` and the `Dockerfile` do the rest; a random `SECRET_KEY` is generated for you.
3. When the build finishes, copy the `https://….onrender.com` URL into the top of this README.

Any Docker host (Fly.io, Railway, Cloud Run) works the same way. Set `SECRET_KEY`, and `PORT` if the host requires it.

## Design decisions and trade-offs

- **Single container, same origin.** No CORS configuration and one thing to deploy.
- **SQLite for simplicity.** Free Render instances have an ephemeral disk, so data resets on redeploy. For persistence, attach a disk at `/data` or swap in Postgres; all SQL lives in `backend/app.py`.
- **JWT stored in `localStorage`.** Simple and fine for a demo. A production hardening step would be httpOnly cookies with CSRF protection.
- **Aggregation in SQL**, so the charts stay fast as the number of expenses grows.

## Ideas for next steps

Edit expenses, CSV import and export, monthly budgets with alerts, rate limiting on auth routes, Postgres, and end-to-end tests with Playwright.
