/*

  Zoom Block - A browser extension that disables zooming.
  Copyright (C) 2024 Wesley Warnell
  https://github.com/warnellw/Zoom-Block

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

import {
  SETTINGS_KEY,
  TAB_OVERRIDES_KEY,
  getControllingListName,
  getUrlHost,
  hostToListPattern,
  isUrlBlocked,
  normalizeSettings,
  normalizeTabOverrides,
} from './settings.js';

type ChromeType = typeof chrome;
type TabUpdateInfo = {
  status?: chrome.tabs.TabStatus;
  url?: string;
};

const ADD_SITE_CONTEXT_MENU_ID = 'zoom-block-add-site';

export class ZoomBlock {
  private browser: ChromeType;
  private inactiveTabs: Set<number>;
  private popup: string;
  private images: Map<string, Record<string, string>>;

  constructor(api: ChromeType) {
    this.browser = api;
    this.inactiveTabs = new Set();

    this.popup = this.browser.runtime.getURL('assets/popup.html');

    this.images = new Map()
      .set('red', {
        16: this.browser.runtime.getURL('assets/icons/red16.png'),
        24: this.browser.runtime.getURL('assets/icons/red24.png'),
        32: this.browser.runtime.getURL('assets/icons/red32.png'),
      })
      .set('green', {
        16: this.browser.runtime.getURL('assets/icons/green16.png'),
        24: this.browser.runtime.getURL('assets/icons/green24.png'),
        32: this.browser.runtime.getURL('assets/icons/green32.png'),
      })
      .set('gray', {
        16: this.browser.runtime.getURL('assets/icons/gray16.png'),
        24: this.browser.runtime.getURL('assets/icons/gray24.png'),
        32: this.browser.runtime.getURL('assets/icons/gray32.png'),
      });
  }

  addListeners() {
    this.browser.action.onClicked.addListener(
      async (tab) => await this.iconClick(tab),
    );
    this.browser.runtime.onInstalled.addListener(async () => await this.init());
    this.browser.runtime.onStartup.addListener(async () => await this.init());
    this.browser.tabs.onRemoved.addListener(
      async (tabId) => await this.removeTabOverride(tabId),
    );
    this.browser.tabs.onUpdated.addListener(
      async (tabId, changeInfo, tab) =>
        await this.tabUpdated(tabId, changeInfo, tab),
    );
    this.browser.tabs.onActivated.addListener(
      async (activeInfo) => await this.tabActivated(activeInfo.tabId),
    );
    this.browser.contextMenus?.onClicked.addListener(
      async (info, tab) => await this.contextMenuClicked(info, tab),
    );
    this.browser.storage.onChanged.addListener(
      async (changes, areaName) => await this.storageChanged(changes, areaName),
    );
    void this.setupContextMenu();
  }

  async getSettings() {
    const obj = await this.browser.storage.local.get(SETTINGS_KEY);
    return normalizeSettings(obj[SETTINGS_KEY]);
  }

  async getTabOverrides() {
    const obj = await this.browser.storage.local.get(TAB_OVERRIDES_KEY);
    return normalizeTabOverrides(obj[TAB_OVERRIDES_KEY]);
  }

  async getTabOverride(tabId: number) {
    const overrides = await this.getTabOverrides();
    return overrides[String(tabId)];
  }

  async setTabOverride(tabId: number, blocked: boolean, baseBlocked: boolean) {
    const overrides = await this.getTabOverrides();
    const key = String(tabId);

    if (blocked === baseBlocked) {
      delete overrides[key];
    } else {
      overrides[key] = blocked;
    }

    return await this.browser.storage.local.set({
      [TAB_OVERRIDES_KEY]: overrides,
    });
  }

  async removeTabOverride(tabId: number) {
    this.inactiveTabs.delete(tabId);

    const overrides = await this.getTabOverrides();
    const key = String(tabId);
    if (!(key in overrides)) return;

    delete overrides[key];
    return await this.browser.storage.local.set({
      [TAB_OVERRIDES_KEY]: overrides,
    });
  }

  isMissingTabError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return /^No tab with id: \d+\.?$/.test(message);
  }

  async ignoreMissingTab(tabId: number, operation: () => Promise<void>) {
    try {
      await operation();
    } catch (err) {
      if (!this.isMissingTabError(err)) throw err;
      await this.removeTabOverride(tabId);
    }
  }

  async setPopup(tabId: number, hasError: boolean) {
    await this.ignoreMissingTab(tabId, async () => {
      await this.browser.action.setPopup({
        tabId,
        popup: hasError ? this.popup : '',
      });
    });
  }

  zoomConstructor(blocked: boolean): chrome.tabs.ZoomSettings {
    return {
      mode: blocked ? 'disabled' : 'automatic',
      scope: 'per-tab',
    };
  }

  async init() {
    const tabs = await this.browser.tabs.query({});
    await this.cleanupLegacyTabState(tabs);
    for (const tab of tabs) {
      await this.store(tab);
    }
    await this.updateContextMenuForActiveTab();
  }

  async store(tab: chrome.tabs.Tab) {
    if (tab.id === undefined) return;
    await this.applyToTab(tab.id, tab.url);
  }

  async applyToTab(tabId: number, url?: string) {
    try {
      const blocked = await this.getEffectiveBlocked(tabId, url);
      await this.setZoomSettings(tabId, blocked);
      this.inactiveTabs.delete(tabId);
      await this.setPopup(tabId, false);
      await this.updateIcon(tabId, blocked);
    } catch (err) {
      if (this.isMissingTabError(err)) {
        await this.removeTabOverride(tabId);
        return;
      }
      this.inactiveTabs.add(tabId);
      await this.updateIcon(tabId);
    }
  }

  async getEffectiveBlocked(tabId: number, url?: string) {
    const settings = await this.getSettings();
    const baseBlocked = isUrlBlocked(settings, url);
    const tabOverride = await this.getTabOverride(tabId);

    return tabOverride ?? baseBlocked;
  }

  async updateIcon(tabId: number, blocked?: boolean) {
    const path = this.images.get(
      blocked === true ? 'red' : blocked === false ? 'green' : 'gray',
    )!;
    await this.ignoreMissingTab(tabId, async () => {
      await this.browser.action.setIcon({
        path,
        tabId,
      });
      await this.browser.action.setTitle({
        tabId,
        title:
          blocked === true
            ? 'Zoom Block: zoom disabled'
            : blocked === false
              ? 'Zoom Block: zoom enabled'
              : 'Zoom Block: inactive on this page',
      });
    });
  }

  async setZoomSettings(tabId: number, blocked: boolean) {
    try {
      await this.browser.tabs.setZoomSettings(
        tabId,
        this.zoomConstructor(blocked),
      );
    } catch (err) {
      if (this.isMissingTabError(err)) throw err;
      await this.setPopup(tabId, true);
      throw err;
    }
  }

  async iconClick(tab: chrome.tabs.Tab) {
    if (tab.id === undefined) return;

    const tabId = tab.id;
    const settings = await this.getSettings();
    const baseBlocked = isUrlBlocked(settings, tab.url);
    const currentBlocked = (await this.getTabOverride(tabId)) ?? baseBlocked;
    const nextBlocked = !currentBlocked;

    try {
      await this.setZoomSettings(tabId, nextBlocked);
      this.inactiveTabs.delete(tabId);
      await this.setTabOverride(tabId, nextBlocked, baseBlocked);
      await this.setPopup(tabId, false);
      await this.updateIcon(tabId, nextBlocked);
    } catch (err) {
      if (this.isMissingTabError(err)) {
        await this.removeTabOverride(tabId);
        return;
      }
      this.inactiveTabs.add(tabId);
      await this.updateIcon(tabId);
    }
    await this.updateContextMenuForTab(tab);
  }

  async setupContextMenu() {
    try {
      await this.browser.contextMenus.removeAll();
      this.browser.contextMenus.create({
        id: ADD_SITE_CONTEXT_MENU_ID,
        title: 'Add/remove this site in Zoom Block list',
        contexts: ['page'],
        visible: false,
      });
      await this.updateContextMenuForActiveTab();
    } catch {
      // Context menus are unavailable on some browser-internal pages.
    }
  }

  async contextMenuClicked(
    info: chrome.contextMenus.OnClickData,
    tab?: chrome.tabs.Tab,
  ) {
    if (info.menuItemId !== ADD_SITE_CONTEXT_MENU_ID) return;
    if (tab?.id !== undefined && this.inactiveTabs.has(tab.id)) return;

    const host = getUrlHost(info.pageUrl ?? tab?.url);
    if (!host) return;

    const settings = await this.getSettings();
    if (!settings.showContextMenu) return;

    const listName = getControllingListName(settings);
    if (listName === undefined) return;

    const pattern = hostToListPattern(host);
    const currentList = settings[listName];
    const hasEntry =
      currentList.includes(pattern) ||
      (pattern !== host && currentList.includes(host));
    const nextList = hasEntry
      ? currentList.filter((value) => value !== pattern && value !== host)
      : [...currentList, pattern];

    await this.browser.storage.local.set({
      [SETTINGS_KEY]: normalizeSettings({
        ...settings,
        [listName]: nextList,
      }),
    });
    await this.init();
  }

  async updateContextMenuVisibility() {
    await this.updateContextMenuForActiveTab();
  }

  async updateContextMenuForActiveTab() {
    try {
      const [tab] = await this.browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      await this.updateContextMenuForTab(tab);
    } catch {
      await this.updateContextMenuForTab();
    }
  }

  async updateContextMenuForTab(tab?: chrome.tabs.Tab) {
    try {
      const settings = await this.getSettings();
      const isInactiveTab =
        tab?.id !== undefined && this.inactiveTabs.has(tab.id);
      await this.browser.contextMenus.update(ADD_SITE_CONTEXT_MENU_ID, {
        visible:
          settings.showContextMenu &&
          getControllingListName(settings) !== undefined &&
          !isInactiveTab,
      });
    } catch {
      // Context menus can be unavailable before creation or on restricted pages.
    }
  }

  async tabUpdated(
    tabId: number,
    changeInfo: TabUpdateInfo,
    tab: chrome.tabs.Tab,
  ) {
    if (changeInfo.status !== 'loading' && changeInfo.url === undefined) {
      return;
    }

    await this.applyToTab(tabId, changeInfo.url ?? tab.url);
    if (tab.active) {
      await this.updateContextMenuForTab(tab);
    }
  }

  async tabActivated(tabId: number) {
    try {
      const tab = await this.browser.tabs.get(tabId);
      await this.updateContextMenuForTab(tab);
    } catch {
      await this.updateContextMenuForTab();
    }
  }

  async storageChanged(
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) {
    if (areaName !== 'local' || !(SETTINGS_KEY in changes)) return;
    await this.init();
  }

  async cleanupLegacyTabState(tabs: chrome.tabs.Tab[]) {
    const allStorage = await this.browser.storage.local.get();
    const legacyKeys = Object.keys(allStorage).filter((key) =>
      /^\d+$/.test(key),
    );
    if (legacyKeys.length === 0) return;

    const liveTabIds = new Set(
      tabs
        .map((tab) => tab.id)
        .filter((tabId): tabId is number => tabId !== undefined)
        .map(String),
    );
    const overrides = await this.getTabOverrides();
    let changedOverrides = false;

    for (const key of legacyKeys) {
      if (liveTabIds.has(key) && allStorage[key] === true) {
        overrides[key] = false;
        changedOverrides = true;
      }
    }

    if (changedOverrides) {
      await this.browser.storage.local.set({ [TAB_OVERRIDES_KEY]: overrides });
    }

    await this.browser.storage.local.remove(legacyKeys);
  }
}
