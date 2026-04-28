# Fundz

Fundz is a policy-enforced execution layer for AI agents.

An external agent produces a signed intent. Fundz authenticates the agent, evaluates policy, prepares execution through the agent's Safe, and uses the backend-only Uniswap adapter for quotes. The current MVP records prepared executions; real on-chain Safe execution is intentionally left for the next phase.

This repository is organized as a TypeScript monorepo:

- `apps/api`: Fundz Core API
- `apps/web`: demo dashboard
- `apps/mcp`: MCP server facade
- `packages/shared`: shared types and schemas
- `packages/core`: domain logic for agents, policy, intents, and execution
- `packages/db`: database schema and access layer
- `packages/safe-kit`: Agent Safe integration
- `packages/adapters/uniswap`: Uniswap execution adapter

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm db:setup
pnpm typecheck
```

Set `UNISWAP_API_KEY` in `.env` to enable real Uniswap quotes. Without it, approved intents still create a pending execution with a clear configuration message.

## Run The Demo

Use separate terminals:

```bash
pnpm dev:api
pnpm dev:web
```

Open:

- API: `http://localhost:3001/health`
- Dashboard: `http://localhost:3000`

The dashboard reads `GET /dashboard` from `VITE_API_URL` or `http://localhost:3001` by default.

## API Happy Path

Register or update a demo agent:

```bash
curl -s -X POST http://localhost:3001/agents/register \
  -H 'content-type: application/json' \
  -d '{
    "name": "Demo Agent",
    "ownerAddress": "0x1111111111111111111111111111111111111111",
    "safeAddress": "0x2222222222222222222222222222222222222222"
  }'
```

Get policy:

```bash
curl -s http://localhost:3001/agents/<agentId>/policy
```

Submit a signed intent:

```bash
curl -s -X POST http://localhost:3001/intents \
  -H 'content-type: application/json' \
  -d '{
    "agentId": "<agentId>",
    "nonce": "demo-1",
    "action": "uniswap.swap",
    "chainId": 1,
    "tokenIn": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "tokenOut": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "amountIn": "1000000",
    "maxSlippageBps": 50,
    "deadline": "2026-12-31T00:00:00.000Z",
    "signature": "0xabcdef"
  }'
```

Each `(agentId, nonce)` pair is unique. Change `nonce` for repeat tests.

## MCP

Build first:

```bash
pnpm typecheck
```

Configure an MCP client, such as OpenClaw, to run:

```bash
node /home/rome0/fundz/apps/mcp/dist/index.js
```

Available tools:

- `authenticate_agent`
- `get_policy`
- `submit_intent`
- `get_metrics`

The MCP server is a thin facade over `packages/core`; it does not contain policy or execution logic.

## Policy MVP

The minimum policy engine enforces:

- token allowlist
- chain allowlist via `chainId`
- max amount per operation
- cooldown
- daily limit
- deadline

Approved intents create a Uniswap execution record. Rejected intents store policy reasons.

## Current MVP Boundaries

Included:

- TypeScript monorepo with `apps/` and `packages/`
- SQLite + Prisma persistence
- Core API
- MCP facade
- dashboard
- Safe address linking
- Uniswap quote preparation from the backend

Not included yet:

- real Safe transaction submission
- cryptographic signature verification
- editable policies in the dashboard
- production auth
- multi-protocol adapters
