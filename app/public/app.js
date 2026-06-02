const state = {
  projects: [],
  documents: [],
  selectedProjectId: null,
  selectedDocumentId: null,
  selectedPdfUrl: null,
  selectedLogUrl: null,
  layout: {
    previewTouched: false
  }
};

const el = {
  app: document.querySelector('.app'),
  sidebar: document.querySelector('.sidebar'),
  preview: document.querySelector('.preview'),
  resizeHandles: document.querySelectorAll('[data-resize]'),
  health: document.querySelector('#health'),
  healthBadge: document.querySelector('#health-badge'),
  projects: document.querySelector('#projects'),
  documents: document.querySelector('#documents'),
  selectedProject: document.querySelector('#selected-project'),
  projectCount: document.querySelector('#project-count'),
  projectForm: document.querySelector('#project-form'),
  projectSettingsForm: document.querySelector('#project-settings-form'),
  documentForm: document.querySelector('#document-form'),
  settingsProject: document.querySelector('#settings-project'),
  refresh: document.querySelector('#refresh'),
  pdf: document.querySelector('#pdf'),
  log: document.querySelector('#log'),
  openPdf: document.querySelector('#open-pdf'),
  loadLog: document.querySelector('#load-log')
};

const LAYOUT_STORAGE_KEY = 'swsu-latex-layout-v1';

const CYRILLIC_TO_LATIN = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya'
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(payload.error || response.statusText);
  }
  return payload;
}

function showLog(message) {
  el.log.textContent = message;
}

function formJson(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function transliterate(value) {
  return String(value || '')
    .split('')
    .map((char) => CYRILLIC_TO_LATIN[char.toLowerCase()] ?? char)
    .join('');
}

function slugify(value, fallback = '') {
  const slug = transliterate(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
}

function selectedProject() {
  return state.projects.find((item) => item.id === state.selectedProjectId) || null;
}

function projectDefaults(project) {
  return project.defaults || {};
}

function bindDisciplinePrefill(form) {
  const titleInput = form.elements.title;
  const disciplineInput = form.elements.discipline;
  let previousTitle = titleInput.value;

  titleInput.addEventListener('input', () => {
    const title = titleInput.value;
    if (!disciplineInput.value.trim() || disciplineInput.value === previousTitle) {
      disciplineInput.value = title;
    }
    previousTitle = title;
  });

  disciplineInput.addEventListener('input', () => {
    if (!disciplineInput.value.trim()) {
      previousTitle = titleInput.value;
    }
  });

  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      previousTitle = titleInput.value;
    });
  });

  return () => {
    previousTitle = titleInput.value;
  };
}

function bindSafeIdPrefill(form, prefix) {
  const titleInput = form.elements.title;
  const idInput = form.elements.id;
  const getPrefix = () => (typeof prefix === 'function' ? prefix() : prefix);
  let previousGenerated = idInput.value;

  function generatedId() {
    return slugify(titleInput.value, `${getPrefix()}-${Date.now()}`);
  }

  titleInput.addEventListener('input', () => {
    const nextId = generatedId();
    if (!idInput.value.trim() || idInput.value === previousGenerated) {
      idInput.value = nextId;
      previousGenerated = nextId;
    }
  });

  idInput.addEventListener('input', () => {
    idInput.value = slugify(idInput.value);
    previousGenerated = idInput.value;
  });

  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      previousGenerated = idInput.value;
    });
  });
}

function badge(text, kind = '') {
  return `<span class="badge ${kind}">${text}</span>`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function readLayout() {
  try {
    return JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeLayout(nextLayout) {
  state.layout = { ...state.layout, ...nextLayout };
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state.layout));
}

function setLayoutWidth(variableName, value) {
  el.app.style.setProperty(variableName, `${Math.round(value)}px`);
}

function applySavedLayout() {
  const saved = readLayout();
  state.layout = {
    previewTouched: Boolean(saved.previewTouched),
    sidebarWidth: saved.sidebarWidth,
    previewWidth: saved.previewWidth
  };
  if (saved.sidebarWidth) {
    setLayoutWidth('--sidebar-width', clamp(Number(saved.sidebarWidth), 180, 380));
  }
  if (saved.previewWidth) {
    setLayoutWidth('--preview-width', clamp(Number(saved.previewWidth), 360, 920));
  }
}

function resetLayoutWidth(part) {
  if (part === 'sidebar') {
    el.app.style.removeProperty('--sidebar-width');
    writeLayout({ sidebarWidth: null });
    return;
  }
  el.app.style.removeProperty('--preview-width');
  writeLayout({ previewWidth: null, previewTouched: false });
  setPdfOpen(Boolean(el.pdf.getAttribute('src')));
}

function setPdfOpen(isOpen) {
  el.app.classList.toggle('pdf-open', isOpen);
  if (window.innerWidth <= 1220 || state.layout.previewTouched) return;

  if (isOpen) {
    const focusedWidth = clamp(window.innerWidth * 0.42, 560, 760);
    setLayoutWidth('--preview-width', focusedWidth);
  } else {
    el.app.style.removeProperty('--preview-width');
  }
}

function bindResizers() {
  for (const handle of el.resizeHandles) {
    handle.addEventListener('dblclick', () => resetLayoutWidth(handle.dataset.resize));
    handle.addEventListener('pointerdown', (event) => {
      if (window.innerWidth <= 1220) return;
      event.preventDefault();
      const part = handle.dataset.resize;
      const startX = event.clientX;
      const startWidth = part === 'sidebar'
        ? el.sidebar.getBoundingClientRect().width
        : el.preview.getBoundingClientRect().width;
      handle.setPointerCapture(event.pointerId);
      handle.classList.add('active');
      el.app.classList.add('is-resizing');

      function onPointerMove(moveEvent) {
        if (part === 'sidebar') {
          const nextWidth = clamp(startWidth + moveEvent.clientX - startX, 180, 380);
          setLayoutWidth('--sidebar-width', nextWidth);
          writeLayout({ sidebarWidth: Math.round(nextWidth) });
          return;
        }

        const maxPreviewWidth = Math.max(360, window.innerWidth - el.sidebar.getBoundingClientRect().width - 540);
        const nextWidth = clamp(startWidth + startX - moveEvent.clientX, 360, Math.min(980, maxPreviewWidth));
        setLayoutWidth('--preview-width', nextWidth);
        writeLayout({ previewWidth: Math.round(nextWidth), previewTouched: true });
      }

      function onPointerUp(upEvent) {
        handle.releasePointerCapture(upEvent.pointerId);
        handle.classList.remove('active');
        el.app.classList.remove('is-resizing');
        handle.removeEventListener('pointermove', onPointerMove);
        handle.removeEventListener('pointerup', onPointerUp);
        handle.removeEventListener('pointercancel', onPointerUp);
      }

      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerUp);
      handle.addEventListener('pointercancel', onPointerUp);
    });
  }
}

function renderProjects() {
  el.projectCount.textContent = String(state.projects.length);
  if (!state.projects.length) {
    el.projects.innerHTML = '<p>Пока нет проектов. Создайте первый сверху.</p>';
    return;
  }

  el.projects.innerHTML = state.projects.map((project) => `
    <article class="project ${project.id === state.selectedProjectId ? 'active' : ''}" data-project-id="${project.id}">
      <div class="project-row">
        <strong>${project.title}</strong>
        <button class="secondary danger" data-action="delete-project">Удалить</button>
      </div>
      <p>${project.documentsCount || 0} документов · ${project.path}</p>
      <p>${projectDefaults(project).studentGroup || 'группа не задана'} · ${projectDefaults(project).teacherTitle || 'должность не задана'} ${projectDefaults(project).teacherName || ''}</p>
    </article>
  `).join('');

  for (const item of el.projects.querySelectorAll('.project')) {
    item.addEventListener('click', () => selectProject(item.dataset.projectId));
    item.querySelector('[data-action="delete-project"]').addEventListener('click', (event) => {
      event.stopPropagation();
      deleteProjectById(item.dataset.projectId);
    });
  }
}

function fillProjectSettings() {
  const project = selectedProject();
  el.settingsProject.textContent = project ? project.id : 'проект не выбран';
  el.projectSettingsForm.querySelector('button').disabled = !project;
  for (const input of el.projectSettingsForm.elements) {
    if (input.name) input.disabled = !project;
  }
  if (!project) {
    el.projectSettingsForm.reset();
    return;
  }
  const defaults = projectDefaults(project);
  el.projectSettingsForm.elements.title.value = project.title || '';
  el.projectSettingsForm.elements.discipline.value = defaults.discipline || project.title || '';
  el.projectSettingsForm.elements.studentName.value = defaults.studentName || '';
  el.projectSettingsForm.elements.studentGroup.value = defaults.studentGroup || '';
  el.projectSettingsForm.elements.teacherTitle.value = defaults.teacherTitle || '';
  el.projectSettingsForm.elements.teacherName.value = defaults.teacherName || '';
  syncSettingsDisciplinePrefill();
}

function prefillDocumentForm() {
  const project = selectedProject();
  if (!project) return;
  const type = el.documentForm.elements.type.value;
  if (!el.documentForm.elements.title.value && type === 'lab') {
    el.documentForm.elements.title.placeholder = 'Архитектура ЭВМ и система команд';
  }
}

function renderDocuments() {
  const project = selectedProject();
  el.selectedProject.textContent = project ? project.id : 'проект не выбран';
  el.documentForm.querySelector('button').disabled = !project;
  fillProjectSettings();
  prefillDocumentForm();

  if (!project) {
    el.documents.innerHTML = '<p>Выберите проект, чтобы увидеть документы.</p>';
    return;
  }
  if (!state.documents.length) {
    el.documents.innerHTML = '<p>В проекте еще нет документов.</p>';
    return;
  }

  el.documents.innerHTML = state.documents.map((doc) => {
    const status = doc.lastBuild ? (doc.lastBuild.ok ? badge('pdf готов', 'green') : badge('ошибка', 'red')) : badge('не собран', 'orange');
    return `
      <article class="document ${doc.id === state.selectedDocumentId ? 'active' : ''}" data-document-id="${doc.id}">
        <div class="doc-meta">
          ${badge(doc.type)}
          <strong>${doc.title}</strong>
          <p>${doc.id}/main.tex</p>
          ${status}
        </div>
        <div class="doc-actions">
          <button class="secondary" data-action="select">Выбрать</button>
          <button class="primary" data-action="build">Собрать</button>
          <button class="secondary danger" data-action="delete">Удалить</button>
        </div>
      </article>
    `;
  }).join('');

  for (const item of el.documents.querySelectorAll('.document')) {
    const id = item.dataset.documentId;
    item.querySelector('[data-action="select"]').addEventListener('click', () => selectDocument(id));
    item.querySelector('[data-action="build"]').addEventListener('click', () => buildDocument(id));
    item.querySelector('[data-action="delete"]').addEventListener('click', () => deleteDocumentById(id));
  }
}

async function loadHealth() {
  try {
    const health = await api('/api/health');
    el.health.textContent = health.projectsRoot;
    el.healthBadge.textContent = 'online';
    el.healthBadge.className = 'badge green';
  } catch (error) {
    el.health.textContent = error.message;
    el.healthBadge.textContent = 'offline';
    el.healthBadge.className = 'badge red';
  }
}

async function loadProjects() {
  const payload = await api('/api/projects');
  state.projects = payload.projects;
  if (state.selectedProjectId && !state.projects.some((project) => project.id === state.selectedProjectId)) {
    state.selectedProjectId = state.projects[0] ? state.projects[0].id : null;
  }
  if (!state.selectedProjectId && state.projects.length) {
    state.selectedProjectId = state.projects[0].id;
  }
  renderProjects();
  fillProjectSettings();
  await loadDocuments();
}

async function loadDocuments() {
  if (!state.selectedProjectId) {
    state.documents = [];
    state.selectedDocumentId = null;
    state.selectedPdfUrl = null;
    state.selectedLogUrl = null;
    el.pdf.removeAttribute('src');
    setPdfOpen(false);
    el.openPdf.disabled = true;
    el.loadLog.disabled = true;
    renderDocuments();
    return;
  }
  const payload = await api(`/api/projects/${encodeURIComponent(state.selectedProjectId)}/documents`);
  state.documents = payload.documents;
  if (state.selectedDocumentId && !state.documents.some((doc) => doc.id === state.selectedDocumentId)) {
    state.selectedDocumentId = null;
    state.selectedPdfUrl = null;
    state.selectedLogUrl = null;
    el.pdf.removeAttribute('src');
    setPdfOpen(false);
    el.openPdf.disabled = true;
    el.loadLog.disabled = true;
  }
  if (!state.selectedDocumentId && state.documents.length) {
    selectDocument(state.documents[0].id, false);
  }
  renderDocuments();
}

async function selectProject(projectId) {
  state.selectedProjectId = projectId;
  state.selectedDocumentId = null;
  state.selectedPdfUrl = null;
  state.selectedLogUrl = null;
  el.pdf.removeAttribute('src');
  setPdfOpen(false);
  el.openPdf.disabled = true;
  el.loadLog.disabled = true;
  renderProjects();
  fillProjectSettings();
  await loadDocuments();
}

function selectDocument(documentId, shouldRender = true) {
  const doc = state.documents.find((item) => item.id === documentId);
  if (!doc) return;
  state.selectedDocumentId = doc.id;
  state.selectedPdfUrl = doc.pdfUrl;
  state.selectedLogUrl = doc.logUrl;
  el.openPdf.disabled = false;
  el.loadLog.disabled = false;
  if (doc.lastBuild && doc.lastBuild.ok) {
    el.pdf.src = `${doc.pdfUrl}?t=${Date.now()}`;
    setPdfOpen(true);
  } else {
    el.pdf.removeAttribute('src');
    setPdfOpen(false);
  }
  if (shouldRender) renderDocuments();
}

async function buildDocument(documentId) {
  selectDocument(documentId);
  el.log.textContent = 'Сборка запущена...';
  try {
    const result = await api('/api/build', {
      method: 'POST',
      body: JSON.stringify({
        projectId: state.selectedProjectId,
        documentId
      })
    });
    el.log.textContent = `PDF сохранен:\n${result.pdfPath}\n\nЛог:\n${result.logPath}`;
    el.pdf.src = `${result.pdfUrl}?t=${Date.now()}`;
    setPdfOpen(true);
  } catch (error) {
    el.log.textContent = error.message;
    await loadSelectedLog();
  } finally {
    await loadProjects();
  }
}

async function deleteProjectById(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  const name = project ? project.title : projectId;
  if (!window.confirm(`Удалить проект "${name}" со всеми документами?`)) return;
  try {
    await api(`/api/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
    if (state.selectedProjectId === projectId) {
      state.selectedProjectId = null;
      state.selectedDocumentId = null;
      state.selectedPdfUrl = null;
      state.selectedLogUrl = null;
      el.pdf.removeAttribute('src');
      setPdfOpen(false);
      el.openPdf.disabled = true;
      el.loadLog.disabled = true;
    }
    showLog(`Проект удалён: ${projectId}`);
    await loadProjects();
  } catch (error) {
    showLog(error.message);
  }
}

async function deleteDocumentById(documentId) {
  const doc = state.documents.find((item) => item.id === documentId);
  const name = doc ? doc.title : documentId;
  if (!window.confirm(`Удалить документ "${name}"?`)) return;
  try {
    await api(`/api/projects/${encodeURIComponent(state.selectedProjectId)}/documents/${encodeURIComponent(documentId)}`, {
      method: 'DELETE'
    });
    if (state.selectedDocumentId === documentId) {
      state.selectedDocumentId = null;
      state.selectedPdfUrl = null;
      state.selectedLogUrl = null;
      el.pdf.removeAttribute('src');
      setPdfOpen(false);
      el.openPdf.disabled = true;
      el.loadLog.disabled = true;
    }
    showLog(`Документ удалён: ${documentId}`);
    await loadProjects();
  } catch (error) {
    showLog(error.message);
  }
}

async function loadSelectedLog() {
  if (!state.selectedLogUrl) return;
  try {
    const response = await fetch(`${state.selectedLogUrl}?t=${Date.now()}`);
    el.log.textContent = await response.text();
  } catch (error) {
    el.log.textContent = error.message;
  }
}

el.projectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const payload = formJson(el.projectForm);
    payload.id = slugify(payload.id || payload.title, `project-${Date.now()}`);
    payload.discipline = payload.discipline || payload.title;
    const result = await api('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    el.projectForm.reset();
    state.selectedProjectId = result.project.id;
    showLog(`Проект создан: ${result.project.path}`);
    await loadProjects();
  } catch (error) {
    showLog(error.message);
  }
});

el.projectSettingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.selectedProjectId) return;
  try {
    const payload = formJson(el.projectSettingsForm);
    payload.discipline = payload.discipline || payload.title;
    const result = await api(`/api/projects/${encodeURIComponent(state.selectedProjectId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    const index = state.projects.findIndex((item) => item.id === state.selectedProjectId);
    if (index >= 0) state.projects[index] = result.project;
    showLog(`Настройки проекта сохранены: ${result.project.path}`);
    await loadProjects();
  } catch (error) {
    showLog(error.message);
  }
});

el.documentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.selectedProjectId) return;
  try {
    const form = formJson(el.documentForm);
    const id = slugify(form.id || form.title, `${form.type}-${Date.now()}`);
    const variables = {
      'Тема': form.title || undefined,
      'НомерЛабораторной': form.labNumber || undefined,
      'Вариант': form.variant || undefined
    };
    Object.keys(variables).forEach((key) => variables[key] === undefined && delete variables[key]);
    const result = await api(`/api/projects/${encodeURIComponent(state.selectedProjectId)}/documents`, {
      method: 'POST',
      body: JSON.stringify({
        id,
        type: form.type,
        title: form.title,
        variables
      })
    });
    el.documentForm.reset();
    state.selectedDocumentId = result.document.id;
    showLog(`Документ создан: ${result.document.path}`);
    await loadDocuments();
  } catch (error) {
    showLog(error.message);
  }
});

el.refresh.addEventListener('click', () => loadProjects());
el.openPdf.addEventListener('click', () => {
  if (state.selectedPdfUrl) window.open(state.selectedPdfUrl, '_blank');
});
el.loadLog.addEventListener('click', loadSelectedLog);
window.addEventListener('resize', () => setPdfOpen(Boolean(el.pdf.getAttribute('src'))));

bindSafeIdPrefill(el.projectForm, 'project');
bindSafeIdPrefill(el.documentForm, () => el.documentForm.elements.type.value || 'doc');
bindDisciplinePrefill(el.projectForm);
const syncSettingsDisciplinePrefill = bindDisciplinePrefill(el.projectSettingsForm);
applySavedLayout();
bindResizers();

loadHealth();
loadProjects().catch((error) => {
  el.projects.innerHTML = `<p>${error.message}</p>`;
});
