FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY apps/api/pyproject.toml ./pyproject.toml
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -e .

COPY apps/api/app ./app

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
