const http = require('http');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT || 3000);
const REPO_ROOT = path.resolve(__dirname, '..');
const DATA_ROOT = path.resolve(process.env.SWSU_WORKSPACE || path.join(REPO_ROOT, 'workspace'));
const PROJECTS_ROOT = path.join(DATA_ROOT, 'projects');
const TEMPLATES_ROOT = path.join(REPO_ROOT, 'templates');
const PUBLIC_ROOT = path.join(__dirname, 'public');
const SUPPORT_FILES = ['vkr.cls', 'setup.tex', 'xltabular.sty'];
const DOCUMENT_TYPES = new Set(['course', 'practice', 'lab']);
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;
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

const DEFAULT_VARIABLES = {
  'Дисциплина': 'Проектирование и архитектура программных систем',
  'Вариант': '1',
  'КодСпециальности': '09.03.04',
  'Специальность': 'Программная инженерия',
  'Тема': 'Тема работы',
  'ТемаВтораяСтрока': '',
  'НомерЛабораторной': '1',
  'ГдеПроводитсяПрактика': 'Юго-Западном государственном университете',
  'РуководительПрактПредпр': 'И. О. Фамилия',
  'ДолжнРуководительПрактПредпр': 'руководитель',
  'РуководительПрактУнивер': 'А. А. Чаплыгин',
  'ДолжнРуководительПрактУнивер': 'к.т.н. доцент',
  'Автор': 'Фамилия И. О.',
  'АвторРод': 'Иванова И.И.',
  'АвторПолностьюРод': 'Иванова Ивана Ивановича',
  'Шифр': 'хх-хх-хххх',
  'Курс': '4',
  'Группа': 'ПО-92б',
  'Руководитель': 'А. А. Чаплыгин',
  'Проверил': 'Ефремова И. Н.',
  'ДолжностьПроверяющего': 'доцент',
  'Нормоконтроль': 'А. А. Чаплыгин',
  'ЗавКаф': 'А. В. Малышев',
  'ДатаПриказа': '«07» апреля 2023~г.',
  'НомерПриказа': '1505-с',
  'СрокПредоставления': '«13» июня 2023~г.'
};

const DEFAULT_PROJECT_DEFAULTS = {
  discipline: '',
  studentName: '',
  studentGroup: 'ПО-32з',
  teacherTitle: 'доцент',
  teacherName: 'Ефремова И. Н.'
};

function cleanString(value, fallback = '') {
  const text = String(value == null ? '' : value).trim();
  return text || fallback;
}

function normalizeProjectDefaults(defaults = {}, projectTitle = '') {
  return {
    discipline: cleanString(defaults.discipline, projectTitle),
    studentName: cleanString(defaults.studentName, DEFAULT_PROJECT_DEFAULTS.studentName),
    studentGroup: cleanString(defaults.studentGroup, DEFAULT_PROJECT_DEFAULTS.studentGroup),
    teacherTitle: cleanString(defaults.teacherTitle, DEFAULT_PROJECT_DEFAULTS.teacherTitle),
    teacherName: cleanString(defaults.teacherName, DEFAULT_PROJECT_DEFAULTS.teacherName)
  };
}

function projectDefaultsToVariables(defaults, projectTitle) {
  const normalized = normalizeProjectDefaults(defaults, projectTitle);
  const variables = {
    'Дисциплина': normalized.discipline,
    'Группа': normalized.studentGroup,
    'Проверил': normalized.teacherName,
    'ДолжностьПроверяющего': normalized.teacherTitle,
    'Руководитель': normalized.teacherName,
    'РуководительПрактУнивер': normalized.teacherName,
    'ДолжнРуководительПрактУнивер': normalized.teacherTitle
  };
  if (normalized.studentName) {
    variables['Автор'] = normalized.studentName;
  }
  return variables;
}

function send(res, status, body, headers = {}) {
  const isBuffer = Buffer.isBuffer(body);
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...(isBuffer ? {} : { 'Content-Type': 'application/json; charset=utf-8' }),
    ...headers
  });
  res.end(isBuffer ? body : JSON.stringify(body, null, 2));
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': contentType
  });
  res.end(text);
}

function assertSafeId(id, label) {
  if (!SAFE_ID.test(String(id || ''))) {
    const error = new Error(`${label}: используйте латиницу, цифры, точку, нижнее подчеркивание или дефис, максимум 80 символов`);
    error.status = 400;
    throw error;
  }
  return String(id);
}

function transliterate(value) {
  return String(value || '')
    .split('')
    .map((char) => CYRILLIC_TO_LATIN[char.toLowerCase()] ?? char)
    .join('');
}

function slugify(value, fallback) {
  const slug = transliterate(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return SAFE_ID.test(slug) ? slug : fallback;
}

function safeIdFrom(value, fallbackSource, fallbackPrefix) {
  const requestedId = cleanString(value);
  if (requestedId && SAFE_ID.test(requestedId)) return requestedId;
  return assertSafeId(slugify(requestedId || fallbackSource, `${fallbackPrefix}-${Date.now()}`), fallbackPrefix);
}

function resolveInside(root, ...segments) {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...segments);
  if (target !== resolvedRoot && !target.startsWith(resolvedRoot + path.sep)) {
    const error = new Error('Resolved path is outside of workspace');
    error.status = 400;
    throw error;
  }
  return target;
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('Request body must be valid JSON');
    error.status = 400;
    throw error;
  }
}

async function ensureWorkspace() {
  await fs.mkdir(PROJECTS_ROOT, { recursive: true });
}

async function listProjects() {
  await ensureWorkspace();
  const entries = await fs.readdir(PROJECTS_ROOT, { withFileTypes: true });
  const projects = [];
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const projectDir = resolveInside(PROJECTS_ROOT, entry.name);
    const manifest = await readJson(path.join(projectDir, 'project.json'), {
      id: entry.name,
      title: entry.name,
      documentsDir: 'documents',
      defaults: normalizeProjectDefaults({}, entry.name)
    });
    manifest.defaults = normalizeProjectDefaults(manifest.defaults, manifest.title);
    const documentsDir = path.join(projectDir, manifest.documentsDir || 'documents');
    let documentsCount = 0;
    try {
      documentsCount = (await fs.readdir(documentsDir, { withFileTypes: true })).filter((item) => item.isDirectory()).length;
    } catch {}
    projects.push({ ...manifest, path: projectDir, documentsCount });
  }
  return projects.sort((a, b) => a.id.localeCompare(b.id));
}

async function createProject(body) {
  await ensureWorkspace();
  const title = String(body.title || 'Новый проект').trim();
  const id = safeIdFrom(body.id, title, 'project');
  const projectDir = resolveInside(PROJECTS_ROOT, id);
  if (fsSync.existsSync(projectDir)) {
    const error = new Error(`Project "${id}" already exists`);
    error.status = 409;
    throw error;
  }
  const manifest = {
    id,
    title,
    createdAt: new Date().toISOString(),
    documentsDir: 'documents',
    defaults: normalizeProjectDefaults({
      discipline: body.discipline,
      studentName: body.studentName,
      studentGroup: body.studentGroup,
      teacherTitle: body.teacherTitle,
      teacherName: body.teacherName
    }, title)
  };
  await fs.mkdir(path.join(projectDir, 'documents'), { recursive: true });
  await fs.mkdir(path.join(projectDir, 'shared', 'images'), { recursive: true });
  await writeJson(path.join(projectDir, 'project.json'), manifest);
  return { ...manifest, path: projectDir, documentsCount: 0 };
}

async function updateProject(projectId, body) {
  const projectDir = await getProjectDir(projectId);
  const manifestPath = path.join(projectDir, 'project.json');
  const current = await readJson(manifestPath, {
    id: projectId,
    title: projectId,
    createdAt: new Date().toISOString(),
    documentsDir: 'documents',
    defaults: {}
  });
  const title = cleanString(body.title, current.title);
  const incomingDefaults = body.defaults || body;
  const manifest = {
    ...current,
    title,
    documentsDir: current.documentsDir || 'documents',
    defaults: normalizeProjectDefaults({
      ...current.defaults,
      discipline: incomingDefaults.discipline,
      studentName: incomingDefaults.studentName,
      studentGroup: incomingDefaults.studentGroup,
      teacherTitle: incomingDefaults.teacherTitle,
      teacherName: incomingDefaults.teacherName
    }, title),
    updatedAt: new Date().toISOString()
  };
  await writeJson(manifestPath, manifest);
  const documents = await listDocuments(projectId);
  return { ...manifest, path: projectDir, documentsCount: documents.length };
}

async function getProjectDir(projectId) {
  const safeProjectId = assertSafeId(projectId, 'project id');
  const projectDir = resolveInside(PROJECTS_ROOT, safeProjectId);
  if (!fsSync.existsSync(projectDir)) {
    const error = new Error(`Project "${safeProjectId}" not found`);
    error.status = 404;
    throw error;
  }
  return projectDir;
}

async function getDocumentsDir(projectId) {
  const projectDir = await getProjectDir(projectId);
  const manifest = await readJson(path.join(projectDir, 'project.json'), { documentsDir: 'documents' });
  return resolveInside(projectDir, manifest.documentsDir || 'documents');
}

async function getDocumentDir(projectId, documentId) {
  const documentsDir = await getDocumentsDir(projectId);
  const safeDocumentId = assertSafeId(documentId, 'document id');
  const documentDir = resolveInside(documentsDir, safeDocumentId);
  if (!fsSync.existsSync(documentDir)) {
    const error = new Error(`Document "${safeDocumentId}" not found`);
    error.status = 404;
    throw error;
  }
  return { documentDir, documentId: safeDocumentId };
}

async function deleteProject(projectId) {
  const projectDir = await getProjectDir(projectId);
  await fs.rm(projectDir, { recursive: true, force: true });
  return { ok: true, projectId };
}

async function deleteDocument(projectId, documentId) {
  const target = await getDocumentDir(projectId, documentId);
  await fs.rm(target.documentDir, { recursive: true, force: true });
  return { ok: true, projectId, documentId: target.documentId };
}

async function listDocuments(projectId) {
  const documentsDir = await getDocumentsDir(projectId);
  await fs.mkdir(documentsDir, { recursive: true });
  const entries = await fs.readdir(documentsDir, { withFileTypes: true });
  const documents = [];
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const documentDir = resolveInside(documentsDir, entry.name);
    const documentManifest = await readJson(path.join(documentDir, 'document.json'), {
      id: entry.name,
      type: 'unknown',
      title: entry.name,
      entry: 'main.tex',
      output: 'build/main.pdf'
    });
    documents.push({
      ...documentManifest,
      path: documentDir,
      pdfUrl: `/api/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(entry.name)}/pdf`,
      logUrl: `/api/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(entry.name)}/log`
    });
  }
  return documents.sort((a, b) => a.id.localeCompare(b.id));
}

async function renderTemplates(root, variables) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const itemPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await renderTemplates(itemPath, variables);
      continue;
    }
    if (!/\.(tex|json|md)$/i.test(entry.name)) continue;
    const source = await fs.readFile(itemPath, 'utf8');
    const rendered = source.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const value = variables[String(key).trim()];
      return value == null ? '' : String(value);
    });
    await fs.writeFile(itemPath, rendered, 'utf8');
  }
}

async function createDocument(projectId, body) {
  const type = String(body.type || '').trim();
  if (!DOCUMENT_TYPES.has(type)) {
    const error = new Error(`Document type must be one of: ${Array.from(DOCUMENT_TYPES).join(', ')}`);
    error.status = 400;
    throw error;
  }

  const projectDir = await getProjectDir(projectId);
  const projectManifest = await readJson(path.join(projectDir, 'project.json'), {
    id: projectId,
    title: projectId,
    documentsDir: 'documents',
    defaults: {}
  });
  const documentId = safeIdFrom(body.id, body.title || type, type);
  const documentTitle = String(body.title || documentId).trim();
  const documentsDir = path.join(projectDir, projectManifest.documentsDir || 'documents');
  const documentDir = resolveInside(documentsDir, documentId);
  const templateDir = resolveInside(TEMPLATES_ROOT, type);

  if (!fsSync.existsSync(templateDir)) {
    const error = new Error(`Template "${type}" not found`);
    error.status = 500;
    throw error;
  }
  if (fsSync.existsSync(documentDir)) {
    const error = new Error(`Document "${documentId}" already exists`);
    error.status = 409;
    throw error;
  }

  await fs.cp(templateDir, documentDir, { recursive: true, errorOnExist: true });
  for (const fileName of SUPPORT_FILES) {
    await fs.copyFile(path.join(REPO_ROOT, fileName), path.join(documentDir, fileName));
  }
  await fs.mkdir(path.join(documentDir, 'images'), { recursive: true });
  await fs.mkdir(path.join(documentDir, 'build'), { recursive: true });

  const variables = {
    ...DEFAULT_VARIABLES,
    ...projectDefaultsToVariables(projectManifest.defaults, projectManifest.title || projectId),
    ...(body.variables || {}),
    id: documentId,
    type,
    title: documentTitle,
    'Тема': (body.variables && body.variables['Тема']) || documentTitle
  };
  await renderTemplates(documentDir, variables);

  const manifest = {
    id: documentId,
    type,
    title: documentTitle,
    entry: 'main.tex',
    output: 'build/main.pdf',
    passes: Number(body.passes || (type === 'lab' ? 1 : 2)),
    createdAt: new Date().toISOString(),
    lastBuild: null
  };
  await writeJson(path.join(documentDir, 'document.json'), manifest);
  return {
    ...manifest,
    path: documentDir,
    pdfUrl: `/api/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/pdf`,
    logUrl: `/api/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/log`
  };
}

function runCommand(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: false });
    let output = `$ ${command} ${args.join(' ')}\n`;
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', (error) => {
      output += `\n${error.message}\n`;
      resolve({ code: -1, output, error });
    });
    child.on('close', (code, signal) => {
      if (signal) output += `\nProcess killed by signal ${signal}\n`;
      resolve({ code, output });
    });
  });
}

async function updateLastBuild(documentDir, lastBuild) {
  const manifestPath = path.join(documentDir, 'document.json');
  const manifest = await readJson(manifestPath, {});
  await writeJson(manifestPath, { ...manifest, lastBuild });
}

async function buildDocument(body) {
  const projectId = assertSafeId(body.projectId, 'project id');
  const documentId = assertSafeId(body.documentId || body.docId, 'document id');
  const { documentDir } = await getDocumentDir(projectId, documentId);

  const buildDir = path.join(documentDir, 'build');
  const logPath = path.join(buildDir, 'main.log');
  const pdfPath = path.join(buildDir, 'main.pdf');
  const manifest = await readJson(path.join(documentDir, 'document.json'), {});
  const passes = Math.max(1, Math.min(4, Number(body.passes || manifest.passes || 2)));
  await fs.mkdir(buildDir, { recursive: true });

  const args = ['-interaction=nonstopmode', '-halt-on-error', '-output-directory', 'build', 'main.tex'];
  const startedAt = new Date().toISOString();
  let output = '';
  let ok = true;
  for (let pass = 1; pass <= passes; pass += 1) {
    const result = await runCommand('xelatex', args, documentDir);
    output += `${pass > 1 ? '\n' : ''}# pass ${pass}/${passes}\n${result.output}`;
    ok = result.code === 0;
    if (!ok) break;
  }

  if (!fsSync.existsSync(pdfPath)) ok = false;
  await fs.writeFile(logPath, output, 'utf8');

  const lastBuild = {
    ok,
    startedAt,
    finishedAt: new Date().toISOString(),
    passes,
    pdfPath,
    logPath
  };
  await updateLastBuild(documentDir, lastBuild);

  return {
    ok,
    projectId,
    documentId,
    pdfUrl: `/api/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/pdf`,
    logUrl: `/api/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/log`,
    pdfPath,
    logPath,
    error: ok ? null : 'Build failed. See logUrl.'
  };
}

async function servePdf(res, projectId, documentId) {
  const { documentDir } = await getDocumentDir(projectId, documentId);
  const pdfPath = path.join(documentDir, 'build', 'main.pdf');
  const buffer = await fs.readFile(pdfPath);
  send(res, 200, buffer, {
    'Content-Type': 'application/pdf',
    'Cache-Control': 'no-store'
  });
}

async function serveLog(res, projectId, documentId) {
  const { documentDir } = await getDocumentDir(projectId, documentId);
  const logPath = path.join(documentDir, 'build', 'main.log');
  const text = await fs.readFile(logPath, 'utf8');
  sendText(res, 200, text);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
  }[ext] || 'application/octet-stream';
}

async function serveStatic(res, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const filePath = resolveInside(PUBLIC_ROOT, relativePath);
  const buffer = await fs.readFile(filePath);
  send(res, 200, buffer, { 'Content-Type': contentType(filePath) });
}

async function route(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

  if (parts[0] !== 'api') {
    return serveStatic(res, url.pathname);
  }

  if (req.method === 'GET' && parts[1] === 'health') {
    return send(res, 200, {
      ok: true,
      runtime: 'node',
      dataRoot: DATA_ROOT,
      projectsRoot: PROJECTS_ROOT
    });
  }

  if (parts[1] === 'projects' && parts.length === 2 && req.method === 'GET') {
    return send(res, 200, { projects: await listProjects() });
  }

  if (parts[1] === 'projects' && parts.length === 2 && req.method === 'POST') {
    return send(res, 201, { project: await createProject(await parseBody(req)) });
  }

  if (parts[1] === 'projects' && parts.length === 3 && req.method === 'PATCH') {
    return send(res, 200, { project: await updateProject(parts[2], await parseBody(req)) });
  }

  if (parts[1] === 'projects' && parts.length === 3 && req.method === 'DELETE') {
    return send(res, 200, await deleteProject(parts[2]));
  }

  if (parts[1] === 'projects' && parts[3] === 'documents' && parts.length === 4 && req.method === 'GET') {
    return send(res, 200, { documents: await listDocuments(parts[2]) });
  }

  if (parts[1] === 'projects' && parts[3] === 'documents' && parts.length === 4 && req.method === 'POST') {
    return send(res, 201, { document: await createDocument(parts[2], await parseBody(req)) });
  }

  if (parts[1] === 'projects' && parts[3] === 'documents' && parts.length === 5 && req.method === 'DELETE') {
    return send(res, 200, await deleteDocument(parts[2], parts[4]));
  }

  if (parts[1] === 'projects' && parts[3] === 'documents' && parts[5] === 'pdf' && req.method === 'GET') {
    return servePdf(res, parts[2], parts[4]);
  }

  if (parts[1] === 'projects' && parts[3] === 'documents' && parts[5] === 'log' && req.method === 'GET') {
    return serveLog(res, parts[2], parts[4]);
  }

  if (parts[1] === 'build' && req.method === 'POST') {
    const result = await buildDocument(await parseBody(req));
    return send(res, result.ok ? 200 : 500, result);
  }

  send(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    const status = error.status || (error.code === 'ENOENT' ? 404 : 500);
    send(res, status, { error: error.message || 'Internal server error' });
  });
});

ensureWorkspace().then(() => {
  server.listen(PORT, () => {
    console.log(`SWSU LaTeX Lab listening on http://localhost:${PORT}`);
    console.log(`Projects root: ${PROJECTS_ROOT}`);
  });
});
