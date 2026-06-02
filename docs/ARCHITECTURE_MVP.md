# Архитектура MVP

## Файловая модель

```text
workspace/
  projects/
    my-project/
      project.json
      shared/
        images/
      documents/
        lab-01/
          document.json
          main.tex
          setup.tex
          vkr.cls
          xltabular.sty
          sections/
            Введение.tex
            ХодРаботы.tex
            Заключение.tex
          images/
          build/
            main.pdf
            main.log
        practice-report/
          document.json
          main.tex
          setup.tex
          vkr.cls
          xltabular.sty
          sections/
          images/
          build/
```

Для MVP проще копировать `vkr.cls`, `setup.tex` и `xltabular.sty` в каждый документ. Это делает документ автономным и понятным для ИИ-агента.
Позже можно вынести класс в общую read-only библиотеку, если станет больно обновлять копии.

## Манифест проекта

`project.json`:

```json
{
  "id": "my-project",
  "title": "Проект по дисциплине",
  "createdAt": "2026-06-02T18:00:00Z",
  "documentsDir": "documents"
}
```

## Манифест документа

`document.json`:

```json
{
  "id": "lab-01",
  "type": "lab",
  "title": "Лабораторная работа 1",
  "entry": "main.tex",
  "output": "build/main.pdf",
  "lastBuild": null
}
```

## Runtime

Минимальный состав:

- backend: Node.js HTTP server из `app/server.js`;
- frontend: простой SPA, который ходит в API и показывает PDF;
- builder: Docker image с TeX Live и Times New Roman-совместимыми шрифтами;
- volume: `workspace/projects` примонтирован в backend/builder.

## Поток сборки

1. UI или ИИ-агент вызывает `POST /api/build`.
2. Backend проверяет, что `projectId` и `documentId` существуют внутри `workspace/projects`.
3. Backend создает `build/`, запускает `xelatex` в папке документа.
4. PDF и `.log` остаются в `documents/<documentId>/build/`.
5. API возвращает путь/URL к PDF и краткий статус.
6. UI обновляет iframe предпросмотра.

## Что не делаем в MVP

- Не выносим оформление из текущих файлов преподавателя.
- Не делаем сложный редактор LaTeX в браузере.
- Не делаем многопользовательские роли.
- Не делаем синхронизацию с Git из UI.
- Не делаем очередь задач, пока сборка быстрая и локальная.
