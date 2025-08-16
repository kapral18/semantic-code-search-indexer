import './config'; // Must be the first import
import { glob } from 'glob';
import { createIndex, indexCodeChunks, searchCodeChunks, deleteIndex, CodeChunk, setupElser, getClusterHealth, deleteDocumentsByFilePath } from './elasticsearch';
import { LanguageServerService } from './language_server';
import path from 'path';
import { findProjectRoot } from './utils';
import os from 'os';
import { Worker } from 'worker_threads';
import cliProgress from 'cli-progress';
import PQueue from 'p-queue';

async function index(directory: string, clean: boolean) {
  if (clean) {
    await deleteIndex();
  }

  await setupElser();
  console.log(`Indexing directory: ${directory}`);
  await createIndex();

  const files = await glob('**/*.{ts,tsx,js,jsx}', {
    cwd: directory,
    ignore: ['node_modules/**', '**/*_lexer.ts', '**/*_parser.ts'],
    absolute: true,
  });

  console.log(`Found ${files.length} files to index.`);

  // Create a multibar container
  const multibar = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    format: '{bar} | {percentage}% | {value}/{total} | {task}',
  }, cliProgress.Presets.shades_classic);

  const processingBar = multibar.create(files.length, 0, { task: 'Processing files' });
  // We'll create the indexing bar later, when we know the total.

  const BATCH_SIZE = 500;
  const chunkQueue: CodeChunk[] = [];
  const queue = new PQueue({ concurrency: os.cpus().length });

  let successCount = 0;
  let failureCount = 0;

  const processFileWithWorker = (file: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.join(process.cwd(), 'dist', 'worker.js'));
      worker.on('message', (message) => {
        processingBar.increment();
        if (message.status === 'success') {
          successCount++;
          chunkQueue.push(...message.data);
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
      worker.postMessage(file);
    });
  };

  // Producer Promise
  const producerPromise = (async () => {
    files.forEach(file => queue.add(() => processFileWithWorker(file)));
    await queue.onIdle();
  })();

  // Consumer Promise
  const consumerPromise = (async () => {
    await producerPromise; // Wait for the producer to finish

    const indexingBar = multibar.create(chunkQueue.length, 0, { task: 'Indexing chunks ' });
    
    while (chunkQueue.length > 0) {
      const batch = chunkQueue.splice(0, BATCH_SIZE);
      await indexCodeChunks(batch);
      indexingBar.increment(batch.length);
    }
  })();

  await Promise.all([producerPromise, consumerPromise]);
  multibar.stop();

  console.log('\n---');
  console.log('Indexing Summary:');
  console.log(`  Successfully processed: ${successCount} files`);
  console.log(`  Failed to parse:      ${failureCount} files`);
  console.log('---');
  console.log('Indexing complete.');
}

// ... (search, references, and main functions remain the same) ...
async function search(query: string) {
  console.log(`Searching for: "${query}"`);
  const results = await searchCodeChunks(query);

  console.log('Search results:');
  if (results.length === 0) {
    console.log('No results found.');
    return;
  }

  results.forEach(result => {
    console.log('---');
    console.log(`File: ${result.filePath}`);
    console.log(`Lines: ${result.startLine} - ${result.endLine}`);
    console.log(`Score: ${result.score}`);
    console.log('Content:');
    console.log(result.content);
  });
}

async function references(filePath: string, line: number, character: number) {
  const absoluteFilePath = path.resolve(filePath);
  const projectRoot = findProjectRoot(absoluteFilePath);

  if (!projectRoot) {
    console.error(`Could not find a tsconfig.json for the file: ${filePath}`);
    process.exit(1);
  }

  const languageServer = new LanguageServerService();

  console.log(`Found project root: ${projectRoot}`);
  console.log('Initializing language server...');
  await languageServer.initialize(projectRoot);
  console.log('Language server initialized.');

  console.log(`Finding references for ${absoluteFilePath}:${line}:${character}`);
  const results = await languageServer.findAllReferences(absoluteFilePath, line, character);

  if (results && results.length > 0) {
    console.log('Found references:');
    results.forEach(result => {
      const resultPath = result.uri.replace(`file://${projectRoot}/`, '');
      console.log(`  - ${resultPath}:${result.range.start.line}:${result.range.start.character}`);
    });
  } else {
    console.log('No results found.');
  }

  languageServer.dispose();
}

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  const clean = args.includes('--clean');
  const argument = args.filter(arg => arg !== '--clean').join(' ');

  if (command === 'index') {
    await index(argument || '.', clean);
  } else if (command === 'search') {
    if (!argument) {
      console.error('Please provide a search query.');
      process.exit(1);
    }
    await search(argument);
  } else if (command === 'references') {
    if (!argument) {
      console.error('Please provide a file path and position, e.g., src/index.ts:10:5');
      process.exit(1);
    }
    const [filePath, line, character] = argument.split(':');
    await references(filePath, parseInt(line, 10), parseInt(character, 10));
  } else {
    console.log('Usage:');
    console.log('  npm run index [directory] [--clean]   - Index a directory, optionally deleting the old index first');
    console.log('  npm run search <query>                - Search for code');
    console.log('  npm run references <path:line:char>   - Find all references for a symbol');
  }
}

main().catch(error => {
  console.error('An error occurred:', error);
  process.exit(1);
});