import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexerWorker } from '../src/utils/indexer_worker';
import { InMemoryQueue } from '../src/utils/in_memory_queue';
import * as elasticsearch from '../src/utils/elasticsearch';
import { CodeChunk } from '../src/utils/elasticsearch';
import { logger } from '../src/utils/logger';

vi.mock('../src/utils/elasticsearch', async () => {
  const actual = await vi.importActual('../src/utils/elasticsearch');
  return {
    ...actual,
    indexCodeChunks: vi.fn(),
  };
});

const MOCK_CHUNK: CodeChunk = {
  type: 'code',
  language: 'typescript',
  filePath: 'test.ts',
  directoryPath: '',
  directoryName: '',
  directoryDepth: 0,
  git_file_hash: 'hash1',
  git_branch: 'main',
  chunk_hash: 'chunk_hash_1',
  startLine: 1,
  endLine: 1,
  content: 'const a = 1;',
  semantic_text: 'const a = 1;',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('IndexerWorker backpressure', () => {
  let queue: InMemoryQueue;
  let concurrentWorker: IndexerWorker;
  const testIndex = 'test-index';

  beforeEach(() => {
    vi.useRealTimers();
    queue = new InMemoryQueue();
    vi.mocked(elasticsearch.indexCodeChunks).mockClear();
  });

  afterEach(() => {
    if (concurrentWorker) {
      concurrentWorker.stop();
    }
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should respect concurrency limit with slow ES responses', async () => {
    concurrentWorker = new IndexerWorker({
      queue,
      batchSize: 1,
      concurrency: 2,
      watch: false,
      logger,
      elasticsearchIndex: testIndex,
    });

    const chunks = Array.from({ length: 5 }, (_, i) => ({
      ...MOCK_CHUNK,
      chunk_hash: `chunk_${i}`,
    }));
    await queue.enqueue(chunks);

    let currentConcurrent = 0;
    let maxConcurrent = 0;

    vi.mocked(elasticsearch.indexCodeChunks).mockImplementation(async () => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      await new Promise((resolve) => setTimeout(resolve, 10));
      currentConcurrent--;
    });

    await concurrentWorker.start();

    expect(maxConcurrent).toBeLessThanOrEqual(2);
    expect(maxConcurrent).toBeGreaterThan(0);
    expect(elasticsearch.indexCodeChunks).toHaveBeenCalledTimes(5);
  });

  it('should not over-dequeue when tasks are running (size + pending check)', async () => {
    concurrentWorker = new IndexerWorker({
      queue,
      batchSize: 1,
      concurrency: 2,
      watch: false,
      logger,
      elasticsearchIndex: testIndex,
    });

    const chunks = Array.from({ length: 4 }, (_, i) => ({
      ...MOCK_CHUNK,
      chunk_hash: `chunk_${i}`,
    }));
    await queue.enqueue(chunks);

    let concurrentCount = 0;
    const concurrencySnapshots: number[] = [];

    vi.mocked(elasticsearch.indexCodeChunks).mockImplementation(async () => {
      concurrentCount++;
      concurrencySnapshots.push(concurrentCount);
      await new Promise((resolve) => setTimeout(resolve, 10));
      concurrentCount--;
    });

    await concurrentWorker.start();

    concurrencySnapshots.forEach((snapshot) => {
      expect(snapshot).toBeLessThanOrEqual(2);
    });
    expect(elasticsearch.indexCodeChunks).toHaveBeenCalledTimes(4);
  });
});
