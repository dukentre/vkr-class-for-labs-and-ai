<template>
  <div class="app-shell" :class="appClasses" :style="appStyle">
    <aside class="sidebar">
      <header class="brand">
        <div class="brand-mark">SW</div>
        <div>
          <strong>SWSU LaTeX</strong>
          <span>{{ health.ok ? 'online' : 'offline' }}</span>
        </div>
      </header>

      <button class="action-button full" type="button" @click="projectFormOpen = !projectFormOpen">
        <Plus :size="17" />
        <span>Новый проект</span>
        <ChevronDown :size="16" :class="{ rotated: projectFormOpen }" />
      </button>

      <form v-if="projectFormOpen" class="sidebar-form" @submit.prevent="createProject">
        <label>
          <span>Название</span>
          <input v-model="projectForm.title" required placeholder="Архитектура ИВС" @input="syncProjectTitle">
        </label>
        <label>
          <span>ID папки</span>
          <input v-model="projectForm.id" maxlength="80" pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}" placeholder="arhitektura-ivs" @input="syncProjectId">
        </label>
        <label>
          <span>Дисциплина</span>
          <input v-model="projectForm.discipline" placeholder="если пусто — название">
        </label>
        <label>
          <span>Студент</span>
          <input v-model="projectForm.studentName" placeholder="Чаплыгин А. Э.">
        </label>
        <label>
          <span>Группа</span>
          <input v-model="projectForm.studentGroup" placeholder="ПО-32з">
        </label>
        <label>
          <span>Должность</span>
          <input v-model="projectForm.teacherTitle" placeholder="доцент">
        </label>
        <label>
          <span>Преподаватель</span>
          <input v-model="projectForm.teacherName" placeholder="Малышев А. В.">
        </label>
        <button class="primary-button full" type="submit" :disabled="busy.project">
          <Loader2 v-if="busy.project" :size="17" class="spin" />
          <Plus v-else :size="17" />
          <span>Создать</span>
        </button>
      </form>

      <label class="search-box">
        <Search :size="16" />
        <input v-model="projectSearch" placeholder="Поиск проекта">
      </label>

      <div class="project-list">
        <button
          v-for="project in filteredProjects"
          :key="project.id"
          class="project-card"
          :class="{ active: project.id === selectedProjectId }"
          type="button"
          @click="selectProject(project.id)"
        >
          <span class="project-title">{{ project.title }}</span>
          <span class="project-meta">{{ project.id }}</span>
          <span class="project-meta">{{ project.documentsCount || 0 }} док.</span>
        </button>
      </div>
    </aside>

    <div
      class="resize-handle sidebar-resize"
      role="separator"
      aria-label="Изменить ширину списка проектов"
      @dblclick="resetLayoutWidth('sidebar')"
      @pointerdown="startResize('sidebar', $event)"
    ></div>

    <main class="workspace">
      <header class="topbar">
        <div class="title-stack">
          <span class="crumbs">Проекты / {{ selectedProject?.id || 'не выбран' }}</span>
          <h1>{{ selectedProject?.title || 'Проекты' }}</h1>
          <p v-if="selectedProject">
            {{ selectedProject.defaults?.studentGroup || 'группа не задана' }} ·
            {{ selectedProject.defaults?.teacherTitle || 'должность не задана' }}
            {{ selectedProject.defaults?.teacherName || '' }}
          </p>
          <p v-else>Создайте или выберите проект слева.</p>
        </div>

        <div class="toolbar">
          <button class="ghost-button" type="button" @click="refreshAll" title="Обновить">
            <RefreshCw :size="18" />
          </button>
          <button class="primary-button" type="button" :disabled="!selectedDocument || busy.build" @click="buildDocument(selectedDocument.id)">
            <Loader2 v-if="busy.build" :size="17" class="spin" />
            <Play v-else :size="17" />
            <span>Собрать PDF</span>
          </button>
        </div>
      </header>

      <nav class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <component :is="tab.icon" :size="17" />
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <section v-if="!selectedProject" class="empty-state">
        <FolderOpen :size="34" />
        <strong>Проект не выбран</strong>
      </section>

      <template v-else>
        <section v-show="activeTab === 'documents'" class="documents-layout">
          <div class="panel document-create">
            <div class="panel-head">
              <div>
                <h2>Новый документ</h2>
                <span>{{ selectedProject.id }}</span>
              </div>
            </div>

            <form class="document-form" @submit.prevent="createDocument">
              <label>
                <span>Тип</span>
                <select v-model="documentForm.type" @change="syncDocumentTitle">
                  <option value="lab">Лабораторная</option>
                  <option value="practice">Практика</option>
                  <option value="course">Курсовая</option>
                </select>
              </label>
              <label>
                <span>ID папки</span>
                <input v-model="documentForm.id" maxlength="80" pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}" placeholder="lab-01" @input="syncDocumentId">
              </label>
              <label class="wide">
                <span>Название</span>
                <input v-model="documentForm.title" required placeholder="Архитектура ЭВМ и система команд" @input="syncDocumentTitle">
              </label>
              <label>
                <span>№ лабораторной</span>
                <input v-model="documentForm.labNumber" placeholder="1">
              </label>
              <label>
                <span>Вариант</span>
                <input v-model="documentForm.variant" placeholder="7">
              </label>
              <button class="primary-button wide" type="submit" :disabled="busy.document">
                <Loader2 v-if="busy.document" :size="17" class="spin" />
                <Plus v-else :size="17" />
                <span>Создать документ</span>
              </button>
            </form>
          </div>

          <div class="panel">
            <div class="panel-head">
              <div>
                <h2>Документы</h2>
                <span>{{ documents.length }}</span>
              </div>
            </div>

            <div class="document-list">
              <article
                v-for="doc in documents"
                :key="doc.id"
                class="document-card"
                :class="{ active: doc.id === selectedDocumentId }"
              >
                <button class="document-main" type="button" @click="selectDocument(doc.id)">
                  <span class="type-pill">{{ typeLabel(doc.type) }}</span>
                  <strong>{{ doc.title }}</strong>
                  <span>{{ doc.id }}/main.tex</span>
                </button>
                <div class="document-actions">
                  <span class="status-pill" :class="statusKind(doc)">
                    <CheckCircle2 v-if="doc.lastBuild?.ok" :size="14" />
                    <AlertCircle v-else :size="14" />
                    {{ statusLabel(doc) }}
                  </span>
                  <button class="icon-button" type="button" title="Открыть файлы" @click="openDocumentFiles(doc.id)">
                    <FileCode2 :size="17" />
                  </button>
                  <button class="icon-button" type="button" title="Собрать" @click="buildDocument(doc.id)">
                    <Play :size="17" />
                  </button>
                  <button class="icon-button danger" type="button" title="Удалить" @click="deleteDocument(doc.id)">
                    <Trash2 :size="17" />
                  </button>
                </div>
              </article>

              <div v-if="!documents.length" class="empty-inline">
                <FileText :size="28" />
                <strong>Документов пока нет</strong>
              </div>
            </div>
          </div>
        </section>

        <section v-show="activeTab === 'settings'" class="panel settings-panel">
          <div class="panel-head">
            <div>
              <h2>Титульник</h2>
              <span>{{ selectedProject.id }}</span>
            </div>
            <button class="danger-button" type="button" @click="deleteProject(selectedProject.id)">
              <Trash2 :size="17" />
              <span>Удалить проект</span>
            </button>
          </div>

          <form class="settings-form" @submit.prevent="saveProjectSettings">
            <label>
              <span>Название проекта</span>
              <input v-model="settingsForm.title" required>
            </label>
            <label>
              <span>Дисциплина</span>
              <input v-model="settingsForm.discipline" placeholder="если пусто — название проекта">
            </label>
            <label>
              <span>Студент</span>
              <input v-model="settingsForm.studentName" placeholder="Чаплыгин А. Э.">
            </label>
            <label>
              <span>Группа</span>
              <input v-model="settingsForm.studentGroup" placeholder="ПО-32з">
            </label>
            <label>
              <span>Должность преподавателя</span>
              <input v-model="settingsForm.teacherTitle" placeholder="доцент">
            </label>
            <label>
              <span>Преподаватель</span>
              <input v-model="settingsForm.teacherName" placeholder="Малышев А. В.">
            </label>
            <button class="primary-button" type="submit" :disabled="busy.settings">
              <Loader2 v-if="busy.settings" :size="17" class="spin" />
              <Save v-else :size="17" />
              <span>Сохранить</span>
            </button>
          </form>
        </section>

        <section v-if="activeTab === 'files'" class="files-layout">
          <div class="panel file-tree-panel">
            <div class="panel-head">
              <div>
                <h2>Файлы</h2>
                <span>{{ files.filter((item) => item.type === 'file').length }}</span>
              </div>
              <button class="ghost-button" type="button" title="Обновить файлы" @click="loadFiles({ keepCurrent: true })">
                <RefreshCw :size="17" />
              </button>
            </div>

            <div class="file-tree">
              <button
                v-for="item in files"
                :key="item.path"
                class="file-row"
                :class="{ active: item.path === selectedFilePath, muted: item.type === 'dir' }"
                :style="{ '--depth': item.depth }"
                type="button"
                :disabled="item.type === 'dir'"
                @click="selectFile(item.path)"
              >
                <FolderTree v-if="item.type === 'dir'" :size="16" />
                <FileCode2 v-else :size="16" />
                <span>{{ item.name }}</span>
              </button>
            </div>
          </div>

          <div class="panel editor-panel">
            <div class="editor-head">
              <div class="file-title">
                <span class="type-pill">{{ editorLanguageLabel }}</span>
                <strong>{{ selectedFilePath || 'Файл не выбран' }}</strong>
                <span v-if="selectedFile">{{ formatSize(selectedFile.size) }}</span>
              </div>
              <div class="toolbar">
                <span v-if="fileDirty" class="status-pill orange">есть изменения</span>
                <button class="primary-button" type="button" :disabled="!selectedFile?.editable || !fileDirty || busy.file" @click="saveFile">
                  <Loader2 v-if="busy.file" :size="17" class="spin" />
                  <Save v-else :size="17" />
                  <span>Сохранить</span>
                </button>
              </div>
            </div>

            <CodeEditor
              v-if="selectedFilePath"
              v-model="fileContent"
              class="monaco-host"
              :language="editorLanguage"
              :readonly="!selectedFile?.editable"
              @save="saveFile"
            />
            <div v-else class="empty-state compact">
              <FileCode2 :size="32" />
              <strong>Выберите файл</strong>
            </div>
          </div>
        </section>

        <section v-show="activeTab === 'history'" class="panel history-panel">
          <div class="panel-head">
            <div>
              <h2>История сборок</h2>
              <span>{{ selectedProject.id }}</span>
            </div>
          </div>
          <div class="history-list">
            <article v-for="doc in documents" :key="doc.id" class="history-row">
              <div>
                <strong>{{ doc.title }}</strong>
                <span>{{ doc.id }}</span>
              </div>
              <span class="status-pill" :class="statusKind(doc)">{{ statusLabel(doc) }}</span>
              <span>{{ doc.lastBuild?.finishedAt ? formatDate(doc.lastBuild.finishedAt) : '—' }}</span>
            </article>
          </div>
        </section>
      </template>
    </main>

    <div
      class="resize-handle preview-resize"
      role="separator"
      aria-label="Изменить ширину PDF"
      @dblclick="resetLayoutWidth('preview')"
      @pointerdown="startResize('preview', $event)"
    ></div>

    <aside class="preview">
      <section class="runtime-strip">
        <div>
          <strong>Build API</strong>
          <span>{{ health.projectsRoot || statusMessage }}</span>
        </div>
        <span class="status-pill" :class="health.ok ? 'green' : 'red'">{{ health.ok ? 'online' : 'offline' }}</span>
      </section>

      <section class="panel pdf-panel">
        <div class="panel-head">
          <div>
            <h2>PDF</h2>
            <span>{{ selectedDocument?.title || 'документ не выбран' }}</span>
          </div>
          <button class="icon-button" type="button" title="Открыть PDF" :disabled="!activePdfUrl" @click="openPdf">
            <ExternalLink :size="17" />
          </button>
        </div>

        <iframe v-if="pdfSrc" :src="pdfSrc" title="PDF preview"></iframe>
        <div v-else class="pdf-empty">
          <PanelRightOpen :size="34" />
          <strong>PDF появится после сборки</strong>
        </div>
      </section>

      <section class="panel log-panel">
        <div class="panel-head">
          <div>
            <h2>Лог</h2>
            <span>{{ selectedDocument?.id || '—' }}</span>
          </div>
          <button class="icon-button" type="button" title="Загрузить лог" :disabled="!selectedDocument" @click="loadSelectedLog">
            <BookOpen :size="17" />
          </button>
        </div>
        <pre>{{ logText }}</pre>
      </section>
    </aside>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, reactive, ref } from 'vue';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileCode2,
  FileText,
  FolderOpen,
  FolderTree,
  History,
  Loader2,
  PanelRightOpen,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Trash2
} from '@lucide/vue';

const CodeEditor = defineAsyncComponent(() => import('./components/CodeEditor.vue'));

const LAYOUT_STORAGE_KEY = 'swsu-latex-layout-v2';
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

const tabs = [
  { id: 'documents', label: 'Документы', icon: FileText },
  { id: 'settings', label: 'Титульник', icon: Settings },
  { id: 'files', label: 'Файлы', icon: FileCode2 },
  { id: 'history', label: 'История', icon: History }
];

const projects = ref([]);
const documents = ref([]);
const files = ref([]);
const selectedProjectId = ref(localStorage.getItem('swsu-latex-selected-project') || '');
const selectedDocumentId = ref(localStorage.getItem('swsu-latex-selected-document') || '');
const selectedFilePath = ref('');
const selectedFile = ref(null);
const fileContent = ref('');
const savedFileContent = ref('');
const activeTab = ref('documents');
const projectSearch = ref('');
const projectFormOpen = ref(false);
const statusMessage = ref('готово');
const logText = ref('Соберите документ, чтобы увидеть лог.');
const pdfCacheKey = ref(Date.now());
const isResizing = ref(false);

const health = reactive({
  ok: false,
  projectsRoot: ''
});

const busy = reactive({
  project: false,
  settings: false,
  document: false,
  build: false,
  file: false
});

const layout = reactive(readLayout());

const projectForm = reactive({
  id: '',
  title: '',
  discipline: '',
  studentName: '',
  studentGroup: 'ПО-32з',
  teacherTitle: 'доцент',
  teacherName: 'Малышев А. В.'
});

const settingsForm = reactive({
  title: '',
  discipline: '',
  studentName: '',
  studentGroup: '',
  teacherTitle: '',
  teacherName: ''
});

const documentForm = reactive({
  type: 'lab',
  id: '',
  title: '',
  labNumber: '1',
  variant: ''
});

const previousProjectSlug = ref('');
const previousDocumentSlug = ref('');

const selectedProject = computed(() => projects.value.find((project) => project.id === selectedProjectId.value) || null);
const selectedDocument = computed(() => documents.value.find((doc) => doc.id === selectedDocumentId.value) || null);
const activePdfUrl = computed(() => (selectedDocument.value?.lastBuild?.ok ? selectedDocument.value.pdfUrl : ''));
const pdfSrc = computed(() => (activePdfUrl.value ? `${activePdfUrl.value}?t=${pdfCacheKey.value}` : ''));
const fileDirty = computed(() => fileContent.value !== savedFileContent.value);
const editorLanguage = computed(() => languageForPath(selectedFilePath.value));
const editorLanguageLabel = computed(() => {
  if (editorLanguage.value === 'latex') return 'LaTeX';
  if (editorLanguage.value === 'json') return 'JSON';
  if (editorLanguage.value === 'markdown') return 'Markdown';
  return 'Text';
});
const filteredProjects = computed(() => {
  const query = projectSearch.value.trim().toLowerCase();
  const sorted = [...projects.value].sort((a, b) => {
    const dateSort = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    return dateSort || a.id.localeCompare(b.id);
  });
  if (!query) return sorted;
  return sorted.filter((project) => `${project.id} ${project.title}`.toLowerCase().includes(query));
});
const appClasses = computed(() => ({
  'pdf-open': Boolean(pdfSrc.value),
  'is-resizing': isResizing.value
}));
const appStyle = computed(() => {
  const style = {};
  if (layout.sidebarWidth) style['--sidebar-width'] = `${layout.sidebarWidth}px`;
  if (layout.previewWidth) style['--preview-width'] = `${layout.previewWidth}px`;
  return style;
});

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(payload.error || response.statusText);
  return payload;
}

function readLayout() {
  try {
    return JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveLayout() {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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

function syncProjectTitle() {
  const next = slugify(projectForm.title, `project-${Date.now()}`);
  if (!projectForm.id || projectForm.id === previousProjectSlug.value) {
    projectForm.id = next;
    previousProjectSlug.value = next;
  }
  if (!projectForm.discipline) projectForm.discipline = projectForm.title;
}

function syncProjectId() {
  projectForm.id = slugify(projectForm.id);
  previousProjectSlug.value = projectForm.id;
}

function syncDocumentTitle() {
  const next = slugify(documentForm.title || documentForm.type, `${documentForm.type}-${Date.now()}`);
  if (!documentForm.id || documentForm.id === previousDocumentSlug.value) {
    documentForm.id = next;
    previousDocumentSlug.value = next;
  }
}

function syncDocumentId() {
  documentForm.id = slugify(documentForm.id);
  previousDocumentSlug.value = documentForm.id;
}

function resetProjectForm() {
  Object.assign(projectForm, {
    id: '',
    title: '',
    discipline: '',
    studentName: '',
    studentGroup: 'ПО-32з',
    teacherTitle: 'доцент',
    teacherName: 'Малышев А. В.'
  });
  previousProjectSlug.value = '';
}

function resetDocumentForm() {
  Object.assign(documentForm, {
    type: 'lab',
    id: '',
    title: '',
    labNumber: '1',
    variant: ''
  });
  previousDocumentSlug.value = '';
}

function fillSettingsForm() {
  const project = selectedProject.value;
  if (!project) return;
  const defaults = project.defaults || {};
  Object.assign(settingsForm, {
    title: project.title || project.id,
    discipline: defaults.discipline || project.title || '',
    studentName: defaults.studentName || '',
    studentGroup: defaults.studentGroup || '',
    teacherTitle: defaults.teacherTitle || '',
    teacherName: defaults.teacherName || ''
  });
}

async function loadHealth() {
  try {
    const payload = await api('/api/health');
    health.ok = true;
    health.projectsRoot = payload.projectsRoot;
  } catch (error) {
    health.ok = false;
    health.projectsRoot = error.message;
  }
}

async function refreshAll() {
  await loadHealth();
  await loadProjects();
}

async function loadProjects() {
  const payload = await api('/api/projects');
  projects.value = payload.projects || [];
  if (selectedProjectId.value && !projects.value.some((project) => project.id === selectedProjectId.value)) {
    selectedProjectId.value = '';
  }
  if (!selectedProjectId.value && projects.value.length) {
    selectedProjectId.value = [...projects.value].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0].id;
  }
  if (selectedProjectId.value) {
    localStorage.setItem('swsu-latex-selected-project', selectedProjectId.value);
    fillSettingsForm();
    await loadDocuments();
    await loadFiles({ keepCurrent: true });
  } else {
    documents.value = [];
    files.value = [];
    selectedDocumentId.value = '';
    clearFile();
  }
}

async function selectProject(projectId) {
  if (!(await confirmDiscardFile())) return;
  selectedProjectId.value = projectId;
  selectedDocumentId.value = '';
  localStorage.setItem('swsu-latex-selected-project', projectId);
  localStorage.removeItem('swsu-latex-selected-document');
  clearFile();
  fillSettingsForm();
  await loadDocuments();
  await loadFiles({ keepCurrent: false });
}

async function createProject() {
  busy.project = true;
  try {
    const payload = {
      ...projectForm,
      id: slugify(projectForm.id || projectForm.title, `project-${Date.now()}`),
      discipline: projectForm.discipline || projectForm.title
    };
    const result = await api('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    selectedProjectId.value = result.project.id;
    statusMessage.value = `Проект создан: ${result.project.path}`;
    resetProjectForm();
    projectFormOpen.value = false;
    await loadProjects();
  } catch (error) {
    statusMessage.value = error.message;
    logText.value = error.message;
  } finally {
    busy.project = false;
  }
}

async function saveProjectSettings() {
  if (!selectedProjectId.value) return;
  busy.settings = true;
  try {
    const result = await api(`/api/projects/${encodeURIComponent(selectedProjectId.value)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...settingsForm,
        discipline: settingsForm.discipline || settingsForm.title
      })
    });
    statusMessage.value = `Настройки сохранены: ${result.project.path}`;
    await loadProjects();
  } catch (error) {
    statusMessage.value = error.message;
    logText.value = error.message;
  } finally {
    busy.settings = false;
  }
}

async function deleteProject(projectId) {
  const project = projects.value.find((item) => item.id === projectId);
  if (!window.confirm(`Удалить проект "${project?.title || projectId}" со всеми документами?`)) return;
  try {
    await api(`/api/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
    if (selectedProjectId.value === projectId) {
      selectedProjectId.value = '';
      selectedDocumentId.value = '';
      localStorage.removeItem('swsu-latex-selected-project');
      localStorage.removeItem('swsu-latex-selected-document');
      clearFile();
    }
    await loadProjects();
  } catch (error) {
    logText.value = error.message;
  }
}

async function loadDocuments() {
  if (!selectedProjectId.value) return;
  const payload = await api(`/api/projects/${encodeURIComponent(selectedProjectId.value)}/documents`);
  documents.value = payload.documents || [];
  if (selectedDocumentId.value && !documents.value.some((doc) => doc.id === selectedDocumentId.value)) {
    selectedDocumentId.value = '';
  }
  if (!selectedDocumentId.value && documents.value.length) {
    selectedDocumentId.value = documents.value[0].id;
  }
  if (selectedDocumentId.value) {
    localStorage.setItem('swsu-latex-selected-document', selectedDocumentId.value);
  }
}

function selectDocument(documentId) {
  selectedDocumentId.value = documentId;
  localStorage.setItem('swsu-latex-selected-document', documentId);
  pdfCacheKey.value = Date.now();
}

async function createDocument() {
  if (!selectedProjectId.value) return;
  busy.document = true;
  try {
    const variables = {
      'Тема': documentForm.title || undefined,
      'НомерЛабораторной': documentForm.labNumber || undefined,
      'Вариант': documentForm.variant || undefined
    };
    Object.keys(variables).forEach((key) => variables[key] === undefined && delete variables[key]);
    const result = await api(`/api/projects/${encodeURIComponent(selectedProjectId.value)}/documents`, {
      method: 'POST',
      body: JSON.stringify({
        id: slugify(documentForm.id || documentForm.title, `${documentForm.type}-${Date.now()}`),
        type: documentForm.type,
        title: documentForm.title,
        variables
      })
    });
    selectedDocumentId.value = result.document.id;
    statusMessage.value = `Документ создан: ${result.document.path}`;
    resetDocumentForm();
    await loadProjects();
    await loadFiles({ preferredPath: `documents/${result.document.id}/main.tex` });
  } catch (error) {
    statusMessage.value = error.message;
    logText.value = error.message;
  } finally {
    busy.document = false;
  }
}

async function deleteDocument(documentId) {
  const doc = documents.value.find((item) => item.id === documentId);
  if (!window.confirm(`Удалить документ "${doc?.title || documentId}"?`)) return;
  try {
    await api(`/api/projects/${encodeURIComponent(selectedProjectId.value)}/documents/${encodeURIComponent(documentId)}`, {
      method: 'DELETE'
    });
    if (selectedDocumentId.value === documentId) {
      selectedDocumentId.value = '';
      localStorage.removeItem('swsu-latex-selected-document');
    }
    await loadProjects();
  } catch (error) {
    logText.value = error.message;
  }
}

async function buildDocument(documentId) {
  if (!documentId || !selectedProjectId.value) return;
  if (fileDirty.value && selectedFile.value?.editable && window.confirm('Сохранить текущий файл перед сборкой?')) {
    await saveFile();
  }
  selectedDocumentId.value = documentId;
  busy.build = true;
  logText.value = 'Сборка запущена...';
  try {
    const result = await api('/api/build', {
      method: 'POST',
      body: JSON.stringify({
        projectId: selectedProjectId.value,
        documentId
      })
    });
    logText.value = `PDF сохранен:\n${result.pdfPath}\n\nЛог:\n${result.logPath}`;
    pdfCacheKey.value = Date.now();
    await loadDocuments();
  } catch (error) {
    logText.value = error.message;
    await loadSelectedLog();
  } finally {
    busy.build = false;
  }
}

async function loadSelectedLog() {
  const doc = selectedDocument.value;
  if (!doc) return;
  try {
    const response = await fetch(`${doc.logUrl}?t=${Date.now()}`);
    logText.value = response.ok ? await response.text() : 'Лог пока не создан.';
  } catch (error) {
    logText.value = error.message;
  }
}

function openPdf() {
  if (activePdfUrl.value) window.open(activePdfUrl.value, '_blank');
}

async function openDocumentFiles(documentId) {
  selectDocument(documentId);
  activeTab.value = 'files';
  await loadFiles({ preferredPath: `documents/${documentId}/main.tex` });
}

async function loadFiles({ preferredPath = '', keepCurrent = false } = {}) {
  if (!selectedProjectId.value) return;
  const payload = await api(`/api/projects/${encodeURIComponent(selectedProjectId.value)}/files`);
  files.value = payload.files || [];
  const fileRows = files.value.filter((item) => item.type === 'file');
  const currentExists = keepCurrent && selectedFilePath.value && fileRows.some((item) => item.path === selectedFilePath.value);
  const documentMain = selectedDocumentId.value ? `documents/${selectedDocumentId.value}/main.tex` : '';
  const target =
    preferredPath ||
    (currentExists ? selectedFilePath.value : '') ||
    (documentMain && fileRows.some((item) => item.path === documentMain) ? documentMain : '') ||
    fileRows.find((item) => item.path.endsWith('.tex'))?.path ||
    fileRows[0]?.path ||
    '';

  if (!target) {
    clearFile();
    return;
  }
  if (target !== selectedFilePath.value || !selectedFile.value) {
    await selectFile(target, { force: true });
  }
}

async function selectFile(filePath, { force = false } = {}) {
  if (!force && !(await confirmDiscardFile())) return;
  busy.file = true;
  try {
    const payload = await api(`/api/projects/${encodeURIComponent(selectedProjectId.value)}/file?path=${encodeURIComponent(filePath)}`);
    selectedFilePath.value = payload.file.path;
    selectedFile.value = payload.file;
    fileContent.value = payload.file.content;
    savedFileContent.value = payload.file.content;
  } catch (error) {
    logText.value = error.message;
  } finally {
    busy.file = false;
  }
}

async function saveFile() {
  if (!selectedProjectId.value || !selectedFilePath.value || !selectedFile.value?.editable) return;
  busy.file = true;
  try {
    const payload = await api(`/api/projects/${encodeURIComponent(selectedProjectId.value)}/file`, {
      method: 'PUT',
      body: JSON.stringify({
        path: selectedFilePath.value,
        content: fileContent.value
      })
    });
    selectedFile.value = {
      ...selectedFile.value,
      size: payload.file.size,
      updatedAt: payload.file.updatedAt
    };
    const index = files.value.findIndex((item) => item.path === selectedFilePath.value);
    if (index >= 0) files.value[index] = { ...files.value[index], ...payload.file };
    savedFileContent.value = fileContent.value;
    statusMessage.value = `Файл сохранен: ${payload.file.path}`;
  } catch (error) {
    logText.value = error.message;
  } finally {
    busy.file = false;
  }
}

function clearFile() {
  selectedFilePath.value = '';
  selectedFile.value = null;
  fileContent.value = '';
  savedFileContent.value = '';
}

async function confirmDiscardFile() {
  if (!fileDirty.value) return true;
  return window.confirm('Есть несохраненные изменения. Перейти без сохранения?');
}

function languageForPath(filePath) {
  const lower = String(filePath || '').toLowerCase();
  if (lower.endsWith('.tex') || lower.endsWith('.cls') || lower.endsWith('.sty')) return 'latex';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.md')) return 'markdown';
  return 'plaintext';
}

function typeLabel(type) {
  return {
    lab: 'Лаба',
    practice: 'Практика',
    course: 'Курсовая'
  }[type] || type;
}

function statusKind(doc) {
  if (!doc.lastBuild) return 'orange';
  return doc.lastBuild.ok ? 'green' : 'red';
}

function statusLabel(doc) {
  if (!doc.lastBuild) return 'не собран';
  return doc.lastBuild.ok ? 'pdf готов' : 'ошибка';
}

function formatSize(size) {
  if (size < 1024) return `${size} Б`;
  return `${(size / 1024).toFixed(1)} КБ`;
}

function formatDate(value) {
  return new Date(value).toLocaleString('ru-RU');
}

function startResize(part, event) {
  if (window.innerWidth <= 1180) return;
  event.preventDefault();
  const startX = event.clientX;
  const handle = event.currentTarget;
  const startWidth = part === 'sidebar'
    ? Number(layout.sidebarWidth || 300)
    : Number(layout.previewWidth || 560);
  isResizing.value = true;
  handle.setPointerCapture(event.pointerId);

  function onPointerMove(moveEvent) {
    if (part === 'sidebar') {
      layout.sidebarWidth = clamp(startWidth + moveEvent.clientX - startX, 240, 420);
    } else {
      layout.previewWidth = clamp(startWidth + startX - moveEvent.clientX, 420, 940);
      layout.previewTouched = true;
    }
    saveLayout();
  }

  function onPointerUp(upEvent) {
    handle.releasePointerCapture(upEvent.pointerId);
    isResizing.value = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  }

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

function resetLayoutWidth(part) {
  if (part === 'sidebar') {
    delete layout.sidebarWidth;
  } else {
    delete layout.previewWidth;
    layout.previewTouched = false;
  }
  saveLayout();
}

onMounted(async () => {
  await refreshAll();
});
</script>
