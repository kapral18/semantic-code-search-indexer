
import { parentPort } from 'worker_threads';
import { indexCodeChunks } from './elasticsearch';
import { CodeChunk } from './elasticsearch';

parentPort?.on('message', async (chunks: CodeChunk[]) => {
  try {
    await indexCodeChunks(chunks);
    parentPort?.postMessage({ status: 'success' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    parentPort?.postMessage({ status: 'failure', error: errorMessage });
  }
});
