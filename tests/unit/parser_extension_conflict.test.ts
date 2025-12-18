import { LanguageParser } from '../../src/utils/parser';
import { logger } from '../../src/utils/logger';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

vi.mock('../../src/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn().mockReturnValue({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../src/languages', async () => {
  const actual = await vi.importActual<typeof import('../../src/languages')>('../../src/languages');
  const mockConfigs = {
    ...actual.languageConfigurations,
    conflict_lang: {
      name: 'conflict_lang',
      fileSuffixes: ['.js'], // Conflicts with javascript
      parser: null,
      queries: [],
    },
  };
  return {
    ...actual,
    languageConfigurations: mockConfigs,
    parseLanguageNames: vi.fn((languagesEnv?: string) => {
      if (languagesEnv === 'javascript,conflict_lang') {
        return ['javascript', 'conflict_lang'];
      }
      const languageString = languagesEnv || Object.keys(mockConfigs).join(',');
      return languageString
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name in mockConfigs);
    }),
  };
});

describe('LanguageParser Extension Conflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not warn when .h is registered to both c and cpp', () => {
    process.env.SEMANTIC_CODE_INDEXER_LANGUAGES = 'c,cpp';
    new LanguageParser();

    // Verify no warning was logged for .h
    const warnCalls = (logger.warn as Mock).mock.calls;
    const hWarning = warnCalls.find((call: unknown[]) =>
      (call[0] as string).includes('File extension ".h" is registered to both')
    );

    expect(hWarning).toBeUndefined();
  });

  it('should still warn for other duplicate extensions', () => {
    process.env.SEMANTIC_CODE_INDEXER_LANGUAGES = 'javascript,conflict_lang';
    new LanguageParser();

    // Verify warning was logged for .js
    const warnCalls = (logger.warn as Mock).mock.calls;
    const jsWarning = warnCalls.find((call: unknown[]) =>
      (call[0] as string).includes('File extension ".js" is registered to both')
    );

    expect(jsWarning).toBeDefined();
    expect(jsWarning?.[0]).toContain('File extension ".js" is registered to both "javascript" and "conflict_lang"');
  });
});
