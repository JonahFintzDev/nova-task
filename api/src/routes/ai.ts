// node_modules
import { type FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import OpenAI from 'openai';

// classes
import { jwtPreHandler } from '../classes/auth';
import { db } from '../classes/database';
import { sendToUser } from '../classes/wsManager';

// ---- POST /api/ai/suggest — start AI task or subtask generation
export async function aiRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/api/ai/suggest',
    {
      preHandler: [jwtPreHandler],
      schema: {
        body: Type.Object({
          listId: Type.String(),
          prompt: Type.String({ minLength: 1, maxLength: 2000 }),
          // When provided, generate subtasks for this task instead of list-level tasks
          taskId: Type.Optional(Type.String()),
        }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { listId, prompt, taskId } = request.body as {
        listId: string;
        prompt: string;
        taskId?: string;
      };

      // Verify list write access
      const access = await db.getListAccess(listId, userId);
      if (!access || (!access.isOwner && access.permission === 'READ')) {
        await reply.code(403).send({ error: 'No write access to this list' });
        return;
      }

      // If taskId provided, load task and verify it belongs to this list
      let parentTask: { title: string; description: string | null } | null = null;
      if (taskId) {
        const task = await db.findTask(taskId, userId, true);
        if (!task || (task as { listId?: string }).listId !== listId) {
          await reply.code(404).send({ error: 'Task not found' });
          return;
        }
        parentTask = {
          title: (task as { title: string }).title,
          description: (task as { description?: string | null }).description ?? null,
        };
      }

      // Load AI settings
      const settings = await db.getAppSettings();
      if (!settings.aiApiUrl || !settings.aiModel) {
        await reply.code(503).send({
          error: 'AI is not configured. Set the API URL and model in Admin → Settings.',
        });
        return;
      }

      const requestId = crypto.randomUUID();
      await reply.send({ requestId });

      // Run async — do not block the HTTP response
      void runAiSuggestion({ userId, listId, requestId, prompt, parentTask, settings });
    },
  );
}

async function runAiSuggestion(opts: {
  userId: string;
  listId: string;
  requestId: string;
  prompt: string;
  parentTask: { title: string; description: string | null } | null;
  settings: { aiApiUrl: string | null; aiApiKey: string | null; aiModel: string | null };
}): Promise<void> {
  const { userId, listId, requestId, prompt, parentTask, settings } = opts;

  const client = new OpenAI({
    baseURL: settings.aiApiUrl!,
    apiKey: settings.aiApiKey ?? 'no-key',
  });

  const systemPrompt = parentTask
    ? 'You are a helpful task-planning assistant. ' +
      'When given a task, break it down into concrete, actionable subtasks. ' +
      'Respond with ONLY the subtask titles, one per line. ' +
      'No numbering, no bullet points, no extra explanation — just the subtask titles.'
    : 'You are a helpful task-planning assistant. ' +
      'When the user describes something they need to do, you generate a concise list of actionable tasks. ' +
      'Respond with ONLY the task titles, one per line. ' +
      'No numbering, no bullet points, no extra explanation — just the task titles.';

  let userContent = prompt;
  if (parentTask) {
    userContent =
      `Task: ${parentTask.title}` +
      (parentTask.description ? `\nDescription: ${parentTask.description}` : '') +
      (prompt !== parentTask.title ? `\n\nAdditional context: ${prompt}` : '');
  }

  try {
    const stream = await client.chat.completions.create({
      model: settings.aiModel!,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      stream: true,
    });

    let buffer = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      buffer += delta;

      // Emit each complete line as a separate suggestion
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const title = line.trim();
        if (title) {
          sendToUser(userId, { type: 'ai:chunk', requestId, listId, title });
        }
      }
    }

    // Flush remaining buffer
    if (buffer.trim()) {
      sendToUser(userId, { type: 'ai:chunk', requestId, listId, title: buffer.trim() });
    }

    sendToUser(userId, { type: 'ai:done', requestId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sendToUser(userId, { type: 'ai:error', requestId, message });
  }
}
