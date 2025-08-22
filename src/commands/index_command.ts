import { glob } from 'glob';
import {
  createIndex,
  deleteIndex,
  setupElser,
  createSettingsIndex,
  updateLastIndexedCommit,
  CodeChunk,
} from '../utils/elasticsearch';
import { SUPPORTED_FILE_EXTENSIONS } from '../utils/constants';
import { indexingConfig } from '../config';
import path from 'path';
import { Worker } from 'worker_threads';
import PQueue from 'p-queue';
import { execSync } from 'child_process';
import fs from 'fs';
// @ts-ignore
import ignore from 'ignore';
import os from 'os';

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

  let successCount = 0;
  let failureCount = 0;
  const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: directory })
    .toString()
    .trim();

  const { batchSize, cpuCores } = indexingConfig;
  const producerQueue = new PQueue({ concurrency: cpuCores });
  const consumerQueue = new PQueue({ concurrency: cpuCores });

  let totalChunks = 0;
  let indexedChunks = 0;
  let indexedBatchCount = 0;
  const chunkQueue: CodeChunk[] = [];

  const producerWorkerPath = path.join(process.cwd(), 'dist', 'utils', 'producer_worker.js');
  const consumerWorkerPath = path.join(process.cwd(), 'dist', 'utils', 'consumer_worker.js');

  const scheduleConsumer = () => {
    while (chunkQueue.length >= batchSize) {
      const batch = chunkQueue.splice(0, batchSize);
      consumerQueue.add(() => new Promise<void>((resolve, reject) => {
        const consumerWorker = new Worker(consumerWorkerPath);
        consumerWorker.on('message', (msg) => {
          if (msg.status === 'success') {
            indexedChunks += batch.length;
            indexedBatchCount++;
            console.log(`Progress: Parsed ${successCount}/${files.length} files | Indexed ${indexedChunks}/${totalChunks} chunks`);
          }
          consumerWorker.terminate();
          resolve();
        });
        consumerWorker.on('error', (err) => {
          consumerWorker.terminate();
          reject(err);
        });
        consumerWorker.postMessage(batch);
      }));
    }
  };

  for (const file of files) {
    await producerQueue.add(() => new Promise<void>((resolve, reject) => {
      const worker = new Worker(producerWorkerPath);
      const absolutePath = path.resolve(gitRoot, file);
      worker.on('message', message => {
        if (message.status === 'success') {
          successCount++;
          totalChunks += message.data.length;
          chunkQueue.push(...message.data);
          scheduleConsumer();
        } else if (message.status === 'failure') {
          failureCount++;
        }
        worker.terminate();
        resolve();
      });
      worker.on('error', err => {
        failureCount++;
        worker.terminate();
        reject(err);
      });
      const relativePath = path.relative(gitRoot, file);
      worker.postMessage({ filePath: absolutePath, gitBranch, relativePath });
    }));
  }

  await producerQueue.onIdle();

  // Schedule any remaining chunks
  if (chunkQueue.length > 0) {
    const batch = chunkQueue.splice(0, chunkQueue.length);
    consumerQueue.add(() => new Promise<void>((resolve, reject) => {
      const consumerWorker = new Worker(consumerWorkerPath);
      consumerWorker.on('message', (msg) => {
        if (msg.status === 'success') {
          indexedChunks += batch.length;
        }
        consumerWorker.terminate();
        resolve();
      });
      consumerWorker.on('error', (err) => {
        consumerWorker.terminate();
        reject(err);
      });
      consumerWorker.postMessage(batch);
    }));
  }

  await consumerQueue.onIdle();

  const commitHash = execSync('git rev-parse HEAD', { cwd: directory }).toString().trim();
  await updateLastIndexedCommit(gitBranch, commitHash);

  console.log('\n---');
  console.log('Indexing Summary:');
  console.log(`  Successfully processed: ${successCount} files`);
  console.log(`  Failed to parse:      ${failureCount} files`);
  console.log(`  Total chunks indexed: ${indexedChunks}`);
  console.log(`  HEAD commit hash:     ${commitHash}`);
  console.log('---');
  console.log('Indexing complete.');
}
