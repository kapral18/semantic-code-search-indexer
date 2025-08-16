// src/worker.ts
import { parentPort } from 'worker_threads';
import { parseFile } from './parser';
import { initializeEmbeddingModel, generateEmbedding } from './embedding';
import { CodeChunk } from './elasticsearch';
import fs from 'fs';

// Initialize the model once for this worker thread.
initializeEmbeddingModel().then(() => {
  parentPort?.postMessage('ready');
});

parentPort?.on('message', async (filePath: string) => {
  try {
    const chunks = parseFile(filePath);
    if (chunks.length > 0) {
      const chunksWithEmbeddings: CodeChunk[] = await Promise.all(
        chunks.map(async c => ({
          ...c,
          embedding: await generateEmbedding(c.content),
        }))
      );
      parentPort?.postMessage({ status: 'done', data: chunksWithEmbeddings });
    } else {
      parentPort?.postMessage({ status: 'done', data: [] });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    parentPort?.postMessage({ status: 'error', error: errorMessage });
  }
});
