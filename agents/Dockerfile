FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

COPY server.py ./
COPY frontend ./frontend
COPY planAgent ./planAgent
COPY tools ./tools
COPY voiceAgent ./voiceAgent

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
