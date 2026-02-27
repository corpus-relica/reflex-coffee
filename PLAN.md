# reflex-coffee

Interactive TUI demo of [@corpus-relica/reflex](https://github.com/corpus-relica/reflex) — a coffee shop order workflow rendered in the terminal with [Ink](https://github.com/vadimdemedes/ink).

## Goal

Visualize Reflex engine operation in real time: nodes activating, blackboard state accumulating, stack frames pushing/popping, guards filtering edges — all driven by interactive user choices at suspend points.

This is demo #1 in a series. Demo #2 (future) is a dungeon crawl.

---

## Workflow Design

### Overview

4 workflows total: 1 root + 3 sub-workflows (one per drink type).

```
coffee-order (root)
├── make-espresso (sub-workflow, 5 nodes)
├── make-drip (sub-workflow, 3 nodes)
└── make-tea (sub-workflow, 3 nodes)
```

### Root Workflow: `coffee-order`

```
GREET ──→ TAKE_ORDER ──→ CHOOSE_SIZE ──→ CUSTOMIZE ──┬──→ PREP_ESPRESSO ──→ SERVE ──→ DONE
                                                      ├──→ PREP_DRIP ───────→ SERVE
                                                      └──→ PREP_TEA ────────→ SERVE
```

**Nodes:**

| Node | Behavior | Suspend? |
|------|----------|----------|
| GREET | Welcome message. Auto-advance. | No |
| TAKE_ORDER | "What drink?" Writes `drink_type` to blackboard. | Yes — user picks espresso/drip/tea |
| CHOOSE_SIZE | "What size?" Writes `size` to blackboard. | Yes — user picks small/medium/large |
| CUSTOMIZE | "Add-ons?" Writes `milk_type`, `extras` to blackboard. | Yes — user picks options |
| PREP_ESPRESSO | Invocation node → `make-espresso`. | No (auto) |
| PREP_DRIP | Invocation node → `make-drip`. | No (auto) |
| PREP_TEA | Invocation node → `make-tea`. | No (auto) |
| SERVE | Reads `drink_result` from returnMap. Writes `order_complete`. | No |
| DONE | Terminal node. | No |

**Guarded edges (fan-out from CUSTOMIZE):**

| Edge | Guard | Target |
|------|-------|--------|
| e-customize-espresso | `equals: drink_type = 'espresso'` | PREP_ESPRESSO |
| e-customize-drip | `equals: drink_type = 'drip'` | PREP_DRIP |
| e-customize-tea | `equals: drink_type = 'tea'` | PREP_TEA |

**Invocation nodes:**

| Node | Invokes | ReturnMap |
|------|---------|-----------|
| PREP_ESPRESSO | `make-espresso` | `drink_result` ← `espresso_result` |
| PREP_DRIP | `make-drip` | `drink_result` ← `drip_result` |
| PREP_TEA | `make-tea` | `drink_result` ← `tea_result` |

### Sub-workflow: `make-espresso` (5 nodes)

```
GRIND ──→ TAMP ──→ EXTRACT ──→ STEAM_MILK ──→ ESPRESSO_DONE
```

Each node writes a status key (`grind_status`, `tamp_status`, etc.). Terminal node writes `espresso_result`. All auto-advance (the agent runs through these without suspending — shows the engine stepping fast).

### Sub-workflow: `make-drip` (3 nodes)

```
MEASURE ──→ BREW ──→ DRIP_DONE
```

Writes `measure_status`, `brew_status`, `drip_result`.

### Sub-workflow: `make-tea` (3 nodes)

```
BOIL ──→ STEEP ──→ TEA_DONE
```

Writes `boil_status`, `steep_status`, `tea_result`.

### Reflex Features Exercised

| Feature | Where |
|---------|-------|
| DAG traversal | Every step |
| Suspend / resume | TAKE_ORDER, CHOOSE_SIZE, CUSTOMIZE |
| Guards (builtin `equals`) | CUSTOMIZE → PREP_* fan-out |
| Sub-workflow invocation | PREP_* nodes |
| Call stack push/pop | Enter/exit make-* workflows |
| ReturnMap | drink_result flows back to root |
| Scoped blackboard | Sub-workflows read root's `size`, `milk_type` |
| Event emission | Rendered in event log panel |

---

## Visualization Design

### Layout (Ink TUI)

```
┌─────────────────────────────────────────────────────────────────┐
│  reflex-coffee                                          v0.1.0  │
├────────────────────────────────┬────────────────────────────────┤
│                                │  Blackboard                    │
│  Workflow Graph                │  ─────────────────             │
│                                │  drink_type: espresso          │
│  ● GREET                      │  size: medium                  │
│  ● TAKE_ORDER                 │  milk_type: oat                │
│  ● CHOOSE_SIZE                │  extras: extra shot            │
│  ● CUSTOMIZE                  │  grind_status: done ← [child] │
│  ◉ PREP_ESPRESSO              │  tamp_status: done  ← [child] │
│    ├ GRIND ●                  │                                │
│    ├ TAMP  ●                  │                                │
│    ├ EXTRACT ◉ ← current     │                                │
│    ├ STEAM_MILK ○             ├────────────────────────────────┤
│    └ ESPRESSO_DONE ○          │  Stack                         │
│  ○ SERVE                      │  ─────────────────             │
│  ○ DONE                       │  [1] make-espresso → EXTRACT   │
│                                │  [0] coffee-order → PREP_ESP.  │
│                                │                                │
├────────────────────────────────┴────────────────────────────────┤
│  Events                                                         │
│  node:enter EXTRACT | edge:traverse TAMP→EXTRACT | bb:write ... │
├─────────────────────────────────────────────────────────────────┤
│  [Press ENTER to step]  [Press Q to quit]                       │
└─────────────────────────────────────────────────────────────────┘
```

**Legend:**
- `○` = unvisited node
- `●` = visited (completed)
- `◉` = current node (highlighted/colored)
- Indented nodes = active sub-workflow
- `← [child]` on blackboard entries = written by sub-workflow scope

### Panels

| Panel | Content | Updates on |
|-------|---------|------------|
| **Workflow Graph** | Node list with status indicators. Shows root + active sub-workflow inline. Grayed-out edges that failed guards. | Every step |
| **Blackboard** | Key-value pairs, newest at bottom. Scope annotation (root vs child). | Every `blackboard:write` event |
| **Stack** | Stack frames, depth-indexed. Shows workflow ID + current node. | Every `workflow:push` / `workflow:pop` |
| **Events** | Scrolling event log, most recent at bottom. Color-coded by event type. | Every event |
| **Input** | At suspend points: presents choices. Otherwise: "Press ENTER to step" or auto-step mode. | On suspend/resume |

### Interaction Modes

**Step mode (default):** Press ENTER to advance one engine step. See each node:enter, edge:traverse, blackboard:write individually.

**Auto mode:** Toggle with TAB. Engine steps automatically with a delay (~500ms) so you can watch it flow. Pauses at suspend points for user input.

**At suspend points:** The input panel shows numbered choices. User picks, the agent writes to blackboard and advances.

---

## Decision Agent

A `CoffeeAgent` that implements `DecisionAgent`:

- **At suspend nodes** (TAKE_ORDER, CHOOSE_SIZE, CUSTOMIZE): Returns `{ type: 'suspend' }`. The TUI prompts the user, writes the choice to blackboard, then calls `engine.step()` again. The agent reads the blackboard value and returns `advance` with the appropriate edge.
- **At auto-advance nodes** (GREET, sub-workflow steps): Reads the node spec, writes status values, picks the only outgoing edge.
- **At fan-out nodes** (after CUSTOMIZE): Reads `drink_type` from blackboard, the engine filters edges via guards, agent picks the single remaining valid edge.
- **At terminal nodes** (DONE, *_DONE): Returns `{ type: 'complete' }`.

The agent is simple — most of the logic is in the workflow guards and the user's choices at suspend points. The agent is essentially a pass-through that respects the graph structure.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | Node.js (ESM) | Matches Reflex |
| Language | TypeScript | Type safety, matches Reflex |
| TUI framework | Ink 6 + React 19 | React for terminal, component model maps perfectly, native ESM |
| Reflex | `@corpus-relica/reflex` (`file:../reflex`) | Local file dependency — simple, no symlink weirdness |
| Build | tsx (for dev) / tsc (for build) | Fast iteration |

### Project Structure

```
reflex-coffee/
├── package.json
├── tsconfig.json
├── PLAN.md                  (this file)
├── src/
│   ├── app.tsx              Ink app root, layout, state management
│   ├── main.ts              Entry point — create engine, render app
│   ├── workflows/
│   │   ├── coffee-order.ts  Root workflow definition
│   │   ├── make-espresso.ts Sub-workflow
│   │   ├── make-drip.ts     Sub-workflow
│   │   └── make-tea.ts      Sub-workflow
│   ├── agent.ts             CoffeeAgent (DecisionAgent implementation)
│   ├── components/
│   │   ├── WorkflowGraph.tsx Node list with status indicators
│   │   ├── Blackboard.tsx    Key-value display with scope annotations
│   │   ├── Stack.tsx         Stack frame display
│   │   ├── EventLog.tsx      Scrolling event log
│   │   └── Input.tsx         Choice selector at suspend points
│   └── types.ts              App-local types (UI state, etc.)
└── README.md
```

---

## Implementation Phases

### Phase 1: Scaffold + Workflows
- Project setup (package.json, tsconfig, ink dependencies)
- Define all 4 workflows as Reflex `Workflow` objects
- Register in a `createRegistry()`, validate they pass
- Simple console test: engine.run() with a deterministic agent, verify completion

### Phase 2: Interactive Agent + Engine Loop
- Implement `CoffeeAgent` with suspend/resume logic
- Wire up the engine event system to capture all events
- Build the step loop: step → check suspend → prompt → resume → repeat
- Test in plain console first (no TUI yet)

### Phase 3: TUI Shell
- Ink app skeleton with panel layout (boxes, borders)
- Static content first — just render the layout
- Wire engine state into React state (useState/useReducer)
- WorkflowGraph component: render nodes with status indicators
- Blackboard component: render key-value pairs

### Phase 4: Full Interactivity
- Stack component
- EventLog component
- Input component for suspend-point choices
- Step mode (ENTER to advance)
- Auto mode (TAB to toggle, timed steps)
- Polish: colors, alignment, edge cases

---

## Resolved Questions

1. **Dependency strategy:** `file:../reflex` in package.json. Simple, no symlink weirdness, rebuilds on install.

2. **Sub-workflow animation:** Auto-advance with ~300-500ms delay per step. You watch the espresso being made. Only root-level suspend points pause for user input. Step mode (ENTER) still applies to root workflow nodes.

3. **Ink version:** Ink 6 + React 19 (native ESM). [TypeScript + ESM starter available](https://github.com/thaitype/ink-cli-starter).
