// node_modules
import { type FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";

// classes
import { db } from "../classes/database";
import { jwtPreHandler } from "../classes/auth";

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatUtcDateTime(value: Date): string {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function formatDateOnly(value: Date): string {
  const year = value.getUTCFullYear().toString().padStart(4, "0");
  const month = (value.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = value.getUTCDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
}

function addHours(value: Date, hours: number): Date {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
}

function addDaysUtc(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function foldIcsLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) {
    return line;
  }
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += maxLength) {
    const chunk = line.slice(i, i + maxLength);
    parts.push(i === 0 ? chunk : ` ${chunk}`);
  }
  return parts.join("\r\n");
}

function toIcs(task: {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  dueDateHasTime: boolean;
  done: boolean;
  updatedAt: Date;
  createdAt: Date;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  list: { id: string; title: string } | null;
}[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nova Task//Task Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Nova Task Due Dates",
  ];

  for (const item of task) {
    if (!item.dueDate) {
      continue;
    }
    const descriptionParts: string[] = [];
    if (item.list?.title) {
      descriptionParts.push(`List: ${item.list.title}`);
    }
    if (item.description) {
      descriptionParts.push(item.description);
    }
    const priorityMap: Record<string, string> = {
      NONE: "0",
      LOW: "9",
      MEDIUM: "5",
      HIGH: "3",
      URGENT: "1",
    };
    const eventLines: string[] = [
      "BEGIN:VEVENT",
      `UID:task-${item.id}@nova-task`,
      `DTSTAMP:${formatUtcDateTime(item.updatedAt ?? item.createdAt)}`,
      ...(item.dueDateHasTime
        ? [
            `DTSTART:${formatUtcDateTime(item.dueDate)}`,
            `DTEND:${formatUtcDateTime(addHours(item.dueDate, 1))}`,
          ]
        : [
            `DTSTART;VALUE=DATE:${formatDateOnly(item.dueDate)}`,
            `DTEND;VALUE=DATE:${formatDateOnly(addDaysUtc(item.dueDate, 1))}`,
          ]),
      foldIcsLine(`SUMMARY:${escapeIcsText(item.title)}`),
      `STATUS:${item.done ? "COMPLETED" : "CONFIRMED"}`,
      `PRIORITY:${priorityMap[item.priority] ?? "0"}`,
    ];
    if (descriptionParts.length > 0) {
      eventLines.push(
        foldIcsLine(`DESCRIPTION:${escapeIcsText(descriptionParts.join("\n\n"))}`),
      );
    }
    eventLines.push("END:VEVENT");
    lines.push(...eventLines);
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export async function calendarRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/api/calendar/ics/:token",
    {
      schema: {
        params: Type.Object({ token: Type.String({ minLength: 1 }) }),
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const feed = await db.findActiveCalendarFeedByToken(token);
      if (!feed) {
        await reply.code(404).send({ error: "Calendar feed not found" });
        return;
      }
      const tasks = await db.listCalendarTasksForUser(
        feed.userId,
        feed.includeDone,
        feed.lists.map((item) => item.listId),
      );
      await db.touchCalendarFeedUsage(feed.id);

      const ics = toIcs(tasks);
      await reply
        .header("Content-Type", "text/calendar; charset=utf-8")
        .header("Cache-Control", "private, max-age=300")
        .send(ics);
    },
  );

  fastify.get(
    "/api/calendar/feeds",
    { preHandler: jwtPreHandler },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const feeds = await db.listCalendarFeeds(userId);
      await reply.send(feeds);
    },
  );

  fastify.post(
    "/api/calendar/feeds",
    {
      preHandler: jwtPreHandler,
      schema: {
        body: Type.Object({
          name: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
          includeDone: Type.Optional(Type.Boolean()),
          listIds: Type.Optional(Type.Array(Type.String())),
        }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { name, includeDone } = request.body as {
        name?: string | null;
        includeDone?: boolean;
        listIds?: string[];
      };
      const body = request.body as {
        name?: string | null;
        includeDone?: boolean;
        listIds?: string[];
      };
      const created = await db.createCalendarFeed(userId, {
        name,
        includeDone,
        listIds: body.listIds,
      });
      await reply.code(201).send(created);
    },
  );

  fastify.patch(
    "/api/calendar/feeds/:id",
    {
      preHandler: jwtPreHandler,
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          name: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
          includeDone: Type.Optional(Type.Boolean()),
          listIds: Type.Optional(Type.Array(Type.String())),
        }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const body = request.body as {
        name?: string | null;
        includeDone?: boolean;
        listIds?: string[];
      };
      const updated = await db.updateCalendarFeed(id, userId, body);
      if (!updated) {
        await reply.code(404).send({ error: "Calendar feed not found" });
        return;
      }
      await reply.send(updated);
    },
  );

  fastify.post(
    "/api/calendar/feeds/:id/rotate",
    {
      preHandler: jwtPreHandler,
      schema: { params: Type.Object({ id: Type.String() }) },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const rotated = await db.rotateCalendarFeedToken(id, userId);
      if (!rotated) {
        await reply.code(404).send({ error: "Calendar feed not found" });
        return;
      }
      await reply.send(rotated);
    },
  );

  fastify.delete(
    "/api/calendar/feeds/:id",
    {
      preHandler: jwtPreHandler,
      schema: { params: Type.Object({ id: Type.String() }) },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const ok = await db.revokeCalendarFeed(id, userId);
      if (!ok) {
        await reply.code(404).send({ error: "Calendar feed not found" });
        return;
      }
      await reply.code(204).send();
    },
  );
}
