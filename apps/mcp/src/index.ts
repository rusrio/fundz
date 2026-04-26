import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "dotenv";
import { z } from "zod";
import { signedIntentSchema } from "@fundz/shared";

const envPath = resolve(process.cwd(), ".env");
const repoEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../..", ".env");

if (existsSync(envPath)) {
  config({ path: envPath });
}

if (repoEnvPath !== envPath && existsSync(repoEnvPath)) {
  config({ path: repoEnvPath, override: false });
}

const {
  authenticateAgent,
  getDashboardSnapshot,
  getPolicy,
  submitIntent
} = await import("@fundz/core");

const server = new McpServer({
  name: "fundz-mcp",
  version: "0.0.0"
});

function jsonContent(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

server.registerTool(
  "authenticate_agent",
  {
    title: "Authenticate Agent",
    description: "Authenticate an existing Fundz agent by owner address.",
    inputSchema: {
      ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
    }
  },
  async ({ ownerAddress }) => {
    const agent = await authenticateAgent(ownerAddress);
    return jsonContent({ agent });
  }
);

server.registerTool(
  "get_policy",
  {
    title: "Get Policy",
    description: "Return the policy for a registered Fundz agent.",
    inputSchema: {
      agentId: z.string().uuid()
    }
  },
  async ({ agentId }) => {
    const policy = await getPolicy(agentId);
    return jsonContent({ policy });
  }
);

server.registerTool(
  "submit_intent",
  {
    title: "Submit Intent",
    description: "Submit a signed Uniswap swap intent for Fundz policy evaluation.",
    inputSchema: signedIntentSchema
  },
  async (intent) => {
    const storedIntent = await submitIntent(intent);
    return jsonContent({ intent: storedIntent });
  }
);

server.registerTool(
  "get_metrics",
  {
    title: "Get Metrics",
    description: "Return Fundz dashboard metrics and recent state for demo agents, intents, and executions."
  },
  async () => {
    const snapshot = await getDashboardSnapshot();
    return jsonContent(snapshot);
  }
);

await server.connect(new StdioServerTransport());
