// node_modules
import { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { Type } from '@sinclair/typebox';

// classes
import { db } from '../classes/database';
import { jwtPreHandler } from '../classes/auth';

// Pre-handler for API key authentication (used by SSE endpoints for external MCP clients)
async function apiKeyPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const rawKey = request.headers['x-api-key'];
  if (!rawKey || typeof rawKey !== 'string') {
    await reply.code(401).send({ error: 'Missing X-Api-Key header' });
    return;
  }
  const record = await db.findApiKeyByRawKey(rawKey);
  if (!record) {
    await reply.code(401).send({ error: 'Invalid API key' });
    return;
  }
  await db.touchApiKeyUsage(record.id);
  (request as FastifyRequest & { apiUserId?: string }).apiUserId = record.userId;
}

export async function mcpRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /api/mcp/config - Public endpoint, no auth required
  fastify.get(
    '/api/mcp/config',
    {
      schema: {
        tags: ['MCP'],
        summary: 'Get MCP server configuration',
        description: 
          'Returns the configuration needed for MCP (Model Context Protocol) clients to connect to Nova Task. ' +
          'Use your API key as the authentication token for tool/resource access. The base URL for MCP connections is the same as your API base URL.',
        response: {
          200: Type.Object({
            mcpServerUrl: Type.String({
              description: 'The base URL to use for MCP server connections.'
            }),
            apiBaseUrl: Type.String({
              description: 'The base URL for the REST API.'
            }),
            serverName: Type.String({
              description: 'Human-readable server name.'
            }),
            serverVersion: Type.String({
              description: 'Server version.'
            }),
            capabilities: Type.Array(
              Type.String(),
              {
                description: 'List of MCP capabilities supported by this server.'
              }
            ),
            tools: Type.Array(
              Type.Object({
                name: Type.String({
                  description: 'Tool name.'
                }),
                description: Type.String({
                  description: 'Tool description.'
                }),
                inputSchema: Type.Record(Type.String(), Type.Unknown()),
              }),
              {
                description: 'List of available MCP tools.'
              }
            ),
            resources: Type.Array(
              Type.Object({
                uri: Type.String({
                  description: 'Resource URI template.'
                }),
                name: Type.String({
                  description: 'Resource name.'
                }),
                description: Type.String({
                  description: 'Resource description.'
                }),
                mimeType: Type.String({
                  description: 'MIME type of the resource.'
                }),
              }),
              {
                description: 'List of available MCP resources.'
              }
            ),
            instructions: Type.String({
              description: 'Instructions for MCP clients on how to use this server.'
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      // Get the base URL from the request
      const protocol = request.headers['x-forwarded-proto'] || 'http';
      const host = request.headers.host || request.headers['x-forwarded-host'] || 'localhost';
      const baseUrl = `${protocol}://${host}`;

      // Build MCP server URL
      const mcpServerUrl = `${baseUrl}/api/mcp`;
      const apiBaseUrl = `${baseUrl}/api`;

      await reply.send({
        mcpServerUrl,
        apiBaseUrl,
        serverName: 'Nova Task',
        serverVersion: '1.0.0',
        capabilities: [
          'tools',
          'resources',
        ],
        tools: [
          {
            name: 'list_tasks',
            description: 'List all tasks across all lists or filter by list.',
            inputSchema: {
              type: 'object',
              properties: {
                listId: { type: 'string', description: 'Optional: Filter tasks by list ID.' },
                done: { type: 'boolean', description: 'Optional: Filter by completion status.' },
                limit: { type: 'number', description: 'Optional: Maximum number of tasks to return.' },
              },
            },
          },
          {
            name: 'create_task',
            description: 'Create a new task in a specified list.',
            inputSchema: {
              type: 'object',
              properties: {
                listId: { type: 'string', description: 'Required: ID of the list to add the task to.' },
                title: { type: 'string', description: 'Required: Task title.' },
                description: { type: 'string', description: 'Optional: Markdown description.' },
                dueDate: { type: 'string', description: 'Optional: ISO-8601 date or date-time string.' },
                priority: { 
                  type: 'string', 
                  enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'],
                  description: 'Optional: Task priority.' 
                },
                done: { type: 'boolean', description: 'Optional: Create as completed.' },
              },
              required: ['listId', 'title'],
            },
          },
          {
            name: 'update_task',
            description: 'Update an existing task.',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Required: Task ID to update.' },
                title: { type: 'string', description: 'Optional: New title.' },
                description: { type: 'string', description: 'Optional: New description.' },
                dueDate: { type: 'string', description: 'Optional: New due date (ISO-8601).' },
                done: { type: 'boolean', description: 'Optional: Completion status.' },
                priority: { 
                  type: 'string', 
                  enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'],
                  description: 'Optional: Task priority.' 
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'delete_task',
            description: 'Delete a task and all its subtasks.',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Required: Task ID to delete.' },
              },
              required: ['id'],
            },
          },
          {
            name: 'list_lists',
            description: 'List all task lists.',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'get_task',
            description: 'Get details of a specific task.',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Required: Task ID.' },
              },
              required: ['id'],
            },
          },
        ],
        resources: [
          {
            uri: 'nova-task://lists',
            name: 'Lists',
            description: 'Access all task lists.',
            mimeType: 'application/json',
          },
          {
            uri: 'nova-task://tasks',
            name: 'Tasks',
            description: 'Access all tasks.',
            mimeType: 'application/json',
          },
          {
            uri: 'nova-task://tasks/{id}',
            name: 'Task',
            description: 'Access a specific task.',
            mimeType: 'application/json',
          },
        ],
        instructions: 
          'Nova Task MCP Server\n\n' +
          'This server provides access to your Nova Task data via the Model Context Protocol (MCP).\n\n' +
          'AUTHENTICATION:\n' +
          'All requests must include your API key in the X-Api-Key header.\n\n' +
          'GETTING STARTED:\n' +
          '1. Create an API key in Nova Task Settings → API Keys\n' +
          '2. Configure your MCP client with the server URL: ' + mcpServerUrl + '\n' +
          '3. Pass your API key as the authentication token\n\n' +
          'The server supports both REST API access and MCP protocol access.\n' +
          'For REST API, use: ' + apiBaseUrl + '/external/* endpoints with X-Api-Key header.\n' +
          'For MCP protocol, use SSE (Server-Sent Events) at: ' + mcpServerUrl + '/sse',
      });
    },
  );

  // GET /api/mcp - MCP protocol endpoint (SSE)
  fastify.get(
    '/api/mcp',
    {
      preHandler: apiKeyPreHandler,
      schema: {
        tags: ['MCP'],
        summary: 'MCP Server-Sent Events endpoint',
        description: 
          'Server-Sent Events endpoint for MCP clients. ' +
          'Connect using EventSource API with your API key in the X-Api-Key header.\n\n' +
          'This endpoint streams MCP protocol messages as SSE events.',
        security: [{ apiKey: [] }],
      },
    },
    async (request, reply) => {
      const userId = (request as FastifyRequest & { apiUserId?: string }).apiUserId!;

      // Set SSE headers
      reply.header('Content-Type', 'text/event-stream');
      reply.header('Cache-Control', 'no-cache');
      reply.header('Connection', 'keep-alive');
      reply.header('Access-Control-Allow-Headers', 'X-Api-Key');

      // Send initial MCP handshake
      const initialMessage = {
        type: 'mcp:welcome',
        serverName: 'Nova Task MCP Server',
        serverVersion: '1.0.0',
        userId,
      };

      reply.send(`data: ${JSON.stringify(initialMessage)}\n\n`);

      // For now, just send a heartbeat every 30 seconds
      // In a full implementation, this would handle bidirectional MCP communication
      const interval = setInterval(() => {
        const heartbeat = {
          type: 'mcp:heartbeat',
          timestamp: new Date().toISOString(),
        };
        reply.send(`data: ${JSON.stringify(heartbeat)}\n\n`);
      }, 30000);

      // Clean up on client disconnect
      request.socket.on('close', () => {
        clearInterval(interval);
      });

      // Return a never-ending stream
      // Note: In a production implementation, you'd want proper cleanup
      // and handling of client disconnections
    },
  );

  // GET /api/mcp/sse - Alternative SSE endpoint
  fastify.get(
    '/api/mcp/sse',
    {
      preHandler: apiKeyPreHandler,
      schema: {
        tags: ['MCP'],
        summary: 'MCP Server-Sent Events (alternative)',
        description: 'Alternative SSE endpoint for MCP clients.',
        security: [{ apiKey: [] }],
      },
    },
    async (request, reply) => {
      const userId = (request as FastifyRequest & { apiUserId?: string }).apiUserId!;

      reply.header('Content-Type', 'text/event-stream');
      reply.header('Cache-Control', 'no-cache');
      reply.header('Connection', 'keep-alive');

      // Send MCP server info
      const serverInfo = {
        jsonrpc: '2.0',
        id: 1,
        result: {
          type: 'serverInfo',
          name: 'Nova Task MCP Server',
          version: '1.0.0',
          capabilities: {
            tools: {},
            resources: {},
          },
          instructions: 
            'Nova Task MCP Server - Access your tasks and lists via MCP protocol.',
        },
      };

      reply.send(`data: ${JSON.stringify(serverInfo)}\n\n`);

      const interval = setInterval(() => {
        reply.send(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`);
      }, 30000);

      request.socket.on('close', () => {
        clearInterval(interval);
      });
    },
  );

  // POST /api/mcp/tools/:toolName - Execute MCP tools
  fastify.post(
    '/api/mcp/tools/:toolName',
    {
      preHandler: apiKeyPreHandler,
      schema: {
        tags: ['MCP'],
        summary: 'Execute an MCP tool',
        description: 'Execute a specific MCP tool with the provided arguments.',
        security: [{ apiKey: [] }],
        params: Type.Object({
          toolName: Type.String({ description: 'Name of the tool to execute.' }),
        }),
        body: Type.Object({
          arguments: Type.Record(Type.String(), Type.Unknown()),
        }),
        response: {
          200: Type.Object({
            result: Type.Unknown(),
          }),
          400: Type.Object({ error: Type.String() }),
          404: Type.Object({ error: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const userId = (request as FastifyRequest & { apiUserId?: string }).apiUserId!;
      const { toolName } = request.params as { toolName: string };
      const { arguments: args } = request.body as { arguments: Record<string, unknown> };

      // Route to the appropriate tool handler
      try {
        let result;

        switch (toolName) {
          case 'list_tasks':
            result = await handleListTasks(userId, args);
            break;
          case 'create_task':
            result = await handleCreateTask(userId, args);
            break;
          case 'update_task':
            result = await handleUpdateTask(userId, args);
            break;
          case 'delete_task':
            result = await handleDeleteTask(userId, args);
            break;
          case 'list_lists':
            result = await handleListLists(userId);
            break;
          case 'get_task':
            result = await handleGetTask(userId, args);
            break;
          default:
            await reply.code(404).send({ error: `Unknown tool: ${toolName}` });
            return;
        }

        await reply.send({ result });
      } catch (error) {
        await reply.code(400).send({ 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    },
  );

  // GET /api/mcp/resources/:uri - Access MCP resources
  fastify.get(
    '/api/mcp/resources/*',
    {
      preHandler: apiKeyPreHandler,
      schema: {
        tags: ['MCP'],
        summary: 'Access an MCP resource',
        description: 'Access a specific MCP resource by URI.',
        security: [{ apiKey: [] }],
        response: {
          200: Type.Unknown(),
          404: Type.Object({ error: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const userId = (request as FastifyRequest & { apiUserId?: string }).apiUserId!;
      const uri = request.url.replace('/api/mcp/resources/', '');

      try {
        let result;

        if (uri === 'nova-task://lists') {
          result = await handleListLists(userId);
        } else if (uri.startsWith('nova-task://tasks')) {
          const taskId = uri.replace('nova-task://tasks/', '');
          if (taskId) {
            result = await handleGetTask(userId, { id: taskId });
          } else {
            result = await handleListTasks(userId, {});
          }
        } else {
          await reply.code(404).send({ error: `Unknown resource: ${uri}` });
          return;
        }

        await reply.send(result);
      } catch (error) {
        await reply.code(404).send({ 
          error: error instanceof Error ? error.message : 'Resource not found' 
        });
      }
    },
  );
}

// -------------------------------------------------- Tool Handlers --------------------------------------------------

async function handleListTasks(userId: string, args: Record<string, unknown>): Promise<unknown> {
  const listId = args.listId as string | undefined;
  const done = args.done as boolean | undefined;
  const limit = args.limit as number | undefined;

  const tasks = await db.listTasks(userId, {
    listId,
    done,
    parentTaskId: null,
  });

  return {
    tasks: tasks.slice(0, limit || tasks.length),
    total: tasks.length,
  };
}

async function handleCreateTask(userId: string, args: Record<string, unknown>): Promise<unknown> {
  const { listId, title, description, dueDate, priority, done } = args as {
    listId: string;
    title: string;
    description?: string | null;
    dueDate?: string | null;
    priority?: string;
    done?: boolean;
  };

  if (!listId || !title) {
    throw new Error('listId and title are required');
  }

  let parsedDueDate: Date | null | undefined;
  if (dueDate === null) {
    parsedDueDate = null;
  } else if (dueDate) {
    const parsed = new Date(dueDate as string);
    parsedDueDate = Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const task = await db.createTask(userId, {
    listId,
    title,
    description: description || null,
    dueDate: parsedDueDate,
    priority: priority as any || 'NONE',
  });

  if (!task) {
    throw new Error('List not found');
  }

  if (done) {
    return await db.toggleDone(task.id, userId);
  }

  return task;
}

async function handleUpdateTask(userId: string, args: Record<string, unknown>): Promise<unknown> {
  const { id, ...updateData } = args as { id: string; [key: string]: unknown };

  if (!id) {
    throw new Error('id is required');
  }

  const data: Record<string, unknown> = { ...updateData };
  if (updateData.dueDate !== undefined && updateData.dueDate !== null) {
    const parsed = new Date(updateData.dueDate as string);
    data.dueDate = Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const updated = await db.updateTask(id, userId, data);
  if (!updated) {
    throw new Error('Task not found');
  }

  return updated;
}

async function handleDeleteTask(userId: string, args: Record<string, unknown>): Promise<unknown> {
  const { id } = args as { id: string };

  if (!id) {
    throw new Error('id is required');
  }

  const ok = await db.deleteTask(id, userId);
  if (!ok) {
    throw new Error('Task not found');
  }

  return { success: true };
}

async function handleListLists(userId: string): Promise<unknown> {
  const lists = await db.listLists(userId);
  return { lists };
}

async function handleGetTask(userId: string, args: Record<string, unknown>): Promise<unknown> {
  const { id } = args as { id: string };

  if (!id) {
    throw new Error('id is required');
  }

  const task = await db.findTask(id, userId);
  if (!task) {
    throw new Error('Task not found');
  }

  return task;
}
