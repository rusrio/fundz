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

For the full hackathon walkthrough, use [DEMO_CHEATSHEET.md](./DEMO_CHEATSHEET.md). It contains the exact setup, Tenderly preparation, MCP/OpenClaw flow, risk monitor, market-move simulation, and troubleshooting commands.

Prize feedback for the Uniswap Foundation track is included in [FEEDBACK.md](./FEEDBACK.md).

## Tenderly Mainnet Fork Demo

For the MVP, use a Tenderly Virtual TestNet forked from Ethereum mainnet instead of a public testnet. This keeps `chainId: 1` and gives the demo access to real Uniswap liquidity without sending transactions to mainnet.

Create a mainnet Virtual TestNet in Tenderly, then configure `.env`. Use the Admin RPC for `TENDERLY_VNET_RPC_URL` because the demo preparation script needs Tenderly admin methods to set test balances.

```bash
TENDERLY_VNET_RPC_URL="<your Tenderly VNet RPC URL>"
SAFE_RPC_URL="<same Tenderly VNet RPC URL>"
SAFE_EXECUTOR_PRIVATE_KEY="<private key for a Safe signer on the fork>"
SAFE_EXECUTOR_ADDRESS="<address for that private key>"
SAFE_EXECUTION_GAS_LIMIT="3000000"
FUNDZ_AGENT_TOKEN="<optional existing agent token>"
DEMO_OWNER_ADDRESS="<demo agent owner>"
DEMO_SAFE_ADDRESS="<existing Safe address on mainnet/fork>"
FUNDZ_FUNDED_SAFE_ADDRESS="<Safe Fundz assigns automatically; defaults to DEMO_SAFE_ADDRESS>"
DEMO_TOKEN_IN="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
DEMO_TOKEN_OUT="0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
DEMO_TOKEN_WBTC="0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"
DEMO_TOKEN_UNI="0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"
DEMO_AMOUNT_IN="1000000"
DEMO_MAX_AMOUNT_PER_OPERATION="1000000000"
DEMO_DAILY_LIMIT="5000000000"
```

Fundz authenticates agent calls with bearer tokens. `POST /agents/register` returns a credential token once; store it as `FUNDZ_AGENT_TOKEN` for repeat runs. The token is stored only as a hash in the database. During registration Fundz automatically assigns `FUNDZ_FUNDED_SAFE_ADDRESS` to the agent, so the user does not link a Safe manually in the app.

Prepare the fork state, check balances, and approve Uniswap spending:

```bash
pnpm demo:tenderly:prepare
pnpm demo:tenderly:balances
pnpm demo:tenderly:approve
```

The prepare step uses Tenderly admin RPC methods to set ETH on `SAFE_EXECUTOR_ADDRESS` and ERC-20 balance on `DEMO_SAFE_ADDRESS`. The approve step submits Safe transactions for the ERC-20 and Permit2 approvals needed by Uniswap Universal Router for both `DEMO_TOKEN_IN` and `DEMO_TOKEN_OUT`, so the normal swap and emergency exit path are both authorized. The default base token is USDC and the default balance is configured in base units through `DEMO_SAFE_TOKEN_BALANCE`.

Run the API, then submit a demo swap intent:

```bash
pnpm dev:api
pnpm demo:tenderly:swap
```

The API still evaluates the same Fundz policy. If approved, it requests a Uniswap quote/swap payload and executes it through Safe ProtocolKit against the Tenderly VNet RPC.

For repeat demos on a fresh VNet, run `prepare`, `balances`, and `approve` before submitting the swap. If the Safe or token deployment happened after the VNet was created, recreate the VNet from a later mainnet block so the fork includes those contracts.

## Risk Monitor And Emergency Exit Demo

Fundz can monitor a demo agent's Safe in near real time using Uniswap quotes as the price source. The monitor values the Safe as:

```text
base token balance + Uniswap quote(risk token -> base token)
```

For the default demo, `DEMO_TOKEN_IN` is USDC and `DEMO_TOKEN_OUT` is WETH. The normal policy allowlist also includes WBTC and UNI, so the story can be framed as Fundz granting the agent access to WETH/USDC, WBTC/USDC, and UNI/USDC while the emergency monitor watches the active risk asset.

The MVP risk model is intentionally simple:

```text
initial Safe value = Fundz protocol capital + agent loss margin + access fee
protected value = Fundz protocol capital + access fee
loss buffer = current Safe value - protected value
```

The agent pays the loss margin and access fee into the Safe. Fundz funds the protocol capital. The access fee is recorded as fee revenue, not as risk budget. Only the agent loss margin can be consumed by market loss before Fundz revokes access and exits back to the base asset.

Configure the risk and market-move environment:

```bash
FUNDZ_PROTOCOL_CAPITAL="89000000000"
AGENT_LOSS_MARGIN="10000000000"
AGENT_ACCESS_FEE="1000000000"
RISK_EMERGENCY_SLIPPAGE_BPS="100"
RISK_MONITOR_INTERVAL_MS="10000"

MARKET_ACTOR_PRIVATE_KEY="<private key for a funded Tenderly-only EOA>"
MARKET_ACTOR_ADDRESS="<address for MARKET_ACTOR_PRIVATE_KEY>"
MARKET_MOVE_TOKEN_IN="0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
MARKET_MOVE_TOKEN_OUT="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
MARKET_MOVE_AMOUNT_IN="100000000000000000000"
MARKET_ACTOR_TOKEN_BALANCE="1000000000000000000000"
MARKET_ACTOR_ETH_BALANCE="10000000000000000000"
```

Registering an agent automatically creates the default risk policy for that agent, so the dashboard can show Risk Budget and Portfolio Delta without editing `DEMO_OWNER_ADDRESS`. To manually re-apply the demo defaults to the configured demo owner, run:

```bash
pnpm demo:risk:setup
```

In one terminal, start the monitor. By default it scans every enabled risk policy, so newly registered agents are included automatically:

```bash
pnpm demo:risk:monitor
```

In another terminal, simulate a third-party market move on the Tenderly fork:

```bash
pnpm demo:tenderly:market-move
```

`demo:tenderly:market-move` uses Tenderly admin RPC methods to fund `MARKET_ACTOR_ADDRESS`, gives it ERC-20 balance, approves Uniswap, then sends a real Universal Router swap through `cast` against the VNet RPC. By default it sells WETH into USDC to move the monitored WETH position against the agent. Install Foundry so the `cast` command is available.

When the monitored Safe value is at or below the protected value, Fundz:

- disables the agent
- revokes every active bearer token for that agent
- quotes the full risk-asset balance back to the base asset through Uniswap
- executes the emergency swap through the Safe with the backend executor
- records a `RiskSnapshot` and `RiskEvent` in Prisma

The emergency path does not require the agent to be a Safe owner. The agent only authenticates to Fundz with its bearer token; Fundz owns the policy decision and Safe execution path.

## Run The Demo

Use separate terminals:

```bash
pnpm dev:api
pnpm dev:web
```

Open:

- API: `http://localhost:3001/health`
- Dashboard: `http://localhost:3000`

The dashboard reads `GET /dashboard` from `VITE_API_URL` or `http://localhost:3001` by default. For the live demo it shows only the connected wallet's agent: public owner address, automatically assigned Fundz Safe, policy allowlist, full trade history, portfolio value, open positions, portfolio delta, drawdown, protected Fundz capital, agent margin, claimable payout, total payout received, and emergency-exit status. Portfolio valuation uses Safe token balances from the configured RPC and Uniswap quotes for non-USDC positions.

## API Happy Path

Register or update a demo agent:

```bash
curl -s -X POST http://localhost:3001/agents/register \
  -H 'content-type: application/json' \
  -d '{
    "name": "Demo Agent",
    "ownerAddress": "0x1111111111111111111111111111111111111111"
  }'
```

Fundz assigns `FUNDZ_FUNDED_SAFE_ADDRESS` automatically during registration. The response includes `credential.token`. Save it securely; Fundz stores only its hash and will not be able to show the same token again.

Manage agent tokens:

```bash
curl -s http://localhost:3001/agents/<agentId>/credentials

curl -s -X POST http://localhost:3001/agents/<agentId>/credentials \
  -H 'content-type: application/json' \
  -d '{ "label": "agent-runtime" }'

curl -s -X POST http://localhost:3001/agents/<agentId>/credentials/<credentialId>/revoke
```

Credential list responses never include token secrets. Revoked tokens can no longer submit intents.

Request an agent payout:

```bash
curl -s -X POST http://localhost:3001/agents/<agentId>/payouts \
  -H 'content-type: application/json' \
  -d '{ "ownerAddress": "<connected owner wallet>" }'
```

The payout endpoint pays 80% of positive portfolio delta to the connected owner wallet. The dashboard shows both currently claimable payout and total payout already sent.

Get policy:

```bash
curl -s http://localhost:3001/agents/<agentId>/policy
```

Submit an intent:

```bash
curl -s -X POST http://localhost:3001/intents \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer <agentToken>' \
  -d '{
    "agentId": "<agentId>",
    "nonce": "demo-1",
    "action": "uniswap.swap",
    "chainId": 1,
    "tokenIn": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "tokenOut": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "amountIn": "1000000",
    "maxSlippageBps": 50,
    "deadline": "2026-12-31T00:00:00.000Z"
  }'
```

Each `(agentId, nonce)` pair is unique. Change `nonce` for repeat tests.

Fundz verifies the bearer token before policy evaluation. The token must belong to the same `agentId` included in the intent.

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
- `submit_intent` (requires `FUNDZ_AGENT_TOKEN` in the MCP server environment)
- `issue_agent_token`
- `list_agent_tokens`
- `revoke_agent_token`
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
- automatic Fundz funded Safe assignment during agent registration
- wallet-scoped dashboard with disconnect support
- Uniswap quote and swap calldata preparation from the backend
- Safe transaction submission on Tenderly mainnet forks
- Tenderly demo scripts for funding, approvals, balance checks, and swap submission
- receipt-aware Safe execution failure handling
- risk monitor snapshots, bearer-token revocation, and emergency Safe exit
- agent payout requests for 80% of positive portfolio delta
- Tenderly market-move demo script for third-party pool movement simulation

Not included yet:

- cryptographic signature verification
- editable policies in the dashboard
- production auth
- automatic Safe deployment/allocation pool
- multi-protocol adapters
- production-grade execution monitoring and reconciliation
