# Запуск MVP

## Через Docker

```bash
docker compose up --build
```

После запуска:

- UI: `http://localhost:3000`
- health: `http://localhost:3000/api/health`
- проекты на диске: `workspace/projects`

## Локально без Docker

Нужны Node.js 18+ и установленный `xelatex`.

```bash
npm start
```

Если `xelatex` не установлен, UI и создание файлов будут работать, но `POST /api/build` вернет ошибку сборки и сохранит лог.

## Быстрая проверка API

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"demo\",\"title\":\"Demo project\"}"

curl -X POST http://localhost:3000/api/projects/demo/documents \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"lab-01\",\"type\":\"lab\",\"title\":\"Лабораторная работа 1\"}"

curl -X POST http://localhost:3000/api/build \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"demo\",\"documentId\":\"lab-01\"}"
```

ИИ-агенту достаточно редактировать файлы в `workspace/projects/<project>/documents/<document>` и дергать `POST /api/build`.
