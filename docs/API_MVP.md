# API MVP

API нужен не только фронтенду, но и ИИ-агенту. Агент редактирует физические `.tex`-файлы, затем дергает build endpoint и получает сохраненный PDF.

## Endpoints

### `GET /api/projects`

Возвращает список папок из `workspace/projects`.

### `POST /api/projects`

Создает проект.

```json
{
  "id": "ai-course-project",
  "title": "Курсовая по ПиАПС"
}
```

### `GET /api/projects/:projectId/documents`

Возвращает документы проекта.

### `POST /api/projects/:projectId/documents`

Создает документ из шаблона.

```json
{
  "id": "lab-01",
  "type": "lab",
  "title": "Лабораторная работа 1",
  "variables": {
    "Автор": "И. И. Иванов",
    "Группа": "ПО-92б",
    "Дисциплина": "Проектирование и архитектура программных систем"
  }
}
```

### `POST /api/build`

Собирает конкретный документ и сохраняет PDF.

```json
{
  "projectId": "ai-course-project",
  "documentId": "lab-01"
}
```

Ответ:

```json
{
  "ok": true,
  "projectId": "ai-course-project",
  "documentId": "lab-01",
  "pdfUrl": "/api/projects/ai-course-project/documents/lab-01/pdf",
  "pdfPath": "workspace/projects/ai-course-project/documents/lab-01/build/main.pdf",
  "logPath": "workspace/projects/ai-course-project/documents/lab-01/build/main.log"
}
```

### `GET /api/projects/:projectId/documents/:documentId/pdf`

Отдает последний собранный PDF.

### `GET /api/projects/:projectId/documents/:documentId/log`

Отдает лог последней сборки.

## Команда сборки

Для MVP достаточно:

```bash
xelatex -interaction=nonstopmode -halt-on-error -output-directory build main.tex
xelatex -interaction=nonstopmode -halt-on-error -output-directory build main.tex
```

Два прохода нужны для содержания, ссылок, счетчиков и списков.

## Требование к безопасности

`projectId` и `documentId` нельзя напрямую склеивать с путями. Backend должен разрешать путь и проверять, что он остается внутри `workspace/projects`.

