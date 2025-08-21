import {
  indexCodeChunks,
  CodeChunk,
  getLastIndexedCommit,
  updateLastIndexedCommit,
  deleteDocumentsByFilePath,
  setupElser,
} from '../utils/elasticsearch';
import { SUPPORTED_FILE_EXTENSIONS } from '../utils/constants';
import { indexingConfig } from '../config';
import path from 'path';
import { Worker } from 'worker_threads';
import cliProgress from 'cli-progress';
import PQueue from 'p-queue';
import { execSync } from 'child_process';

export async function incrementalIndex(
  directory: string,
  options: { logMode?: boolean } = {}
) {
  await setupElser();
  const { logMode } = options;

    console.log(`Incrementally indexing directory: ${directory}`);

  const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: directory })
    .toString()
    .trim();
  const lastCommitHash = await getLastIndexedCommit(gitBranch);

  if (!lastCommitHash) {
    console.log('No previous commit hash found. Please run a full index first.');
    return;
  }

  console.log(`Last indexed commit hash: ${lastCommitHash}`);

  console.log(`Pulling latest changes from origin/${gitBranch}...`);
  execSync(`git pull origin ${gitBranch}`, { cwd: directory, stdio: 'inherit' });
  console.log('Pull complete.');

  const gitRoot = execSync('git rev-parse --show-toplevel', { cwd: directory }).toString().trim();
  const changedFiles = execSync(`git diff --name-status ${lastCommitHash} HEAD`, {
    cwd: directory,
  })
    .toString()
    .trim()
    .split('\n')
    .filter(line => line)
    .map(line => {
      const [status, file] = line.split('\t');
      return { status, file: path.join(gitRoot, file) };
    });

  const deletedFiles = changedFiles
    .filter(f => f.status === 'D')
    .map(f => path.relative(gitRoot, f.file));
  const addedOrModifiedFiles = changedFiles
    .filter(
      f =>
        (f.status === 'A' || f.status === 'M') && SUPPORTED_FILE_EXTENSIONS.includes(path.extname(f.file))
    )
    .map(f => f.file);

  if (logMode) {
    console.log(`Found ${changedFiles.length} changed files.`);
    console.log(`  - ${addedOrModifiedFiles.length} added or modified`);
    console.log(`  - ${deletedFiles.length} deleted`);
  } else {
    console.log(`Found ${changedFiles.length} changed files.`);
    console.log(`  - ${addedOrModifiedFiles.length} added or modified`);
    console.log(`  - ${deletedFiles.length} deleted`);
  }

  // Process deletions
  for (const file of deletedFiles) {
    await deleteDocumentsByFilePath(file);
    if (logMode) {
      console.log(`Deleted documents for file: ${file}`);
    }
  }

  // Process additions/modifications
  if (!logMode) {
    console.log('Processing and indexing added/modified files...');
  }
  const multibar = !logMode ? new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    format: '{bar} | {percentage}% | {value}/{total} | {task}',
  }, cliProgress.Presets.shades_classic) : null;

  const fileProgressBar = multibar?.create(addedOrModifiedFiles.length, 0, { task: 'Processing files' });
  const chunkIndexingBar = multibar?.create(0, 0, { task: 'Indexing chunks' });

  const { batchSize } = indexingConfig;
  let successCount = 0;
  let failureCount = 0;
  const chunkQueue: CodeChunk[] = [];
  let totalChunks = 0;

  const indexChunkBatch = async () => {
    if (chunkQueue.length > 0) {
      const batchToIndex = chunkQueue.splice(0, chunkQueue.length);
      if (logMode) {
        console.log(`Indexing ${batchToIndex.length} chunks...`);
      } else {
        chunkIndexingBar?.setTotal(totalChunks);
        chunkIndexingBar?.update({ task: `Indexing ${batchToIndex.length} chunks...` });
      }
      await indexCodeChunks(batchToIndex);
      chunkIndexingBar?.increment(batchToIndex.length, { task: 'Indexing chunks' });
    }
  };

  for (const file of addedOrModifiedFiles) {
    await new Promise<void>((resolve, reject) => {
      const worker = new Worker(path.join(process.cwd(), 'dist', 'utils', 'worker.js'));
      worker.on('message', message => {
        if (message.status === 'success') {
          successCount++;
          chunkQueue.push(...message.data);
          totalChunks += message.data.length;
        } else {
          failureCount++;
        }
        if (logMode) {
          console.log(`[${successCount + failureCount}/${addedOrModifiedFiles.length}] Processed: ${file}`);
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
      worker.postMessage({ filePath: file, gitBranch, relativePath });
    });

    if (chunkQueue.length >= batchSize) {
      await indexChunkBatch();
    }
    fileProgressBar?.increment();
  }

  // Index any remaining chunks
  await indexChunkBatch();

  multibar?.stop();

  const newCommitHash = execSync('git rev-parse HEAD', { cwd: directory }).toString().trim();
  await updateLastIndexedCommit(gitBranch, newCommitHash);

  console.log('\n---');
  console.log('Incremental Indexing Summary:');
  console.log(`  Successfully processed: ${successCount} files`);
  console.log(`  Failed to parse:      ${failureCount} files`);
  console.log(`  New HEAD commit hash: ${newCommitHash}`);
  console.log('---');
  if (logMode) {
    console.log('Incremental indexing complete.');
  } else {
    console.log('Incremental indexing complete.');
  }
}
