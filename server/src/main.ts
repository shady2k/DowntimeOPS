import pino from "pino";

const log = pino({ name: "downtime-ops" });

const server = Bun.serve({
  port: 3000,
  fetch(req, server) {
    if (server.upgrade(req)) return;
    return new Response("DowntimeOPS Server");
  },
  websocket: {
    open(_ws) {
      log.info("Client connected");
    },
    message(_ws, message) {
      log.info({ message }, "Received message");
    },
    close(_ws) {
      log.info("Client disconnected");
    },
  },
});

log.info({ port: server.port }, "DowntimeOPS server running");
