
import { glob } from 'glob';
import {
  createIndex,
  indexCodeChunks,
  deleteIndex,
  CodeChunk,
  setupElser,
  createSettingsIndex,
  updateLastIndexedCommit,
} from '../utils/elasticsearch';
import { SUPPORTED_FILE_EXTENSIONS } from '../utils/constants';
import { indexingConfig } from '../config';
import path from 'path';
import { Worker } from 'worker_threads';
import cliProgress from 'cli-progress';
import PQueue from 'p-queue';
import { execSync } from 'child_process';
import fs from 'fs';
// @ts-ignore
import ignore from 'ignore';

export async function index(directory: string, clean: boolean) {
  if (clean) {
    await deleteIndex();
  }

  await setupElser();
  console.log(`Indexing directory: ${directory}`);
  await createIndex();
  await createSettingsIndex();

  const gitRoot = execSync('git rev-parse --show-toplevel', { cwd: directory }).toString().trim();
  const ig = ignore();
  const gitignorePath = path.join(gitRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    ig.add(fs.readFileSync(gitignorePath, 'utf8'));
  }
  ig.add(['**/*_lexer.ts', '**/*_parser.ts']);

  const relativeSearchDir = path.relative(gitRoot, directory);
  const globPattern = path.join(relativeSearchDir, `**/*{${SUPPORTED_FILE_EXTENSIONS.join(',')}}`);

  const allFiles = await glob(globPattern, {
    cwd: gitRoot,
  });
  const files = ig.filter(allFiles);

  console.log(`Found ${files.length} files to index.`);

  // Create a multibar container
  const multibar = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    format: '{bar} | {percentage}% | {value}/{total} | {task}',
  }, cliProgress.Presets.shades_classic);

  const processingBar = multibar.create(files.length, 0, { task: 'Processing files' });
  // We'll create the indexing bar later, when we know the total.

  const { batchSize, maxQueueSize, cpuCores } = indexingConfig;
  const chunkQueue: CodeChunk[] = [];
  const queue = new PQueue({ concurrency: cpuCores });

  let successCount = 0;
  let failureCount = 0;
  let totalChunksQueued = 0;
  const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: directory }).toString().trim();
  let isProducerDone = false;

  const processFileWithWorker = (file: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.join(process.cwd(), 'dist', 'utils', 'worker.js'));
      worker.on('message', (message) => {
        processingBar.increment();
        if (message.status === 'success') {
          successCount++;
          chunkQueue.push(...message.data);
          totalChunksQueued += message.data.length;
        } else if (message.status === 'failure') {
          failureCount++;
        }
        worker.terminate();
        resolve();
      });
      worker.on('error', (err) => {
        failureCount++;
        processingBar.increment();
        worker.terminate();
        reject(err);
      });
      const relativePath = path.relative(gitRoot, file);
      worker.postMessage({ filePath: file, gitBranch, relativePath });
    });
  };

  // Producer: Add file processing tasks to the queue
  const producer = async () => {
    for (const file of files) {
      // Pause if the queue is full
      while (chunkQueue.length > maxQueueSize) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait for 100ms
      }
      const absolutePath = path.resolve(gitRoot, file);
      queue.add(() => processFileWithWorker(absolutePath));
    }
    await queue.onIdle();
    isProducerDone = true;
  };

  // Consumer: Index chunks from the queue
  const consumer = async () => {
    const indexingBar = multibar.create(0, 0, { task: 'Indexing chunks ' });

    while (!isProducerDone || chunkQueue.length > 0) {
      indexingBar.setTotal(totalChunksQueued);
      if (chunkQueue.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait for more chunks
        continue;
      }

      const batch = chunkQueue.splice(0, batchSize);
      await indexCodeChunks(batch);
      indexingBar.increment(batch.length);
    }
  };

  // Run producer and consumer concurrently
  const producerPromise = producer();
  const consumerPromise = consumer();

  await Promise.all([producerPromise, consumerPromise]);
  multibar.stop();

  const commitHash = execSync('git rev-parse HEAD', { cwd: directory }).toString().trim();
  await updateLastIndexedCommit(gitBranch, commitHash);

  console.log('\n---');
  console.log('Indexing Summary:');
  console.log(`  Successfully processed: ${successCount} files`);
  console.log(`  Failed to parse:      ${failureCount} files`);
  console.log(`  HEAD commit hash:     ${commitHash}`);
  console.log('---');
  console.log('Indexing complete.');
}
