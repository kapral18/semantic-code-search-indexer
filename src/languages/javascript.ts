// src/languages/javascript.ts
import js from 'tree-sitter-javascript';
import { LanguageConfiguration } from '../utils/parser';

export const javascript: LanguageConfiguration = {
  name: 'javascript',
  fileSuffixes: ['.js', '.jsx'],
  parser: js,
  queries: [
    '(call_expression) @call',
    '(import_statement) @import',
    '(comment) @comment',
    '(function_declaration) @function',
    '(generator_function_declaration) @function',
    '(class_declaration) @class',
    '(lexical_declaration) @variable',
    '(variable_declaration) @variable',
  ],
  symbolQueries: [
    '(function_declaration name: (identifier) @function.name)',
    '(generator_function_declaration name: (identifier) @function.name)',
    '(class_declaration name: (identifier) @class.name)',
    '(method_definition name: (property_identifier) @method.name)',
    '(variable_declarator name: (identifier) @variable.name)',
  ],
};