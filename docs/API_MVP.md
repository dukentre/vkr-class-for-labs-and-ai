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
  "title": "Архитектура ИВС",
  "studentName": "Чаплыгин А. Э.",
  "studentGroup": "ПО-32з",
  "teacherTitle": "доцент",
  "teacherName": "Ефремова И. Н."
}
```

Если `discipline` не передана, она берется из `title` проекта.
Если `id` не передан или передан с кириллицей/пробелами, API нормализует его в безопасный ID папки.

### `GET /api/projects/:projectId/documents`

Возвращает документы проекта.

### `DELETE /api/projects/:projectId`

Удаляет проект вместе со всеми документами.

```json
{
  "ok": true,
  "projectId": "ai-course-project"
}
```

### `POST /api/projects/:projectId/documents`

Создает документ из шаблона.

```json
{
  "id": "lab-01",
  "type": "lab",
  "title": "Лабораторная работа 1",
  "variables": {
    "НомерЛабораторной": "1",
    "Вариант": "7"
  }
}
```

Студент, группа, дисциплина, должность и ФИО преподавателя наследуются из настроек проекта.
`id` документа тоже можно не передавать: API сделает безопасный ID из названия документа.

### `DELETE /api/projects/:projectId/documents/:documentId`

Удаляет один документ проекта.

```json
{
  "ok": true,
  "projectId": "ai-course-project",
  "documentId": "lab-01"
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
