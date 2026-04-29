# Fundz

Fundz is a policy-enforced execution layer for AI agents.

An external agent submits an intent. Fundz authenticates the agent, evaluates policy, requests backend-only Uniswap quote/swap calldata, and executes the swap through the agent's Safe. For the MVP, execution is run against a Tenderly Virtual TestNet fork of Ethereum mainnet so Uniswap liquidity is real while no transaction is sent to mainnet.

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

## Tenderly Mainnet Fork Demo

For the MVP, use a Tenderly Virtual TestNet forked from Ethereum mainnet instead of a public testnet. This keeps `chainId: 1` and gives the demo access to real Uniswap liquidity without sending transactions to mainnet.

Create a mainnet Virtual TestNet in Tenderly, then configure `.env`. Use the Admin RPC for `TENDERLY_VNET_RPC_URL` because the demo preparation script needs Tenderly admin methods to set test balances.

```bash
TENDERLY_VNET_RPC_URL="<your Tenderly VNet RPC URL>"
SAFE_RPC_URL="<same Tenderly VNet RPC URL>"
SAFE_EXECUTOR_PRIVATE_KEY="<private key for a Safe signer on the fork>"
SAFE_EXECUTOR_ADDRESS="<address for that private key>"
SAFE_EXECUTION_GAS_LIMIT="3000000"
DEMO_OWNER_ADDRESS="<demo agent owner>"
DEMO_SAFE_ADDRESS="<existing Safe address on mainnet/fork>"
DEMO_TOKEN_IN="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
DEMO_TOKEN_OUT="0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
DEMO_AMOUNT_IN="1000000"
DEMO_MAX_AMOUNT_PER_OPERATION="1000000000"
DEMO_DAILY_LIMIT="5000000000"
```

Prepare the fork state, check balances, and approve Uniswap spending:

```bash
pnpm demo:tenderly:prepare
pnpm demo:tenderly:balances
pnpm demo:tenderly:approve
```

The prepare step uses Tenderly admin RPC methods to set ETH on `SAFE_EXECUTOR_ADDRESS` and ERC-20 balance on `DEMO_SAFE_ADDRESS`. The approve step submits Safe transactions for the ERC-20 and Permit2 approvals needed by Uniswap Universal Router. The default token is USDC and the default balance is configured in base units through `DEMO_SAFE_TOKEN_BALANCE`.

Run the API, then submit a demo swap intent:

```bash
pnpm dev:api
pnpm demo:tenderly:swap
```

The API still evaluates the same Fundz policy. If approved, it requests a Uniswap quote/swap payload and executes it through Safe ProtocolKit against the Tenderly VNet RPC.

For repeat demos on a fresh VNet, run `prepare`, `balances`, and `approve` before submitting the swap. If the Safe or token deployment happened after the VNet was created, recreate the VNet from a later mainnet block so the fork includes those contracts.

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

Submit an intent:

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

The `signature` field is currently stored and format-validated only. Cryptographic intent signature verification is still outside the MVP.

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

Approved intents create a Uniswap execution record. If Safe execution is configured, Fundz submits the swap through the Safe and waits for the transaction receipt. Rejected intents store policy reasons.

## Current MVP Boundaries

Included:

- TypeScript monorepo with `apps/` and `packages/`
- SQLite + Prisma persistence
- Core API
- MCP facade
- dashboard
- Safe address linking
- Uniswap quote and swap calldata preparation from the backend
- Safe transaction submission on Tenderly mainnet forks
- Tenderly demo scripts for funding, approvals, balance checks, and swap submission
- receipt-aware Safe execution failure handling

Not included yet:

- cryptographic signature verification
- editable policies in the dashboard
- production auth
- multi-protocol adapters
- production-grade execution monitoring and reconciliation
