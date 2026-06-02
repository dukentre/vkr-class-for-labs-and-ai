<template>
  <div ref="editorRoot" class="code-editor"></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  }
};

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: 'plaintext'
  },
  readonly: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'save']);
const editorRoot = ref(null);
let editor = null;
let model = null;

function ensureLanguages() {
  if (globalThis.__swsuLatexLanguageReady) return;
  globalThis.__swsuLatexLanguageReady = true;

  monaco.languages.register({ id: 'latex' });
  monaco.languages.setMonarchTokensProvider('latex', {
    defaultToken: '',
    tokenizer: {
      root: [
        [/%.*$/, 'comment'],
        [/\\(?:begin|end|section|subsection|subsubsection|chapter|paragraph|label|ref|cite|includegraphics|caption|item|textbf|textit|underline|input|usepackage|documentclass|newcommand|renewcommand)\b/, 'keyword'],
        [/\\[a-zA-Zа-яА-Я]+/, 'type.identifier'],
        [/\\./, 'keyword'],
        [/\$[^$]*\$/, 'string'],
        [/[{}()[\]]/, '@brackets'],
        [/[0-9]+(?:\.[0-9]+)?/, 'number']
      ]
    }
  });
  monaco.languages.setLanguageConfiguration('latex', {
    comments: { lineComment: '%' },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')']
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '$', close: '$', notIn: ['string', 'comment'] }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '$', close: '$' }
    ]
  });

  monaco.editor.defineTheme('swsu-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '7a8699', fontStyle: 'italic' },
      { token: 'keyword', foreground: '1d4ed8', fontStyle: 'bold' },
      { token: 'type.identifier', foreground: '7c3aed' },
      { token: 'string', foreground: '0f766e' },
      { token: 'number', foreground: 'b45309' }
    ],
    colors: {
      'editor.background': '#ffffff',
      'editorLineNumber.foreground': '#94a3b8',
      'editorLineNumber.activeForeground': '#1f2937',
      'editor.selectionBackground': '#bfdbfe',
      'editor.lineHighlightBackground': '#f8fafc'
    }
  });
}

onMounted(() => {
  ensureLanguages();
  model = monaco.editor.createModel(props.modelValue || '', props.language || 'plaintext');
  editor = monaco.editor.create(editorRoot.value, {
    model,
    theme: 'swsu-light',
    readOnly: props.readonly,
    automaticLayout: true,
    fontFamily: 'Consolas, "Cascadia Mono", "Courier New", monospace',
    fontSize: 14,
    lineHeight: 22,
    lineNumbers: 'on',
    minimap: { enabled: false },
    renderWhitespace: 'selection',
    scrollBeyondLastLine: false,
    tabSize: 2,
    wordWrap: 'on',
    padding: { top: 12, bottom: 12 }
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => emit('save'));
  editor.onDidChangeModelContent(() => {
    emit('update:modelValue', editor.getValue());
  });
});

watch(
  () => props.modelValue,
  (value) => {
    if (!editor || value === editor.getValue()) return;
    editor.setValue(value || '');
  }
);

watch(
  () => props.language,
  (language) => {
    if (model) monaco.editor.setModelLanguage(model, language || 'plaintext');
  }
);

watch(
  () => props.readonly,
  (readonly) => {
    if (editor) editor.updateOptions({ readOnly: readonly });
  }
);

onBeforeUnmount(() => {
  if (editor) editor.dispose();
  if (model) model.dispose();
});
</script>
