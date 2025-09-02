import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';

/**
 * A map of file extensions to Tree-sitter parsers.
 *
 * This is used to determine which parser to use for a given file type.
 * A value of `null` indicates that a custom parser should be used.
 */
// The tree-sitter language packages (e.g., tree-sitter-typescript) do not share a common, importable type
// for the language parser object, making it impractical to type this map statically.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const parsers: { [key: string]: any } = {
  '.ts': TypeScript.typescript,
  '.tsx': TypeScript.tsx,
  '.js': JavaScript,
  '.jsx': JavaScript,
  '.md': null,
  '.mdx': null,
};

/**
 * An array of supported file extensions.
 *
 * This is derived from the keys of the `parsers` object.
 */
export const SUPPORTED_FILE_EXTENSIONS = Object.keys(parsers);