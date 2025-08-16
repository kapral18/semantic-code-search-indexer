import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

let extractor: FeatureExtractionPipeline;

/**
 * Initializes the embedding model. This should be called once before
 * any parallel processing begins.
 */
export async function initializeEmbeddingModel() {
  if (!extractor) {
    console.log('Initializing embedding model...');
    extractor = await pipeline('feature-extraction', 'jinaai/jina-embeddings-v2-base-code');
    console.log('Embedding model initialized.');
  }
}

/**
 * Generates a vector embedding for a given text chunk.
 * Assumes the model has already been initialized.
 * @param text The text to embed.
 * @returns A fixed-size vector of numbers.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!extractor) {
    throw new Error('Embedding model has not been initialized. Call initializeEmbeddingModel() first.');
  }

  const result = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data as Float32Array);
}
