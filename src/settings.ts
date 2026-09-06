export const SETTINGS_KEY = 'zoomBlockSettings';
export const TAB_OVERRIDES_KEY = 'zoomBlockTabOverrides';

export type ZoomBlockMode = 'all' | 'allowlist' | 'blocklist';
export type ZoomBlockListName = 'allowlist' | 'blocklist' | 'sharedList';

export interface ZoomBlockSettings {
  mode: ZoomBlockMode;
  showContextMenu: boolean;
  useSeparateLists: boolean;
  allowlist: string[];
  blocklist: string[];
  sharedList: string[];
}

export type TabOverrides = Record<string, boolean>;

export const DEFAULT_SETTINGS: ZoomBlockSettings = {
  mode: 'all',
  showContextMenu: true,
  useSeparateLists: false,
  allowlist: [],
  blocklist: [],
  sharedList: [],
};

const MODES: readonly ZoomBlockMode[] = ['all', 'allowlist', 'blocklist'];

export function normalizePattern(pattern: string) {
  return pattern.trim().toLowerCase();
}

export function normalizePatternList(patterns: readonly unknown[]) {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    if (typeof pattern !== 'string') continue;

    const normalized = normalizePattern(pattern);
    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function normalizeSettings(value: unknown): ZoomBlockSettings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS };

  const mode = value['mode'];
  const showContextMenu = value['showContextMenu'];
  const useSeparateLists = value['useSeparateLists'];
  const useSharedList = value['useSharedList'];
  const allowlist = value['allowlist'];
  const blocklist = value['blocklist'];
  const sharedList = value['sharedList'];

  return {
    mode: isMode(mode) ? mode : DEFAULT_SETTINGS.mode,
    showContextMenu:
      typeof showContextMenu === 'boolean'
        ? showContextMenu
        : DEFAULT_SETTINGS.showContextMenu,
    useSeparateLists:
      typeof useSeparateLists === 'boolean'
        ? useSeparateLists
        : typeof useSharedList === 'boolean'
          ? !useSharedList
          : DEFAULT_SETTINGS.useSeparateLists,
    allowlist: Array.isArray(allowlist) ? normalizePatternList(allowlist) : [],
    blocklist: Array.isArray(blocklist) ? normalizePatternList(blocklist) : [],
    sharedList: Array.isArray(sharedList)
      ? normalizePatternList(sharedList)
      : [],
  };
}

export function normalizeTabOverrides(value: unknown): TabOverrides {
  if (!isRecord(value)) return {};

  const result: TabOverrides = {};
  for (const [tabId, blocked] of Object.entries(value)) {
    if (!/^\d+$/.test(tabId) || typeof blocked !== 'boolean') continue;
    result[tabId] = blocked;
  }

  return result;
}

export function isUrlBlocked(settings: ZoomBlockSettings, url?: string) {
  switch (settings.mode) {
    case 'all':
      return true;
    case 'allowlist':
      return !matchesAnyPattern(getPatternsForMode(settings, 'allowlist'), url);
    case 'blocklist':
      return matchesAnyPattern(getPatternsForMode(settings, 'blocklist'), url);
  }
}

export function getPatternsForMode(
  settings: ZoomBlockSettings,
  mode = settings.mode,
) {
  if (!settings.useSeparateLists) return settings.sharedList;
  return mode === 'allowlist' ? settings.allowlist : settings.blocklist;
}

export function getControllingListName(
  settings: ZoomBlockSettings,
): ZoomBlockListName | undefined {
  if (settings.mode === 'all') return undefined;
  if (!settings.useSeparateLists) return 'sharedList';
  return settings.mode === 'blocklist' ? 'blocklist' : 'allowlist';
}

export function matchesAnyPattern(patterns: readonly string[], url?: string) {
  return patterns.some((pattern) => patternMatchesUrl(pattern, url));
}

export function patternMatchesUrl(pattern: string, url?: string) {
  const normalized = normalizePattern(pattern);
  const target = parseUrlTarget(url);
  if (!normalized || target === undefined) return false;

  if (isHostOnlyPattern(normalized)) {
    if (normalized.startsWith('*.')) {
      return hostMatches(target.hostname, normalized.slice(2));
    }

    return normalized.includes('*')
      ? wildcardMatches(normalized, target.hostname)
      : hostMatches(target.hostname, normalized);
  }

  const values = [target.href, `${target.hostname}${target.pathname}`];

  return normalized.includes('*')
    ? values.some((value) => wildcardMatches(normalized, value))
    : values.includes(normalized);
}

export function getUrlHost(url?: string) {
  return parseUrlTarget(url)?.hostname ?? '';
}

export function hostToListPattern(host: string) {
  const normalized = normalizePattern(host);
  return normalized.startsWith('www.') && normalized.length > 4
    ? `*.${normalized.slice(4)}`
    : normalized;
}

function isMode(value: unknown): value is ZoomBlockMode {
  return typeof value === 'string' && MODES.includes(value as ZoomBlockMode);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseUrlTarget(url?: string) {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    return {
      hostname: parsed.hostname.toLowerCase(),
      href: parsed.href.toLowerCase(),
      pathname: `${parsed.pathname}${parsed.search}`.toLowerCase(),
    };
  } catch {
    return undefined;
  }
}

function isHostOnlyPattern(pattern: string) {
  return !pattern.includes('://') && !pattern.includes('/');
}

function hostMatches(hostname: string, pattern: string) {
  return hostname === pattern || hostname.endsWith(`.${pattern}`);
}

function wildcardMatches(pattern: string, value: string) {
  return wildcardRegex(pattern).test(value);
}

function wildcardRegex(pattern: string) {
  const escapedParts = pattern.split('*').map(escapeRegex);
  return new RegExp(`^${escapedParts.join('.*')}$`);
}

function escapeRegex(value: string) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}
