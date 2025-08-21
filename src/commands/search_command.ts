
import { searchCodeChunks } from '../utils/elasticsearch';

export async function search(query: string) {
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
