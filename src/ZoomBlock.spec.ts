import { ZoomBlock } from './ZoomBlock.js';
import { SETTINGS_KEY } from './settings.js';

const mockChrome = {
  action: {
    onClicked: { addListener: jest.fn() },
    setIcon: jest.fn(),
    setPopup: jest.fn(),
  },
  runtime: {
    getURL: jest.fn(),
    onInstalled: { addListener: jest.fn() },
    onStartup: { addListener: jest.fn() },
  },
  storage: { local: { get: jest.fn(), remove: jest.fn(), set: jest.fn() } },
  tabs: {
    onRemoved: { addListener: jest.fn() },
    onUpdated: { addListener: jest.fn() },
    query: jest.fn(),
    setZoomSettings: jest.fn(),
  },
} as unknown as typeof chrome;

describe('Zoom Block', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('instantiates', () => {
    const mockZoomBlock = new ZoomBlock(mockChrome);
    expect(mockZoomBlock).toBeInstanceOf(ZoomBlock);
  });

  it('hides the context menu for tabs where zoom settings fail', async () => {
    const mockChromeWithMenu = createMockChrome({
      [SETTINGS_KEY]: {
        allowlist: [],
        blocklist: [],
        mode: 'blocklist',
        sharedList: ['chromewebstore.google.com'],
        showContextMenu: true,
        useSeparateLists: false,
      },
    });
    const mockZoomBlock = new ZoomBlock(mockChromeWithMenu);
    (mockChromeWithMenu.tabs.setZoomSettings as jest.Mock).mockRejectedValue(
      new Error('Zoom settings are unavailable.'),
    );

    await mockZoomBlock.applyToTab(1, 'https://chromewebstore.google.com/');
    await mockZoomBlock.updateContextMenuForTab({
      active: true,
      id: 1,
      url: 'https://chromewebstore.google.com/',
    } as chrome.tabs.Tab);

    expect(mockChromeWithMenu.contextMenus.update).toHaveBeenLastCalledWith(
      'zoom-block-add-site',
      { visible: false },
    );
  });

  it('shows the context menu again after zoom settings work', async () => {
    const mockChromeWithMenu = createMockChrome({
      [SETTINGS_KEY]: {
        allowlist: [],
        blocklist: [],
        mode: 'blocklist',
        sharedList: ['example.com'],
        showContextMenu: true,
        useSeparateLists: false,
      },
    });
    const mockZoomBlock = new ZoomBlock(mockChromeWithMenu);
    (mockChromeWithMenu.tabs.setZoomSettings as jest.Mock).mockRejectedValueOnce(
      new Error('Zoom settings are unavailable.'),
    );

    await mockZoomBlock.applyToTab(1, 'https://chromewebstore.google.com/');
    await mockZoomBlock.applyToTab(1, 'https://example.com/');
    await mockZoomBlock.updateContextMenuForTab({
      active: true,
      id: 1,
      url: 'https://example.com/',
    } as chrome.tabs.Tab);

    expect(mockChromeWithMenu.contextMenus.update).toHaveBeenLastCalledWith(
      'zoom-block-add-site',
      { visible: true },
    );
  });

  it('ignores stale tab ids when a tab closes during a zoom update', async () => {
    const mockChromeWithMenu = createMockChrome({
      [SETTINGS_KEY]: {
        allowlist: [],
        blocklist: [],
        mode: 'all',
        sharedList: [],
        showContextMenu: true,
        useSeparateLists: false,
      },
    });
    const mockZoomBlock = new ZoomBlock(mockChromeWithMenu);
    (mockChromeWithMenu.tabs.setZoomSettings as jest.Mock).mockRejectedValue(
      new Error('No tab with id: 123.'),
    );

    await expect(
      mockZoomBlock.applyToTab(123, 'https://example.com/'),
    ).resolves.toBeUndefined();

    expect(mockChromeWithMenu.action.setIcon).not.toHaveBeenCalled();
    expect(mockChromeWithMenu.action.setPopup).not.toHaveBeenCalled();
  });
});

function createMockChrome(initialStorage: Record<string, unknown> = {}) {
  const storage: Record<string, unknown> = { ...initialStorage };

  return {
    action: {
      onClicked: { addListener: jest.fn() },
      setIcon: jest.fn(),
      setPopup: jest.fn(),
      setTitle: jest.fn(),
    },
    contextMenus: {
      create: jest.fn(),
      onClicked: { addListener: jest.fn() },
      removeAll: jest.fn(),
      update: jest.fn(),
    },
    runtime: {
      getURL: jest.fn((path: string) => `chrome-extension://id/${path}`),
      onInstalled: { addListener: jest.fn() },
      onStartup: { addListener: jest.fn() },
    },
    storage: {
      local: {
        get: jest.fn(async (key?: string | string[]) => {
          if (key === undefined) return { ...storage };
          if (Array.isArray(key)) {
            return Object.fromEntries(key.map((name) => [name, storage[name]]));
          }
          return { [key]: storage[key] };
        }),
        remove: jest.fn(async (key: string | string[]) => {
          for (const name of Array.isArray(key) ? key : [key]) {
            delete storage[name];
          }
        }),
        set: jest.fn(async (value: Record<string, unknown>) => {
          Object.assign(storage, value);
        }),
      },
      onChanged: { addListener: jest.fn() },
    },
    tabs: {
      get: jest.fn(),
      onActivated: { addListener: jest.fn() },
      onRemoved: { addListener: jest.fn() },
      onUpdated: { addListener: jest.fn() },
      query: jest.fn(async () => []),
      setZoomSettings: jest.fn(),
    },
  } as unknown as typeof chrome;
}
