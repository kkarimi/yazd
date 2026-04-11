import { createServer } from "vite";

const server = await createServer({
  configFile: "app.vite.config.ts",
});

await server.listen();
server.printUrls();

const shutdown = async () => {
  await server.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
