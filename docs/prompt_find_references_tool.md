Hello! Your task is to create a "Find References" tool for the Kibana MCP server.

This tool will provide compiler-accurate "Find All References" functionality, similar to what's in an IDE. It will be registered with the server using an existing `addTool` function.

The core of this tool will be a service that communicates with the TypeScript Language Server (`tsserver`). You will need to create three new files to implement this.

**Goal:** Create a tool that takes a file path, line, and character as input, and returns all references to the symbol at that location.

---

### File 1: `src/tools/find_references/language_server.ts`

This file contains the service that manages the `tsserver` process.

```typescript
import {
  createMessageConnection,
  InitializeRequest,
  InitializeParams,
  InitializeResult,
  MessageConnection,
  DidOpenTextDocumentNotification,
  DidOpenTextDocumentParams,
  ReferenceParams,
  ReferencesRequest,
  Location
} from 'vscode-languageserver-protocol';
import { spawn, ChildProcess } from 'child_process';
import * as rpc from 'vscode-jsonrpc/node';
import fs from 'fs';

export class LanguageServerService {
  private connection: MessageConnection;
  private serverProcess: ChildProcess;

  constructor() {
    // This command assumes `typescript-language-server` is available in the environment.
    this.serverProcess = spawn('npx', ['typescript-language-server', '--stdio']);
    this.connection = createMessageConnection(
      new rpc.IPCMessageReader(this.serverProcess),
      new rpc.IPCMessageWriter(this.serverProcess)
    );
    this.connection.listen();
  }

  public async initialize(projectRoot: string): Promise<InitializeResult> {
    const params: InitializeParams = {
      processId: process.pid,
      rootUri: `file://${projectRoot}`,
      capabilities: {},
      trace: 'off',
    };
    return this.connection.sendRequest(InitializeRequest.type, params);
  }

  public async findAllReferences(filePath: string, line: number, character: number): Promise<Location[] | null> {
    const fileUri = `file://${filePath}`;

    const text = fs.readFileSync(filePath, 'utf-8');
    const openParams: DidOpenTextDocumentParams = {
      textDocument: {
        uri: fileUri,
        languageId: 'typescript',
        version: 1,
        text,
      },
    };
    this.connection.sendNotification(DidOpenTextDocumentNotification.type, openParams);

    const referenceParams: ReferenceParams = {
      textDocument: { uri: fileUri },
      position: { line, character },
      context: { includeDeclaration: true },
    };

    return this.connection.sendRequest(ReferencesRequest.type, referenceParams);
  }

  public dispose() {
    this.connection.dispose();
    this.serverProcess.kill();
  }
}
```

---

### File 2: `src/tools/find_references/utils.ts`

This file contains a utility to find the project root (`tsconfig.json`) for a given file.

```typescript
import fs from 'fs';
import path from 'path';

export function findProjectRoot(startPath: string): string | null {
  let currentDir = path.dirname(path.resolve(startPath));

  while (true) {
    const tsconfigPath = path.join(currentDir, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null; // Reached the root of the filesystem
    }
    currentDir = parentDir;
  }
}
```

---

### File 3: `src/tools/find_references/index.ts`

This is the main file that defines the tool and registers it with the MCP server.

```typescript
import { z } from 'zod';
import path from 'path';
import { addTool } from '../../utils'; // Assuming addTool is in this location
import { ToolDefinition } from '../../types'; // Assuming ToolDefinition is in this location
import { LanguageServerService } from './language_server';
import { findProjectRoot } from './utils';

// 1. Define the Zod schema for the tool's input.
const FindReferencesInput = z.object({
  filePath: z.string().describe('The absolute or relative path to the file.'),
  line: z.number().int().describe('The 0-indexed line number of the symbol.'),
  character: z.number().int().describe('The 0-indexed character number of the symbol.'),
});

// 2. Create the tool definition.
export const findReferencesTool: ToolDefinition<typeof FindReferencesInput> = {
  name: 'findReferences',
  description: 'Finds all references to a TypeScript symbol at a given location.',
  inputSchema: FindReferencesInput,
  handler: async (input) => {
    const absoluteFilePath = path.resolve(input.filePath);
    const projectRoot = findProjectRoot(absoluteFilePath);

    if (!projectRoot) {
      throw new Error(`Could not find a tsconfig.json for the file: ${input.filePath}`);
    }

    const languageServer = new LanguageServerService();
    
    try {
      console.log(`Initializing language server for project root: ${projectRoot}`);
      await languageServer.initialize(projectRoot);
      console.log('Language server initialized.');

      const results = await languageServer.findAllReferences(absoluteFilePath, input.line, input.character);

      if (!results) {
        return { references: [] };
      }

      return {
        references: results.map(ref => ({
          file: ref.uri.replace(`file://${projectRoot}/`, ''),
          startLine: ref.range.start.line,
          startCharacter: ref.range.start.character,
        })),
      };
    } finally {
      languageServer.dispose();
    }
  },
};

// 3. Register the tool with the MCP server.
export const registerFindReferencesTool = (server: McpServer) => {
  addTool(server, findReferencesTool);
};
```

Please implement these three files in the specified locations within the Kibana codebase. You may need to adjust the import paths for `addTool` and `ToolDefinition` to match the project's structure. You will also need to ensure that `vscode-languageserver-protocol` is added as a dependency.
