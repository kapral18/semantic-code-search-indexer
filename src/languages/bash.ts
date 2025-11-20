import bash from 'tree-sitter-bash';
import { LanguageConfiguration } from '../utils/parser';

/**
 * Configuration for Bash/shell script language parsing
 *
 * This configuration uses tree-sitter for parsing and extracting code structure.
 * For more information, see: https://tree-sitter.github.io/tree-sitter/
 */
export const bashConfig: LanguageConfiguration = {
  name: 'bash',
  fileSuffixes: ['.sh', '.bash', '.zsh'],
  parser: bash,

  queries: [
    // Function definitions
    '(function_definition) @function',

    // Declaration commands (export, readonly, local, declare)
    // NOTE: This captures the full declaration including any variable_assignment inside
    '(declaration_command) @declaration',

    // Variable assignments (standalone, not part of declaration_command)
    // NOTE: Assignments within declaration_command are captured by the @declaration query above
    '(variable_assignment) @variable',

    // Commands and pipelines
    '(command) @command',
    '(pipeline) @pipeline',

    // Control structures
    '(if_statement) @if',
    '(for_statement) @for',
    '(while_statement) @while',
    '(case_statement) @case',

    // Comments
    '(comment) @comment',

    // Redirections
    '(file_redirect) @redirect',

    // Command substitution
    '(command_substitution) @substitution',

    // Documentation patterns - comments before functions
    `
    (
      (comment)+ @doc
      .
      (function_definition) @function
    ) @function_with_doc
    `,

    // Documentation patterns - comments before variable assignments
    `
    (
      (comment)+ @doc
      .
      (variable_assignment) @variable
    ) @variable_with_doc
    `,
  ],

  importQueries: [
    // Source statements: source file.sh or . file.sh
    '(command name: (command_name (word) @source_cmd (#match? @source_cmd "^(source|\\.)$")) argument: (word) @import.path)',
    '(command name: (command_name (word) @source_cmd (#match? @source_cmd "^(source|\\.)$")) argument: (string (string_content) @import.path))',
  ],

  symbolQueries: [
    // Function names
    '(function_definition name: (word) @function.name)',

    // Variable names (assignments)
    '(variable_assignment name: (variable_name) @variable.name)',

    // Exported variables
    '(declaration_command (variable_assignment name: (variable_name) @variable.name))',

    // Command names (function calls)
    '(command name: (command_name (word) @function.call))',

    // Variable usage (expansions)
    '(simple_expansion (variable_name) @variable.usage)',
    '(expansion (variable_name) @variable.usage)',

    // Array subscript usage (e.g., ${arr[@]}, ${arr[0]})
    '(subscript name: (variable_name) @variable.usage)',
  ],

  exportQueries: [
    // NOTE: This captures ALL declaration_command statements (export/readonly/local/declare).
    // Tree-sitter cannot distinguish them in queries because the keyword is an unnamed node.
    // Parser.ts filters these to only include 'export' declarations via post-processing.
    '(declaration_command (variable_assignment name: (variable_name) @export.name))',

    // NOTE: Captures 'export -f funcname' statements.
    // Parser.ts filters to ensure only 'export -f' declarations are included.
    '(declaration_command (word) @flag (variable_name) @export.name)',
  ],
};
