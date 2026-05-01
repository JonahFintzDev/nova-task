// node_modules
import { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { Type } from '@sinclair/typebox';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';

// classes
import { db } from '../classes/database.js';

// -------------------------------------------------- Types --------------------------------------------------

type AuthedRequest = FastifyRequest & { apiUserId?: string };

interface Session {
  transport: StreamableHTTPServerTransport;
  userId: string;
}

// -------------------------------------------------- Session Store --------------------------------------------------

const sessions = new Map<string, Session>();

// -------------------------------------------------- Auth --------------------------------------------------

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
  (request as AuthedRequest).apiUserId = record.userId;
}

// -------------------------------------------------- MCP Server Factory --------------------------------------------------

function createMcpServer(userId: string): Server {
  const server = new Server(
    { name: 'Nova Task', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'list_tasks',
        description: 'List all tasks, optionally filtered by list or completion status.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            listId: { type: 'string', description: 'Filter tasks by list ID.' },
            done: { type: 'boolean', description: 'Filter by completion status.' },
            limit: { type: 'number', description: 'Max tasks to return.' },
          },
        },
      },
      {
        name: 'create_task',
        description: 'Create a new task in a specified list.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            listId: { type: 'string', description: 'ID of the list to add the task to.' },
            title: { type: 'string', description: 'Task title.' },
            description: { type: 'string', description: 'Optional markdown description.' },
            dueDate: { type: 'string', description: 'Optional ISO-8601 due date.' },
            priority: {
              type: 'string',
              enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'],
              description: 'Task priority.',
            },
            done: { type: 'boolean', description: 'Create as completed.' },
          },
          required: ['listId', 'title'],
        },
      },
      {
        name: 'update_task',
        description: 'Update an existing task.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            id: { type: 'string', description: 'Task ID to update.' },
            title: { type: 'string', description: 'New title.' },
            description: { type: 'string', description: 'New description.' },
            dueDate: { type: 'string', description: 'New due date (ISO-8601).' },
            done: { type: 'boolean', description: 'Completion status.' },
            priority: {
              type: 'string',
              enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'],
              description: 'Task priority.',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'delete_task',
        description: 'Delete a task and all its subtasks.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            id: { type: 'string', description: 'Task ID to delete.' },
          },
          required: ['id'],
        },
      },
      {
        name: 'list_lists',
        description: 'List all task lists.',
        inputSchema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'get_task',
        description: 'Get full details of a specific task.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            id: { type: 'string', description: 'Task ID.' },
          },
          required: ['id'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const safeArgs = (args ?? {}) as Record<string, unknown>;
    try {
      let result: unknown;
      switch (name) {
        case 'list_tasks':  result = await handleListTasks(userId, safeArgs); break;
        case 'create_task': result = await handleCreateTask(userId, safeArgs); break;
        case 'update_task': result = await handleUpdateTask(userId, safeArgs); break;
        case 'delete_task': result = await handleDeleteTask(userId, safeArgs); break;
        case 'list_lists':  result = await handleListLists(userId); break;
        case 'get_task':    result = await handleGetTask(userId, safeArgs); break;
        default:
          return {
            content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true,
      };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      { uri: 'nova-task://lists', name: 'Lists', description: 'All task lists.', mimeType: 'application/json' },
      { uri: 'nova-task://tasks', name: 'Tasks', description: 'All tasks.', mimeType: 'application/json' },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    let result: unknown;
    if (uri === 'nova-task://lists') {
      result = await handleListLists(userId);
    } else if (uri.startsWith('nova-task://tasks/')) {
      const taskId = uri.slice('nova-task://tasks/'.length);
      result = await handleGetTask(userId, { id: taskId });
    } else if (uri === 'nova-task://tasks') {
      result = await handleListTasks(userId, {});
    } else {
      throw new Error(`Unknown resource: ${uri}`);
    }
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(result, null, 2) }],
    };
  });

  return server;
}

// -------------------------------------------------- Routes --------------------------------------------------

export async function mcpRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /.well-known/mcp/server-card — public discovery
  fastify.get('/.well-known/mcp/server-card', {
    schema: { tags: ['MCP'], summary: 'MCP Server Card' },
  }, async (request, reply) => {
    const protocol = request.headers['x-forwarded-proto'] || 'http';
    const host = request.headers.host || request.headers['x-forwarded-host'] || 'localhost';
    const apiBaseUrl = `${protocol}://${host}/api`;
    await reply.send({
      name: 'Nova Task MCP Server',
      version: '1.0.0',
      description: 'Access your Nova Task data via MCP protocol.',
      url: `${apiBaseUrl}/mcp`,
      authentication: {
        type: 'api_key',
        headerName: 'X-Api-Key',
        description: 'Generate an API key in Nova Task Settings → API Keys',
      },
      capabilities: { tools: true, resources: true },
    });
  });

  // GET /api/mcp/config — public config info
  fastify.get('/api/mcp/config', {
    schema: {
      tags: ['MCP'],
      summary: 'Get MCP server configuration',
      response: {
        200: Type.Object({
          mcpServerUrl: Type.String(),
          serverName: Type.String(),
          serverVersion: Type.String(),
          authHeader: Type.String(),
          instructions: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const protocol = request.headers['x-forwarded-proto'] || 'http';
    const host = request.headers.host || request.headers['x-forwarded-host'] || 'localhost';
    const mcpServerUrl = `${protocol}://${host}/api/mcp`;
    await reply.send({
      mcpServerUrl,
      serverName: 'Nova Task',
      serverVersion: '1.0.0',
      authHeader: 'X-Api-Key',
      instructions:
        `Connect your MCP client to ${mcpServerUrl}.\n` +
        'Include your API key in the X-Api-Key request header.\n' +
        'Generate an API key in Nova Task Settings → API Keys.',
    });
  });

  // POST /api/mcp — MCP protocol entry point (initialize + subsequent tool/resource calls)
  fastify.post('/api/mcp', {
    preHandler: apiKeyPreHandler,
    schema: { tags: ['MCP'], summary: 'MCP protocol endpoint', security: [{ apiKey: [] }] },
  }, async (request, reply) => {
    const userId = (request as AuthedRequest).apiUserId!;
    const sessionId = request.headers['mcp-session-id'] as string | undefined;

    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        await reply.code(404).send({ error: 'Session not found' });
        return;
      }
      if (session.userId !== userId) {
        await reply.code(403).send({ error: 'Forbidden' });
        return;
      }
      reply.hijack();
      await session.transport.handleRequest(request.raw, reply.raw, request.body);
      return;
    }

    if (!isInitializeRequest(request.body)) {
      await reply.code(400).send({ error: 'Missing mcp-session-id header' });
      return;
    }

    // New session: create transport + server, wire them up
    let newTransport!: StreamableHTTPServerTransport;
    newTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, { transport: newTransport, userId });
      },
      onsessionclosed: (id) => {
        sessions.delete(id);
      },
    });

    const server = createMcpServer(userId);
    await server.connect(newTransport);

    reply.hijack();
    await newTransport.handleRequest(request.raw, reply.raw, request.body);
  });

  // GET /api/mcp — SSE stream for server-initiated notifications
  fastify.get('/api/mcp', {
    preHandler: apiKeyPreHandler,
    schema: { tags: ['MCP'], summary: 'MCP SSE stream', security: [{ apiKey: [] }] },
  }, async (request, reply) => {
    const userId = (request as AuthedRequest).apiUserId!;
    const sessionId = request.headers['mcp-session-id'] as string | undefined;
    if (!sessionId) {
      await reply.code(400).send({ error: 'Missing mcp-session-id header' });
      return;
    }
    const session = sessions.get(sessionId);
    if (!session) {
      await reply.code(404).send({ error: 'Session not found' });
      return;
    }
    if (session.userId !== userId) {
      await reply.code(403).send({ error: 'Forbidden' });
      return;
    }
    reply.hijack();
    await session.transport.handleRequest(request.raw, reply.raw);
  });

  // DELETE /api/mcp — terminate a session
  fastify.delete('/api/mcp', {
    preHandler: apiKeyPreHandler,
    schema: { tags: ['MCP'], summary: 'Terminate MCP session', security: [{ apiKey: [] }] },
  }, async (request, reply) => {
    const userId = (request as AuthedRequest).apiUserId!;
    const sessionId = request.headers['mcp-session-id'] as string | undefined;
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (session && session.userId === userId) {
        reply.hijack();
        await session.transport.handleRequest(request.raw, reply.raw);
        sessions.delete(sessionId);
        return;
      }
    }
    await reply.code(200).send({ ok: true });
  });
}

// -------------------------------------------------- Tool Handlers --------------------------------------------------

async function handleListTasks(userId: string, args: Record<string, unknown>): Promise<unknown> {
  const tasks = await db.listTasks(userId, {
    listId: args.listId as string | undefined,
    done: args.done as boolean | undefined,
    parentTaskId: null,
  });
  const limit = args.limit as number | undefined;
  return { tasks: tasks.slice(0, limit ?? tasks.length), total: tasks.length };
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

  if (!listId || !title) throw new Error('listId and title are required');

  let parsedDueDate: Date | null | undefined;
  if (dueDate === null) {
    parsedDueDate = null;
  } else if (dueDate) {
    const d = new Date(dueDate);
    parsedDueDate = isNaN(d.getTime()) ? null : d;
  }

  const task = await db.createTask(userId, {
    listId,
    title,
    description: description || null,
    dueDate: parsedDueDate,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    priority: (priority as any) || 'NONE',
  });

  if (!task) throw new Error('List not found');
  if (done) return await db.toggleDone(task.id, userId);
  return task;
}

async function handleUpdateTask(userId: string, args: Record<string, unknown>): Promise<unknown> {
  const { id, ...updateData } = args as { id: string; [key: string]: unknown };
  if (!id) throw new Error('id is required');

  const data: Record<string, unknown> = { ...updateData };
  if (updateData.dueDate !== undefined && updateData.dueDate !== null) {
    const d = new Date(updateData.dueDate as string);
    data.dueDate = isNaN(d.getTime()) ? null : d;
  }

  const updated = await db.updateTask(id, userId, data);
  if (!updated) throw new Error('Task not found');
  return updated;
}

async function handleDeleteTask(userId: string, args: Record<string, unknown>): Promise<unknown> {
  const { id } = args as { id: string };
  if (!id) throw new Error('id is required');
  const ok = await db.deleteTask(id, userId);
  if (!ok) throw new Error('Task not found');
  return { success: true };
}

async function handleListLists(userId: string): Promise<unknown> {
  return { lists: await db.listLists(userId) };
}

async function handleGetTask(userId: string, args: Record<string, unknown>): Promise<unknown> {
  const { id } = args as { id: string };
  if (!id) throw new Error('id is required');
  const task = await db.findTask(id, userId);
  if (!task) throw new Error('Task not found');
  return task;
}
