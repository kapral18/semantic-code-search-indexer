
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

  const multibar = new cliProgress.MultiBar(
    {
      clearOnComplete: false,
      hideCursor: true,
      format: '{bar} | {percentage}% | {value}/{total} | {task}',
    },
    cliProgress.Presets.shades_classic
  );

  const fileProgressBar = multibar.create(files.length, 0, { task: 'Processing files' });
  const chunkIndexingBar = multibar.create(0, 0, { task: 'Indexing chunks' });

  const { batchSize } = indexingConfig;
  let successCount = 0;
  let failureCount = 0;
  const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: directory })
    .toString()
    .trim();
  const chunkQueue: CodeChunk[] = [];
  let totalChunks = 0;

  const indexChunkBatch = async () => {
    if (chunkQueue.length > 0) {
      const batchToIndex = chunkQueue.splice(0, chunkQueue.length);
      chunkIndexingBar.setTotal(totalChunks);
      chunkIndexingBar.update({ task: `Indexing ${batchToIndex.length} chunks...` });
      await indexCodeChunks(batchToIndex);
      chunkIndexingBar.increment(batchToIndex.length, { task: 'Indexing chunks' });
    }
  };

  for (const file of files) {
    await new Promise<void>((resolve, reject) => {
      const worker = new Worker(path.join(process.cwd(), 'dist', 'utils', 'worker.js'));
      const absolutePath = path.resolve(gitRoot, file);
      worker.on('message', message => {
        if (message.status === 'success') {
          successCount++;
          chunkQueue.push(...message.data);
          totalChunks += message.data.length;
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
    });

    if (chunkQueue.length >= batchSize) {
      await indexChunkBatch();
    }
    fileProgressBar.increment();
  }

  // Index any remaining chunks
  await indexChunkBatch();

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
