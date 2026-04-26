import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  authenticateAgent,
  getDashboardSnapshot,
  getAgentSafe,
  getPolicy,
  linkAgentSafe,
  registerAgent,
  submitIntent
} from "@fundz/core";

const port = Number(process.env.PORT ?? 3001);

type Handler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  response.end(JSON.stringify(body));
}

function sendError(response: ServerResponse, statusCode: number, message: string) {
  sendJson(response, statusCode, { error: message });
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody.length > 0 ? JSON.parse(rawBody) : {};
}

function routeKey(request: IncomingMessage): string {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  return `${request.method ?? "GET"} ${url.pathname}`;
}

const handlers: Record<string, Handler> = {
  "GET /health": async (_request, response) => {
    sendJson(response, 200, { ok: true, service: "fundz-api" });
  },
  "POST /agents/register": async (request, response) => {
    const result = await registerAgent((await readJson(request)) as never);
    sendJson(response, 201, result);
  },
  "POST /agents/authenticate": async (request, response) => {
    const body = (await readJson(request)) as { ownerAddress?: string };

    if (!body.ownerAddress) {
      sendError(response, 400, "ownerAddress is required");
      return;
    }

    const agent = await authenticateAgent(body.ownerAddress);
    sendJson(response, 200, { agent });
  },
  "GET /dashboard": async (_request, response) => {
    sendJson(response, 200, await getDashboardSnapshot());
  },
  "POST /intents": async (request, response) => {
    const intent = await submitIntent((await readJson(request)) as never);
    sendJson(response, 201, { intent });
  }
};

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname.startsWith("/agents/") && url.pathname.endsWith("/policy")) {
      const agentId = url.pathname.split("/")[2];
      const policy = agentId ? await getPolicy(agentId) : null;

      if (!policy) {
        sendError(response, 404, "Policy not found");
        return;
      }

      sendJson(response, 200, { policy });
      return;
    }

    if (url.pathname.startsWith("/agents/") && url.pathname.endsWith("/safe")) {
      const agentId = url.pathname.split("/")[2];

      if (!agentId) {
        sendError(response, 400, "agentId is required");
        return;
      }

      if (request.method === "GET") {
        const safe = await getAgentSafe(agentId);

        if (!safe) {
          sendError(response, 404, "Safe not linked");
          return;
        }

        sendJson(response, 200, { safe });
        return;
      }

      if (request.method === "POST") {
        const body = (await readJson(request)) as { safeAddress?: string };

        if (!body.safeAddress) {
          sendError(response, 400, "safeAddress is required");
          return;
        }

        const agent = await linkAgentSafe({ agentId, safeAddress: body.safeAddress });
        sendJson(response, 200, { agent });
        return;
      }
    }

    const handler = handlers[routeKey(request)];

    if (!handler) {
      sendError(response, 404, "Route not found");
      return;
    }

    await handler(request, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    sendError(response, 400, message);
  }
});

server.listen(port, () => {
  console.log(`Fundz API listening on http://localhost:${port}`);
});
