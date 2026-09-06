import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  type ZoomBlockListName,
  type ZoomBlockMode,
  type ZoomBlockSettings,
  normalizePatternList,
  normalizeSettings,
} from './settings.js';

const LISTS: readonly ZoomBlockListName[] = [
  'allowlist',
  'blocklist',
  'sharedList',
];

let settings: ZoomBlockSettings = { ...DEFAULT_SETTINGS };
const listSaveTimeoutIds: Partial<Record<ZoomBlockListName, number>> = {};
let statusTimeoutId: number | undefined;

document.addEventListener('DOMContentLoaded', () => {
  void init();
});

async function init() {
  settings = await loadSettings();

  bindModeControls();
  bindContextMenuControl();
  bindListModeControl();
  bindListControls();
  render();
}

async function loadSettings() {
  const obj = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(obj[SETTINGS_KEY]);
}

async function saveSettings() {
  settings = normalizeSettings(settings);
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  showSaved();
}

function bindModeControls() {
  document
    .querySelectorAll<HTMLInputElement>('input[name="mode"]')
    .forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        settings = { ...settings, mode: radio.value as ZoomBlockMode };
        void saveSettings().then(render);
      });
    });
}

function bindContextMenuControl() {
  getInput('show-context-menu').addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    settings = { ...settings, showContextMenu: target.checked };
    void saveSettings().then(render);
  });
}

function bindListModeControl() {
  getInput('use-separate-lists').addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    settings = { ...settings, useSeparateLists: target.checked };
    void saveSettings().then(render);
  });
}

function bindListControls() {
  for (const list of LISTS) {
    const editor = getTextArea(`${list}-editor`);
    editor.addEventListener('input', () => {
      scheduleListSave(list);
    });
    editor.addEventListener('blur', () => {
      void saveListEditor(list);
    });
  }
}

function render() {
  document
    .querySelectorAll<HTMLInputElement>('input[name="mode"]')
    .forEach((radio) => {
      radio.checked = radio.value === settings.mode;
    });

  getInput('show-context-menu').checked = settings.showContextMenu;
  getInput('use-separate-lists').checked = settings.useSeparateLists;
  getElement('lists-title').textContent = getListTitle();
  getElement('site-lists-section').hidden = settings.mode === 'all';
  getElement('shared-list-panel').hidden =
    settings.mode === 'all' || settings.useSeparateLists;
  getElement('split-lists-panel').hidden =
    settings.mode === 'all' || !settings.useSeparateLists;
  getElement('allowlist-panel').hidden = settings.mode !== 'allowlist';
  getElement('blocklist-panel').hidden = settings.mode !== 'blocklist';

  for (const list of LISTS) {
    renderListEditor(list);
  }
}

function getListTitle() {
  if (!settings.useSeparateLists) return 'Single list';
  if (settings.mode === 'allowlist') return 'Allow list';
  return 'Block list';
}

function renderListEditor(list: ZoomBlockListName) {
  const editor = getTextArea(`${list}-editor`);
  if (document.activeElement === editor) return;

  editor.value = settings[list].join('\n');
}

function scheduleListSave(list: ZoomBlockListName) {
  window.clearTimeout(listSaveTimeoutIds[list]);
  listSaveTimeoutIds[list] = window.setTimeout(() => {
    void saveListEditor(list);
  }, 500);
}

async function saveListEditor(list: ZoomBlockListName) {
  window.clearTimeout(listSaveTimeoutIds[list]);
  delete listSaveTimeoutIds[list];

  const nextList = parseListEditorValue(getTextArea(`${list}-editor`).value);
  if (listsAreEqual(settings[list], nextList)) return;

  settings = {
    ...settings,
    [list]: nextList,
  };
  await saveSettings();
}

function parseListEditorValue(value: string) {
  return normalizePatternList(
    value.split(/\r?\n/).map((line) => line.split('#')[0]),
  );
}

function listsAreEqual(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function showSaved() {
  const status = getElement('status');
  status.textContent = 'Saved';
  window.clearTimeout(statusTimeoutId);
  statusTimeoutId = window.setTimeout(() => {
    status.textContent = '';
  }, 1500);
}

function getElement(id: string) {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Missing element: ${id}`);
  }
  return element;
}

function getInput(id: string) {
  return getElement(id) as HTMLInputElement;
}

function getTextArea(id: string) {
  return getElement(id) as HTMLTextAreaElement;
}
