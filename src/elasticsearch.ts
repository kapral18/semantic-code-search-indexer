import { Client, helpers } from '@elastic/elasticsearch';
import { Readable } from 'stream';
import { elasticsearchConfig } from './config';

let client: Client;

if (elasticsearchConfig.apiKey) {
  client = new Client({
    node: elasticsearchConfig.endpoint,
    auth: {
      apiKey: elasticsearchConfig.apiKey,
    },
  });
} else if (elasticsearchConfig.username && elasticsearchConfig.password) {
  client = new Client({
    node: elasticsearchConfig.endpoint,
    auth: {
      username: elasticsearchConfig.username,
      password: elasticsearchConfig.password,
    },
  });
} else {
  client = new Client({ node: elasticsearchConfig.endpoint });
}

const indexName = 'code-chunks';

/**
 * Creates the Elasticsearch index with the correct mapping for code chunks.
 */
export async function createIndex(): Promise<void> {
  const indexExists = await client.indices.exists({ index: indexName });
  if (!indexExists) {
    console.log(`Creating index "${indexName}"...`);
    await client.indices.create({
      index: indexName,
      mappings: {
        properties: {
          filePath: { type: 'keyword' },
          startLine: { type: 'integer' },
          endLine: { type: 'integer' },
          content: { type: 'text' },
          embedding: {
            type: 'dense_vector',
            dims: 768, // Must match the dimension of the embeddings
          },
        },
      },
    });
  } else {
    console.log(`Index "${indexName}" already exists.`);
  }
}

export interface CodeChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  embedding: number[];
}

/**
 * Indexes a stream of code chunks into Elasticsearch using the high-level bulk helper.
 * @param datasource A Readable stream of code chunks to index.
 */
export async function indexCodeChunks(datasource: Readable): Promise<void> {
  let processedCount = 0;
  const bulkHelper: helpers.BulkHelper<CodeChunk> = client.helpers.bulk({
    datasource,
    flushBytes: 1e6, // 1 MB
    flushInterval: 5000, // 5 seconds
    onDocument(doc) {
      processedCount++;
      if (processedCount % 100 === 0) {
        console.log(`[ES Consumer] Prepared ${processedCount} documents for indexing...`);
      }
      return { index: { _index: indexName } };
    },
    onDrop(doc) {
      console.error('[ES Consumer] Document dropped during bulk indexing:', doc);
    },
  });

  console.log('[ES Consumer] Bulk indexing started, waiting for data from the stream...');
  const stats = await bulkHelper;
  console.log('[ES Consumer] Bulk indexing complete.', stats);
}

/**
 * Searches for code chunks that are semantically similar to the query.
 * @param queryEmbedding The vector embedding of the search query.
 * @returns A list of search results.
 */
export async function searchCodeChunks(queryEmbedding: number[]): Promise<any[]> {
  const response = await client.search({
    index: indexName,
    knn: {
      field: 'embedding',
      query_vector: queryEmbedding,
      k: 10,
      num_candidates: 100,
    },
    _source: {
      excludes: ['embedding'],
    },
  });

  return response.hits.hits.map((hit: any) => ({
    ...hit._source,
    score: hit._score,
  }));
}

/**
 * Deletes the Elasticsearch index if it exists.
 */
export async function deleteIndex(): Promise<void> {
  const indexExists = await client.indices.exists({ index: indexName });
  if (indexExists) {
    console.log(`Deleting index "${indexName}"...`);
    await client.indices.delete({ index: indexName });
  } else {
    console.log(`Index "${indexName}" does not exist, skipping deletion.`);
  }
}