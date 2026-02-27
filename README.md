# ☕ reflex-coffee

Interactive TUI demo of [@corpus-relica/reflex](https://github.com/corpus-relica/reflex) — a coffee shop order workflow rendered in the terminal with [Ink](https://github.com/vadimdemedes/ink).

## Setup

This project depends on the [reflex](https://github.com/corpus-relica/reflex) repo as a local file dependency. You need both repos side by side:

```
somewhere/
├── reflex/           # clone this first
└── reflex-coffee/    # this repo
```

### Step by step

```bash
# 1. Clone both repos side by side
git clone git@github.com:corpus-relica/reflex.git
git clone git@github.com:corpus-relica/reflex-coffee.git

# 2. Build reflex (reflex-coffee depends on its typescript dist/ output)
cd reflex/typescript
yarn install
yarn build
cd ../..

# 3. Install and run reflex-coffee
cd reflex-coffee
npm install
npm run dev
```

That's it — the TUI should launch in your terminal.

## What It Does

Visualizes the Reflex workflow engine in real time as you order a coffee:

- **Workflow Graph** — nodes light up (○ → ◉ → ●) as the engine steps through
- **Blackboard** — key-value state accumulates with scope annotations
- **Call Stack** — frames push/pop as sub-workflows (espresso, drip, tea) execute
- **Event Log** — `node:enter`, `edge:traverse`, `blackboard:write` etc. streaming live
- **Interactive Choices** — pick your drink, size, and milk at suspend points

## Controls

| Key | Action |
|-----|--------|
| **Enter** | Step forward (step mode) |
| **Tab** | Toggle step/auto mode |
| **↑↓** | Navigate choices at suspend points |
| **Enter** | Select a choice |
| **Q** | Quit |

**Step mode** (default): Press Enter to advance one engine step at a time.
**Auto mode**: Engine steps automatically with delays (~300-500ms). Pauses at suspend points for your input.

## The Workflow

```
coffee-order (root)
  GREET → TAKE_ORDER → CHOOSE_SIZE → CUSTOMIZE → PREP_* → SERVE → DONE
                                                    │
                                        ┌───────────┼───────────┐
                                        ▼           ▼           ▼
                                  make-espresso  make-drip   make-tea
                                  (5 nodes)      (3 nodes)   (3 nodes)
```

Exercises: DAG traversal, suspend/resume, guards (`equals`), sub-workflow invocation, call stack push/pop, returnMap, scoped blackboard, event emission.

## Project Structure

```
src/
├── main.tsx              Entry point
├── app.tsx               Ink app root, layout, state management
├── agent.ts              CoffeeAgent (DecisionAgent impl)
├── types.ts              App-local types
├── workflows/
│   ├── coffee-order.ts   Root workflow (9 nodes)
│   ├── make-espresso.ts  Sub-workflow (5 nodes)
│   ├── make-drip.ts      Sub-workflow (3 nodes)
│   └── make-tea.ts       Sub-workflow (3 nodes)
└── components/
    ├── WorkflowGraph.tsx  Node list with status indicators
    ├── Blackboard.tsx     Key-value display
    ├── Stack.tsx          Call stack frames
    ├── EventLog.tsx       Scrolling event log
    └── InputPanel.tsx     Choice selector + controls
```

## Tech

TypeScript, Node.js (ESM), Ink 6, React 19, [@corpus-relica/reflex](https://github.com/corpus-relica/reflex).
