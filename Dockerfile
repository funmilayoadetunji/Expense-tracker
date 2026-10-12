# --- build the React app ---
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Flask serves API + built frontend ---
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=web /web/dist ./static
ENV DATABASE_PATH=/data/expenses.db
RUN mkdir -p /data
CMD gunicorn -b 0.0.0.0:${PORT:-8000} app:app
