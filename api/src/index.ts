// node_modules
import Fastify from "fastify";
import fastifyAuth from "@fastify/auth";
import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyWebsocket from "@fastify/websocket";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
// classes
import { registerAuth } from "./classes/auth";
import { config } from "./classes/config";

// routes
import { adminRoutes } from "./routes/admin";
import { avatarRoutes } from "./routes/avatar";
import { aiRoutes } from "./routes/ai";
import { authRoutes } from "./routes/auth";
import { collaborationRoutes } from "./routes/collaboration";
import { calendarRoutes } from "./routes/calendar";
import { externalRoutes } from "./routes/external";
import { healthRoutes } from "./routes/health";
import { keysRoutes } from "./routes/keys";
import { listsRoutes } from "./routes/lists";
import { pushRoutes } from "./routes/push";
import { recurrenceRoutes } from "./routes/recurrence";
import { searchRoutes } from "./routes/search";
import { settingsRoutes } from "./routes/settings";
import { tagsRoutes } from "./routes/tags";
import { tasksRoutes } from "./routes/tasks";
import { wsRoutes } from "./routes/ws";

// classes
import { ensureVapidKeys } from "./classes/push";
import { startScheduler } from "./classes/scheduler";

async function runMigrations(): Promise<void> {
  const apiRoot = resolve(__dirname, "..");
  const prismaBin = resolve(apiRoot, "node_modules", ".bin", "prisma");
  console.log("Running database migrations…");
  execFileSync(prismaBin, ["migrate", "deploy"], {
    cwd: apiRoot,
    stdio: "inherit",
    env: process.env,
  });
  console.log("Migrations complete.");
}

async function main(): Promise<void> {
  await runMigrations();

  const fastify = Fastify({ logger: true });

  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  });

  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Nova Task External API",
        description:
          "Public REST API for integrating external services with Nova Task.\n\n" +
          "**Authentication:** All external endpoints require an `X-Api-Key` header. " +
          "Generate keys in the app under **Settings → API Keys**.\n\n" +
          "Key management endpoints use a standard `Authorization: Bearer <jwt>` header.",
        version: "1.0.0",
      },
      components: {
        securitySchemes: {
          apiKey: {
            type: "apiKey",
            name: "X-Api-Key",
            in: "header",
            description: "API key generated in Settings → API Keys.",
          },
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            description: "JWT obtained from POST /api/auth/login.",
          },
        },
      },
      tags: [
        {
          name: "External API",
          description:
            "Read and write lists and tasks from external integrations (Home Assistant, automations, scripts, etc.).",
        },
        {
          name: "API Keys",
          description: "Manage the API keys used to authenticate external requests.",
        },
      ],
    },
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: "/api/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      persistAuthorization: true,
    },
  });

  await fastify.register(fastifyAuth);
  await fastify.register(fastifyWebsocket);
  await fastify.register(fastifyMultipart, { limits: { fileSize: 6 * 1024 * 1024 } });

  registerAuth(fastify);

  await fastify.register(healthRoutes);
  await fastify.register(avatarRoutes);
  await fastify.register(authRoutes);
  await fastify.register(listsRoutes);
  await fastify.register(tasksRoutes);
  await fastify.register(recurrenceRoutes);
  await fastify.register(tagsRoutes);
  await fastify.register(searchRoutes);
  await fastify.register(settingsRoutes);
  await fastify.register(adminRoutes);
  await fastify.register(pushRoutes);
  await fastify.register(collaborationRoutes);
  await fastify.register(calendarRoutes);
  await fastify.register(aiRoutes);
  await fastify.register(keysRoutes);
  await fastify.register(externalRoutes);
  await fastify.register(wsRoutes);

  if (config.isProduction) {
    const staticRoot = config.dashboardDistPath;
    if (existsSync(staticRoot)) {
      await fastify.register(fastifyStatic, {
        root: staticRoot,
        prefix: "/",
      });
      fastify.setNotFoundHandler(async (request, reply) => {
        if (request.method === "GET" && !request.url.startsWith("/api")) {
          return reply.sendFile("index.html", staticRoot);
        }
        await reply.code(404).send({ error: "Not found" });
      });
    } else {
      console.error("Dashboard dist path does not exist", staticRoot);
      process.exit(1);
    }
  }

  await fastify.listen({ port: config.port, host: "0.0.0.0" });

  ensureVapidKeys();
  startScheduler();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
