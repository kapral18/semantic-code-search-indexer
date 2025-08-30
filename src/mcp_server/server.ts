import { McpServer as SdkServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { randomUUID } from 'crypto';

import { semanticCodeSearch, semanticCodeSearchSchema } from './tools/semantic_code_search';
import { listSymbolsByQuery, listSymbolsByQuerySchema } from './tools/list_symbols_by_query';
import { symbolAnalysis, symbolAnalysisSchema } from './tools/symbol_analysis';

export class McpServer {
  private server: SdkServer;

  constructor() {
    this.server = new SdkServer({
      name: 'code-indexer',
      version: '0.0.1',
      title: 'Code Indexer MCP Server',
    });
    this.registerTools();
  }

  private registerTools() {
    const semanticCodeSearchDescription = fs.readFileSync(path.join(__dirname, 'tools/semantic_code_search.md'), 'utf-8');
    const listSymbolsByQueryDescription = fs.readFileSync(path.join(__dirname, 'tools/list_symbols_by_query.md'), 'utf-8');
    const symbolAnalysisDescription = fs.readFileSync(path.join(__dirname, 'tools/symbol_analysis.md'), 'utf-8');

    this.server.registerTool(
      'semantic_code_search',
      {
        description: semanticCodeSearchDescription,
        inputSchema: semanticCodeSearchSchema.shape,
      },
      semanticCodeSearch
    );

    this.server.registerTool(
      'list_symbols_by_query',
      {
        description: listSymbolsByQueryDescription,
        inputSchema: listSymbolsByQuerySchema.shape,
      },
      listSymbolsByQuery
    );

    this.server.registerTool(
      'symbol_analysis',
      {
        description: symbolAnalysisDescription,
        inputSchema: symbolAnalysisSchema.shape,
      },
      symbolAnalysis
    );
  }

  public async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  public async startHttp(port: number) {
    const app = express();
    app.use(express.json());
    const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

    app.post('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            transports[newSessionId] = transport;
          },
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId];
          }
        };
        await this.server.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    });

    const handleSessionRequest = async (req: express.Request, res: express.Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }

      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
    };

    app.get('/mcp', handleSessionRequest);
    app.delete('/mcp', handleSessionRequest);

    app.listen(port, () => {
      console.log(`MCP HTTP server listening on port ${port}`);
    });
  }
}
