import {
  getControllingListName,
  hostToListPattern,
  isUrlBlocked,
  normalizeSettings,
  patternMatchesUrl,
} from './settings.js';

describe('settings', () => {
  it('normalizes settings', () => {
    expect(
      normalizeSettings({
        mode: 'blocklist',
        useSharedList: true,
        allowlist: [' Example.com ', 'example.com', '', 42],
        blocklist: ['*.zoom.us'],
        sharedList: ['meet.google.com'],
      }),
    ).toEqual({
      mode: 'blocklist',
      showContextMenu: true,
      useSeparateLists: false,
      allowlist: ['example.com'],
      blocklist: ['*.zoom.us'],
      sharedList: ['meet.google.com'],
    });
  });

  it('normalizes the context menu setting', () => {
    expect(normalizeSettings({}).showContextMenu).toBe(true);
    expect(normalizeSettings({ showContextMenu: false }).showContextMenu).toBe(
      false,
    );
  });

  it('prefers the separate-list setting over the legacy shared-list setting', () => {
    expect(
      normalizeSettings({
        useSeparateLists: true,
        useSharedList: true,
      }).useSeparateLists,
    ).toBe(true);
  });

  it('matches host entries against the host and subdomains', () => {
    expect(patternMatchesUrl('example.com', 'https://www.example.com/a')).toBe(
      true,
    );
    expect(patternMatchesUrl('example.com', 'https://notexample.com')).toBe(
      false,
    );
  });

  it('matches wildcard entries', () => {
    expect(patternMatchesUrl('*.example.com', 'https://example.com')).toBe(
      true,
    );
    expect(patternMatchesUrl('*.example.com', 'https://cdn.example.com')).toBe(
      true,
    );
    expect(patternMatchesUrl('*zoom*', 'https://app.zoom.us/j/123')).toBe(true);
    expect(
      patternMatchesUrl(
        'https://example.com/path/*',
        'https://example.com/path/a',
      ),
    ).toBe(true);
  });

  it('computes blocked state from split lists', () => {
    expect(
      isUrlBlocked(
        {
          mode: 'allowlist',
          showContextMenu: true,
          useSeparateLists: true,
          allowlist: ['example.com'],
          blocklist: [],
          sharedList: [],
        },
        'https://www.example.com',
      ),
    ).toBe(false);
    expect(
      isUrlBlocked(
        {
          mode: 'blocklist',
          showContextMenu: true,
          useSeparateLists: true,
          allowlist: [],
          blocklist: ['example.com'],
          sharedList: [],
        },
        'https://www.example.com',
      ),
    ).toBe(true);
  });

  it('uses the shared list when enabled', () => {
    expect(
      isUrlBlocked(
        {
          mode: 'allowlist',
          showContextMenu: true,
          useSeparateLists: false,
          allowlist: [],
          blocklist: [],
          sharedList: ['example.com'],
        },
        'https://www.example.com',
      ),
    ).toBe(false);
    expect(
      isUrlBlocked(
        {
          mode: 'blocklist',
          showContextMenu: true,
          useSeparateLists: false,
          allowlist: [],
          blocklist: [],
          sharedList: ['example.com'],
        },
        'https://www.example.com',
      ),
    ).toBe(true);
  });

  it('does not expose a controlling list in global mode', () => {
    expect(
      getControllingListName({
        mode: 'all',
        showContextMenu: true,
        useSeparateLists: false,
        allowlist: [],
        blocklist: [],
        sharedList: [],
      }),
    ).toBeUndefined();
  });

  it('converts only the www host prefix to a wildcard pattern', () => {
    expect(hostToListPattern('www.youtube.com')).toBe('*.youtube.com');
    expect(hostToListPattern('music.youtube.com')).toBe('music.youtube.com');
    expect(hostToListPattern('youtube.com')).toBe('youtube.com');
  });
});
