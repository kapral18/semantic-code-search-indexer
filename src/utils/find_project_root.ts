import fs from 'fs';
import path from 'path';

/**
 * Finds the project root by searching upwards from a given file path
 * for a tsconfig.json file.
 * @param startPath The path of a file within the project.
 * @returns The path to the project root, or null if not found.
 */
export function findProjectRoot(startPath: string): string | null {
  let currentDir = path.dirname(path.resolve(startPath));

  while (true) {
    const tsconfigPath = path.join(currentDir, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached the root of the filesystem
      return null;
    }
    currentDir = parentDir;
  }
}
