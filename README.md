<img width="1672" height="941" alt="fundzbanner" src="https://github.com/user-attachments/assets/48d87d47-0678-449e-9ada-26b53252096e" />

<p align="center">
  <strong>Prop firm infrastructure for AI agents.</strong><br/>
  Policy-enforced execution · Uniswap · Gnosis Safe · Automatic risk exit
</p>

<p align="center">
  <img src="https://img.shields.io/badge/chain-Ethereum%20mainnet%20fork-blue" />
  <img src="https://img.shields.io/badge/execution-Gnosis%20Safe-green" />
  <img src="https://img.shields.io/badge/DEX-Uniswap-ff007a" />
  <img src="https://img.shields.io/badge/interface-MCP%20%2B%20REST-purple" />
  <img src="https://img.shields.io/badge/env-Tenderly%20VNet-orange" />
</p>

---

## What is Fundz?

Fundz is a trust and execution layer between AI agents and DeFi. An AI agent submits a swap intent via REST API or MCP, and Fundz handles everything else: authentication, policy enforcement, Uniswap quote fetching, and Safe transaction execution. The agent never constructs calldata or manages keys.

Beyond execution gating, Fundz runs a continuous risk monitor that values each agent's Gnosis Safe using live Uniswap quotes. If the portfolio drops below a protected floor, Fundz automatically disables the agent, revokes all tokens, and exits the position back to the base asset.

Think of it as a prop firm model applied to AI agents: Fundz provides capital, sets the rules, and enforces a margin call if the agent blows through its loss buffer.

---

## Architecture

```
┌──────────────────────┐     ┌──────────────────────┐
│   AI Agent (MCP)     │     │   AI Agent (REST)    │
└─────────┬────────────┘     └──────────┬───────────┘
          │ MCP tools                   │ POST /intents
          ▼                             ▼
┌─────────────────────────────────────────────────────┐
│                   apps/api - Core API               │
│                                                     │
│  Auth -> Policy Engine -> Uniswap Adapter -> Safe Kit│
└────────────────────────┬────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   Uniswap Routing   Gnosis Safe    Prisma/SQLite
       API           ProtocolKit      (persist)
          │              │
          └──────────────▼
               Tenderly VNet
            (Ethereum mainnet fork, chainId: 1)
```

| Package | Role |
|---|---|
| `apps/api` | Core API - auth, policy, intents, execution |
| `apps/web` | React dashboard - portfolio, trades, risk, payout |
| `apps/mcp` | MCP server facade - tool interface for AI clients |
| `packages/core` | Domain logic - agents, policy, intents, execution |
| `packages/db` | Prisma + SQLite schema and access layer |
| `packages/safe-kit` | Gnosis Safe ProtocolKit integration |
| `packages/adapters/uniswap` | Uniswap Routing API - quote + swap calldata |
| `packages/shared` | Shared types and Zod schemas |

---

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm db:setup
pnpm typecheck
```

Set `UNISWAP_API_KEY` in `.env` to enable real Uniswap quotes. Without it, approved intents still create a pending execution with a clear configuration message.

Feedback for the Uniswap Foundation is available on [`FEEDBACK.md`](./.FEEDBACK.md)

---

## How It Works

### 1. Register an agent

```bash
curl -s -X POST http://localhost:3001/agents/register \
  -H 'content-type: application/json' \
  -d '{
    "name": "My Agent",
    "ownerAddress": "0x1111111111111111111111111111111111111111"
  }'
```

Fundz assigns a Gnosis Safe automatically and returns a bearer token. Store it - Fundz only keeps the hash.

### 2. Submit an intent

```bash
curl -s -X POST http://localhost:3001/intents \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer <agentToken>' \
  -d '{
    "agentId": "<agentId>",
    "nonce": "swap-1",
    "action": "uniswap.swap",
    "chainId": 1,
    "tokenIn":  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "tokenOut": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "amountIn": "1000000",
    "maxSlippageBps": 50,
    "deadline": "2026-12-31T00:00:00.000Z"
  }'
```

Fundz authenticates the token, evaluates policy, fetches a Uniswap quote and Universal Router calldata, and executes the swap through the Safe. Each `(agentId, nonce)` pair is unique - change `nonce` for repeat tests.

### 3. Via MCP

Configure any MCP-compatible client (Claude Desktop, OpenClaw) to run:

```bash
node /path/to/fundz/apps/mcp/dist/index.js
```

Available tools: `authenticate_agent` · `submit_intent` · `get_policy` · `issue_agent_token` · `list_agent_tokens` · `revoke_agent_token` · `get_metrics`

The MCP server is a thin facade over `packages/core` - it contains no policy or execution logic.

---

## Tenderly Mainnet Fork

The MVP runs on a Tenderly Virtual TestNet forked from Ethereum mainnet (`chainId: 1`). Same contract addresses, same Uniswap pools, same liquidity as mainnet - but no transactions hit mainnet.

### Setup

```bash
TENDERLY_VNET_RPC_URL="<your Tenderly VNet admin RPC URL>"
SAFE_RPC_URL="<same URL>"
SAFE_EXECUTOR_PRIVATE_KEY="<private key for a Safe signer on the fork>"
SAFE_EXECUTOR_ADDRESS="<address for that key>"
UNISWAP_API_KEY="<Uniswap API key>"
```

### Prepare the fork

```bash
pnpm demo:tenderly:prepare   # fund executor + set Safe ERC-20 balances via admin RPC
pnpm demo:tenderly:balances  # verify
pnpm demo:tenderly:approve   # submit Safe ERC-20 + Permit2 approvals for Universal Router
```

### Run

```bash
pnpm dev:api                 # terminal 1
pnpm dev:web                 # terminal 2
pnpm demo:tenderly:swap      # submit a swap intent
```

---

## Risk Monitor & Emergency Exit

Fundz monitors each agent's Safe continuously:

```
portfolio value = base token balance + uniswap_quote(risk token -> base token)
protected floor = protocol capital + access fee
loss buffer     = portfolio value - protected floor
```

When `portfolio value <= protected floor`:

1. Agent is disabled
2. All bearer tokens are revoked
3. Full risk-asset balance is quoted back to base token via Uniswap
4. Emergency swap is executed through the Safe executor
5. `RiskSnapshot` and `RiskEvent` are recorded in Prisma

The emergency exit does not require agent cooperation. Fundz owns the execution path entirely.

### Simulate a market crash

```bash
pnpm demo:risk:monitor           # terminal 1 - start monitor
pnpm demo:tenderly:market-move   # terminal 2 - large directional swap on the VNet pool
```

`market-move` uses Tenderly admin RPC to fund a test EOA and execute a real Universal Router swap via `cast` (Foundry), moving the pool price against the agent's position. Requires [Foundry](https://getfoundry.sh/).

---

## Policy Engine

Every intent passes through policy before execution:

- Token allowlist
- Chain allowlist (`chainId`)
- Max amount per operation
- Daily rolling limit
- Cooldown between operations
- Deadline validation

Rejected intents are stored with the policy reason. Approved intents proceed to Uniswap quote fetching and Safe execution.

---

## Dashboard

```bash
pnpm dev:web   # http://localhost:3000
```

Wallet-scoped - shows only the connected owner's agent:

- Safe address and status (active / disabled / emergency exit)
- Policy allowlist
- Full trade history
- Portfolio value and open positions
- Portfolio delta and drawdown
- Protected Fundz capital vs agent margin
- Claimable payout (80% of positive delta)

---

## Payout

Agents that trade profitably can claim 80% of positive portfolio delta:

```bash
curl -s -X POST http://localhost:3001/agents/<agentId>/payouts \
  -H 'content-type: application/json' \
  -d '{ "ownerAddress": "<connected owner wallet>" }'
```

---

## Environment Variables

See [`.env.example`](./.env.example) for the full reference.

| Variable | Description |
|---|---|
| `TENDERLY_VNET_RPC_URL` | Tenderly VNet admin RPC URL |
| `SAFE_EXECUTOR_PRIVATE_KEY` | Private key for the Safe executor |
| `UNISWAP_API_KEY` | Required for real Uniswap quotes |
| `FUNDZ_PROTOCOL_CAPITAL` | Capital Fundz puts into each Safe (base units) |
| `AGENT_LOSS_MARGIN` | Agent's loss buffer before emergency exit triggers |
| `AGENT_ACCESS_FEE` | Access fee recorded as revenue, not risk budget |
| `RISK_MONITOR_INTERVAL_MS` | Risk monitor polling interval |

---

## MVP Boundaries

**Included:**
- TypeScript monorepo - `apps/` and `packages/`
- SQLite + Prisma persistence
- REST API + MCP server facade
- React dashboard with wallet connection
- Uniswap quote and swap calldata - server-side, agent never sees calldata
- Safe transaction submission on Tenderly mainnet forks
- Receipt-aware execution failure handling
- Risk monitor with bearer-token revocation and emergency Safe exit
- Agent payout requests (80% of positive portfolio delta)
- Tenderly market-move simulation scripts

**Not included yet:**
- Editable policies in the dashboard
- Production auth
- Automatic Safe deployment pool
- Multi-protocol adapters beyond Uniswap

---

## License

MIT
