import { LanguageServerService } from '../utils/language_server';
import { findProjectRoot } from '../utils/find_project_root';
import path from 'path';

/**
 * The main function for the `references` command.
 *
 * This function is responsible for finding all references to a symbol at a
 * given position in a file. It uses the `LanguageServerService` to communicate
 * with a TypeScript language server.
 *
 * @param filePath The path to the file.
 * @param line The line number of the symbol.
 * @param character The character number of the symbol.
 */
export async function references(filePath: string, line: number, character: number) {
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