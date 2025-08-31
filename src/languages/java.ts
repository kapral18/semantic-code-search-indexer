import { LanguageConfiguration } from '../utils/parser';
import java from 'tree-sitter-java';

export const javaConfig: LanguageConfiguration = {
  name: 'java',
  fileSuffixes: ['.java'],
  parser: java,
    queries: [
    '(import_declaration) @import',
    '(if_statement) @if',
    '(expression_statement) @expression',
    '(return_statement) @return',
    '(method_declaration) @method',
    '(class_declaration) @class',
    '(method_invocation) @call',
    '(line_comment) @comment',
    '(block_comment) @comment',
    `
    (
      (block_comment)+ @doc
      .
      (class_declaration) @class
    ) @class_with_doc
    `,
    `
    (
      (block_comment)+ @doc
      .
      (method_declaration) @method
    ) @method_with_doc
    `,
  ],
  importQueries: [
    '(import_declaration (scoped_identifier (identifier) @import.symbol) @import.path)',
  ],
  symbolQueries: [
    '(class_declaration name: (identifier) @class.name)',
    '(method_declaration name: (identifier) @method.name)',
  ],
};
