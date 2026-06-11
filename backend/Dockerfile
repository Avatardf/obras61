FROM python:3.12-slim

WORKDIR /app

RUN pip install poetry==1.8.4 && \
    poetry config virtualenvs.create false

COPY pyproject.toml poetry.lock* ./
RUN poetry install --no-root --no-interaction --only main

COPY . .

RUN chmod +x start.sh

CMD ["./start.sh"]
