// src/languages/typescript.ts
import ts from 'tree-sitter-typescript';
import { LanguageConfiguration } from '../utils/parser';

export const typescript: LanguageConfiguration = {
  name: 'typescript',
  fileSuffixes: ['.ts', '.tsx'],
  parser: ts.typescript,
  queries: [
    '(call_expression) @call',
    '(import_statement) @import',
    '(comment) @comment',
    '(function_declaration) @function',
    '(generator_function_declaration) @function',
    '(class_declaration) @class',
    '(method_definition) @method',
    '(lexical_declaration) @variable',
    '(variable_declaration) @variable',
    '(type_alias_declaration) @type',
    '(interface_declaration) @interface',
  ],
  symbolQueries: [
    '(function_declaration name: (identifier) @function.name)',
    '(generator_function_declaration name: (identifier) @function.name)',
    '(class_declaration name: (type_identifier) @class.name)',
    '(method_definition name: (property_identifier) @method.name)',
    '(variable_declarator name: (identifier) @variable.name)',
    '(type_alias_declaration name: (type_identifier) @type.name)',
    '(interface_declaration name: (type_identifier) @interface.name)',
  ],
};