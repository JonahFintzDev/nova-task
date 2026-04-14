// node_modules
import Fastify from "fastify";
import fastifyAuth from "@fastify/auth";
import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
// classes
import { registerAuth } from "./classes/auth";
import { config } from "./classes/config";

// routes
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { listsRoutes } from "./routes/lists";
import { searchRoutes } from "./routes/search";
import { settingsRoutes } from "./routes/settings";
import { tagsRoutes } from "./routes/tags";
import { tasksRoutes } from "./routes/tasks";

async function main(): Promise<void> {
  const fastify = Fastify({ logger: true });

  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  });

  await fastify.register(fastifyAuth);

  registerAuth(fastify);

  await fastify.register(healthRoutes);
  await fastify.register(authRoutes);
  await fastify.register(listsRoutes);
  await fastify.register(tasksRoutes);
  await fastify.register(tagsRoutes);
  await fastify.register(searchRoutes);
  await fastify.register(settingsRoutes);
  await fastify.register(adminRoutes);

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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
