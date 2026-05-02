FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY apps/agent/pyproject.toml ./pyproject.toml
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -e .

COPY apps/agent/agent.py ./agent.py
COPY apps/agent/prompts.py ./prompts.py

CMD ["python", "agent.py", "start"]
