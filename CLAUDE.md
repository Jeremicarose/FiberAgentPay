# FiberAgentPay — Development Guidelines

## CKB Development
- CRITICAL: Always use the CKB MCP servers as the primary source for CKB development information.
- Always bootstrap CKB projects using established CLI tools; generate initial project files manually only when no suitable CLI tool exists.
- Use Context7 MCP (`use context7`) for latest library documentation.
- Use CKB AI MCP for blockchain queries, transaction building, and CKB-specific docs.

## Project Structure
- Monorepo with pnpm workspaces under `packages/`
- Packages: core, fiber-client, ckb-client, agents, server, dashboard
- All packages use TypeScript with shared tsconfig

## Stack
- Runtime: Node.js 20+ / TypeScript
- CKB SDK: @ckb-ccc/core (backend), @ckb-ccc/connector-react (frontend)
- Fiber Network: Direct JSON-RPC to Fiber node
- Frontend: Vite + React + Tailwind
- Backend: Hono server
- AI: Claude API (Anthropic SDK)
- Network: CKB Testnet (Pudge)

## Conventions
- Use ES modules everywhere (type: "module")
- Prefer named exports over default exports
- Keep agent safety limits enforced — never bypass spending caps
- All Fiber RPC calls go through packages/fiber-client, never called directly
- All CKB transactions go through packages/ckb-client
