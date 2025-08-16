import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import fs from 'fs';
import path from 'path';

const { Query } = Parser;

interface CodeChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
}

const parsers: { [key: string]: any } = {
  '.ts': TypeScript.typescript,
  '.tsx': TypeScript.tsx,
  '.js': JavaScript,
  '.jsx': JavaScript,
};

function getParser(fileExt: string): any | undefined {
  return parsers[fileExt];
}

const queries: { [key:string]: string } = {
  '.ts': `
    (import_statement) @import
    (function_declaration) @function
    (lexical_declaration
      (variable_declarator
        value: (arrow_function))) @arrow_function
    (call_expression) @call
    (class_declaration) @class
    (comment) @comment
    (type_alias_declaration) @type
    (interface_declaration) @interface
    (enum_declaration) @enum
  `,
  '.tsx': `
    (import_statement) @import
    (function_declaration) @function
    (lexical_declaration
      (variable_declarator
        value: (arrow_function))) @arrow_function
    (call_expression) @call
    (class_declaration) @class
    (comment) @comment
    (type_alias_declaration) @type
    (interface_declaration) @interface
    (enum_declaration) @enum
  `,
  '.js': `
    (function_declaration) @function
    (lexical_declaration
      (variable_declarator
        value: (arrow_function))) @arrow_function
    (call_expression) @call
    (class_declaration) @class
    (comment) @comment
  `,
};

function getQuery(fileExt: string): string | undefined {
  return queries[fileExt];
}

/**
 * Parses a source code file and extracts code chunks.
 * @param filePath The path to the file to parse.
 * @returns An array of code chunks.
 */
export function parseFile(filePath: string): CodeChunk[] {
  const fileExt = path.extname(filePath);
  const language = getParser(fileExt);
  const queryString = getQuery(fileExt);

  if (!language || !queryString) {
    console.warn(`Unsupported file type: ${fileExt}`);
    return [];
  }

  const parser = new Parser();
  parser.setLanguage(language);

  const sourceCode = fs.readFileSync(filePath, 'utf8');
  const tree = parser.parse(sourceCode);
  const query = new Query(language, queryString);
  const matches = query.matches(tree.rootNode);

  return matches.map(({ captures }) => {
    const node = captures[0].node;
    return {
      filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      content: node.text,
    };
  });
}
