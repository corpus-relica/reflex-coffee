import { useState, useEffect, useCallback, useRef } from 'react';
import {
  createRegistry,
  createEngine,
  type ReflexEngine,
  type StackFrame,
  type Workflow,
} from '@corpus-relica/reflex';
import { coffeeOrder } from '@shared/workflows/coffee-order.js';
import { makeEspresso } from '@shared/workflows/make-espresso.js';
import { makeDrip } from '@shared/workflows/make-drip.js';
import { makeTea } from '@shared/workflows/make-tea.js';
import { CoffeeAgent, pendingChoice } from '@shared/agent.js';
import type { AppState, NodeDisplayInfo, CoffeeNodeSpec, SuspendChoice } from '@shared/types.js';
import { WorkflowGraph } from './components/WorkflowGraph';
import { Blackboard } from './components/Blackboard';
import { Stack } from './components/Stack';
import { EventLog } from './components/EventLog';

// ---------------------------------------------------------------------------
// Helpers (unchanged — needed for debug drawer)
// ---------------------------------------------------------------------------

const allWorkflows: Record<string, Workflow> = {
  'coffee-order': coffeeOrder,
  'make-espresso': makeEspresso,
  'make-drip': makeDrip,
  'make-tea': makeTea,
};

function getWorkflowNodeIds(workflowId: string): string[] {
  const wf = allWorkflows[workflowId];
  if (!wf) return [];
  const ordered: string[] = [];
  const visited = new Set<string>();
  const queue = [wf.entry];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    ordered.push(nodeId);
    const outEdges = wf.edges.filter((e) => e.from === nodeId);
    for (const edge of outEdges) {
      if (!visited.has(edge.to)) queue.push(edge.to);
    }
  }
  return ordered;
}

function buildNodeDisplayList(
  currentWorkflowId: string | null,
  currentNodeId: string | null,
  stack: StackFrame[],
  visitedNodes: Set<string>,
): NodeDisplayInfo[] {
  const list: NodeDisplayInfo[] = [];
  const rootNodeIds = getWorkflowNodeIds('coffee-order');
  let activeSubWorkflowId: string | null = null;
  let activeSubAfterNode: string | null = null;

  if (currentWorkflowId && currentWorkflowId !== 'coffee-order') {
    activeSubWorkflowId = currentWorkflowId;
    if (stack.length > 0) activeSubAfterNode = stack[0].currentNodeId;
  }

  for (const nodeId of rootNodeIds) {
    const key = `coffee-order:${nodeId}`;
    let status: NodeDisplayInfo['status'] = 'unvisited';
    if (currentWorkflowId === 'coffee-order' && currentNodeId === nodeId) status = 'current';
    else if (visitedNodes.has(key)) status = 'visited';
    if (activeSubAfterNode === nodeId && activeSubWorkflowId) status = 'current';

    list.push({
      id: nodeId,
      description: allWorkflows['coffee-order'].nodes[nodeId]?.description ?? '',
      status, depth: 0, workflowId: 'coffee-order',
    });

    if (activeSubAfterNode === nodeId && activeSubWorkflowId) {
      for (const subNodeId of getWorkflowNodeIds(activeSubWorkflowId)) {
        const subKey = `${activeSubWorkflowId}:${subNodeId}`;
        let subStatus: NodeDisplayInfo['status'] = 'unvisited';
        if (currentNodeId === subNodeId && currentWorkflowId === activeSubWorkflowId) subStatus = 'current';
        else if (visitedNodes.has(subKey)) subStatus = 'visited';
        list.push({
          id: subNodeId,
          description: allWorkflows[activeSubWorkflowId]!.nodes[subNodeId]?.description ?? '',
          status: subStatus, depth: 1, workflowId: activeSubWorkflowId,
        });
      }
    }
  }
  return list;
}

// ---------------------------------------------------------------------------
// Engine factory
// ---------------------------------------------------------------------------

async function createCoffeeEngine(): Promise<ReflexEngine> {
  const registry = createRegistry();
  registry.register(makeEspresso);
  registry.register(makeDrip);
  registry.register(makeTea);
  registry.register(coffeeOrder);
  const agent = new CoffeeAgent();
  const engine = createEngine(registry, agent);
  await engine.init('coffee-order');
  return engine;
}

// ---------------------------------------------------------------------------
// Drink descriptions for the "customer" UI
// ---------------------------------------------------------------------------

const DRINK_EMOJI: Record<string, string> = {
  espresso: '\u2615',
  drip: '\u2615',
  tea: '\uD83C\uDF75',
};

function buildOrderSummary(entries: Array<{ key: string; value: unknown }>): string | null {
  const map = Object.fromEntries(entries.map((e) => [e.key, e.value]));
  if (!map.drink_type) return null;
  const parts = [map.size, map.drink_type].filter(Boolean);
  if (map.milk_type && map.milk_type !== 'none') parts.push(`with ${map.milk_type} milk`);
  else if (map.milk_type === 'none') parts.push('black');
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App() {
  const engineRef = useRef<ReflexEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [preparingMessage, setPreparingMessage] = useState<string | null>(null);

  const [state, setState] = useState<AppState>({
    currentNodeId: null, currentWorkflowId: null,
    stack: [], blackboardEntries: [], validEdges: [],
    nodeDisplayList: [], visitedNodes: new Set<string>(),
    events: [], eventCounter: 0,
    mode: 'step', suspended: false, suspendChoices: null, suspendPrompt: null,
    completed: false, statusMessage: 'Initializing...',
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addEvent = useCallback((type: string, message: string) => {
    setState((prev) => ({
      ...prev,
      eventCounter: prev.eventCounter + 1,
      events: [...prev.events, { id: prev.eventCounter, type, message, timestamp: Date.now() }],
    }));
  }, []);

  const syncEngineState = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const node = eng.currentNode();
    const workflow = eng.currentWorkflow();
    const stackFrames = [...eng.stack()] as StackFrame[];
    const bb = eng.blackboard();

    setState((prev) => {
      const newVisited = new Set(prev.visitedNodes);
      if (workflow && node) newVisited.add(`${workflow.id}:${node.id}`);
      return {
        ...prev,
        currentNodeId: node?.id ?? null,
        currentWorkflowId: workflow?.id ?? null,
        stack: stackFrames,
        blackboardEntries: bb.entries(),
        validEdges: eng.validEdges(),
        nodeDisplayList: buildNodeDisplayList(workflow?.id ?? null, node?.id ?? null, stackFrames, newVisited),
        visitedNodes: newVisited,
      };
    });
  }, []);

  const doStep = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng) return;
    const currentState = stateRef.current;
    if (currentState.completed) return;

    try {
      const result = await eng.step();
      syncEngineState();

      // Update preparing message from node spec
      const node = eng.currentNode();
      const spec = node?.spec as CoffeeNodeSpec | undefined;
      if (spec?.message && !spec?.suspend) {
        setPreparingMessage(spec.message);
      }

      if (result.status === 'completed') {
        setPreparingMessage(null);
        setState((prev) => ({
          ...prev, completed: true, suspended: false,
          suspendChoices: null, suspendPrompt: null, statusMessage: 'Order complete!',
        }));
        return;
      }

      if (result.status === 'suspended') {
        setPreparingMessage(null);
        if (spec?.suspend && spec?.choices) {
          setState((prev) => ({
            ...prev, suspended: true,
            suspendChoices: spec!.choices as SuspendChoice[],
            suspendPrompt: spec!.prompt ?? 'Choose:',
            statusMessage: '',
          }));
        } else {
          setState((prev) => ({
            ...prev, suspended: true, suspendChoices: null, suspendPrompt: null,
            statusMessage: result.reason ?? 'Suspended',
          }));
        }
        return;
      }

      if (currentState.mode === 'auto') {
        const delay = spec?.delay ?? 300;
        autoTimerRef.current = setTimeout(() => doStep(), delay);
      }

      setState((prev) => ({
        ...prev, suspended: false, suspendChoices: null, suspendPrompt: null, statusMessage: '',
      }));
    } catch (err) {
      setState((prev) => ({ ...prev, statusMessage: `Error: ${err}` }));
    }
  }, [syncEngineState]);

  const registerEvents = useCallback((eng: ReflexEngine) => {
    eng.on('node:enter', (p: any) => addEvent('node:enter', `${p.node.id} (${p.workflow.id})`));
    eng.on('node:exit', (p: any) => addEvent('node:exit', `${p.node.id}`));
    eng.on('edge:traverse', (p: any) => addEvent('edge:traverse', `${p.edge.from} \u2192 ${p.edge.to}`));
    eng.on('workflow:push', (p: any) => addEvent('workflow:push', `\u2192 ${p.workflow.id}`));
    eng.on('workflow:pop', (p: any) => addEvent('workflow:pop', `\u2190 ${p.workflow.id}`));
    eng.on('blackboard:write', (p: any) => {
      addEvent('blackboard:write', p.entries.map((e: any) => `${e.key}=${e.value}`).join(', '));
    });
    eng.on('engine:suspend', (p: any) => addEvent('engine:suspend', p.reason));
    eng.on('engine:complete', () => addEvent('engine:complete', 'Session finished'));
    eng.on('engine:error', (p: any) => addEvent('engine:error', String(p.error)));
  }, [addEvent]);

  // Auto-advance until hitting a suspend or complete
  const advanceUntilSuspend = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng) return;
    const step = async () => {
      const s = stateRef.current;
      if (s.completed || s.suspended) return;
      await doStep();
      const next = stateRef.current;
      if (!next.completed && !next.suspended) {
        const node = eng.currentNode();
        const spec = node?.spec as CoffeeNodeSpec | undefined;
        autoTimerRef.current = setTimeout(step, spec?.delay ?? 150);
      }
    };
    await step();
  }, [doStep]);

  const handleChoice = useCallback(async (value: string) => {
    const eng = engineRef.current;
    if (!eng) return;
    const node = eng.currentNode();
    const spec = node?.spec as CoffeeNodeSpec | undefined;
    if (!spec?.writeKey) return;
    pendingChoice.value = value;
    pendingChoice.key = spec.writeKey;
    setState((prev) => ({ ...prev, suspended: false, suspendChoices: null, suspendPrompt: null }));
    await doStep();
    setTimeout(() => advanceUntilSuspend(), 150);
  }, [doStep, advanceUntilSuspend]);

  const handleReset = useCallback(async () => {
    if (autoTimerRef.current) { clearTimeout(autoTimerRef.current); autoTimerRef.current = null; }
    pendingChoice.key = null;
    pendingChoice.value = null;
    setPreparingMessage(null);
    const engine = await createCoffeeEngine();
    engineRef.current = engine;
    registerEvents(engine);
    const node = engine.currentNode();
    const workflow = engine.currentWorkflow();
    const initialVisited = new Set<string>();
    if (workflow && node) initialVisited.add(`${workflow.id}:${node.id}`);
    setState({
      currentNodeId: node?.id ?? null, currentWorkflowId: workflow?.id ?? null,
      stack: [], blackboardEntries: [], validEdges: engine.validEdges(),
      nodeDisplayList: buildNodeDisplayList(workflow?.id ?? null, node?.id ?? null, [], initialVisited),
      visitedNodes: initialVisited, events: [], eventCounter: 0,
      mode: 'step', suspended: false, suspendChoices: null, suspendPrompt: null,
      completed: false, statusMessage: '',
    });
    setTimeout(() => advanceUntilSuspend(), 100);
  }, [advanceUntilSuspend, registerEvents]);

  // Initialize
  useEffect(() => {
    let cancelled = false;
    createCoffeeEngine().then(async (engine) => {
      if (cancelled) return;
      engineRef.current = engine;
      registerEvents(engine);
      const node = engine.currentNode();
      const workflow = engine.currentWorkflow();
      const initialVisited = new Set<string>();
      if (workflow && node) initialVisited.add(`${workflow.id}:${node.id}`);
      setState((prev) => ({
        ...prev,
        currentNodeId: node?.id ?? null, currentWorkflowId: workflow?.id ?? null,
        validEdges: engine.validEdges(),
        nodeDisplayList: buildNodeDisplayList(workflow?.id ?? null, node?.id ?? null, [], initialVisited),
        visitedNodes: initialVisited, statusMessage: '',
      }));
      setReady(true);
      // Auto-advance to the first suspend point
      setTimeout(() => advanceUntilSuspend(), 50);
    });
    return () => { cancelled = true; };
  }, [registerEvents, advanceUntilSuspend]);

  // Derived state for the customer UI
  const orderSummary = buildOrderSummary(state.blackboardEntries as any[]);
  const drinkType = state.blackboardEntries.find((e: any) => e.key === 'drink_type')?.value as string | undefined;
  const emoji = drinkType ? (DRINK_EMOJI[drinkType] ?? '\u2615') : '\u2615';

  if (!ready) {
    return (
      <div className="coffee-app">
        <div className="coffee-loading">Starting up...</div>
      </div>
    );
  }

  return (
    <div className="coffee-app">
      {/* ── Customer UI ──────────────────────────────────── */}
      <div className="coffee-main">
        <div className="coffee-header">
          <span className="coffee-logo">{emoji}</span>
          <h1>Reflex Coffee</h1>
        </div>

        <div className="coffee-body">
          {state.completed ? (
            <div className="coffee-complete">
              <div className="coffee-complete-icon">&#x2728;</div>
              <h2>Order Ready!</h2>
              {orderSummary && <p className="coffee-order-summary">{orderSummary}</p>}
              <p className="coffee-thankyou">Thank you for visiting Reflex Coffee!</p>
              <button className="coffee-btn" onClick={handleReset}>Order Again</button>
            </div>
          ) : state.suspended && state.suspendChoices ? (
            <div className="coffee-prompt">
              <h2>{state.suspendPrompt}</h2>
              {orderSummary && <p className="coffee-current-order">{orderSummary}</p>}
              <div className="coffee-choices">
                {state.suspendChoices.map((choice) => (
                  <button
                    key={choice.value}
                    className="coffee-choice"
                    onClick={() => handleChoice(choice.value)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </div>
          ) : preparingMessage ? (
            <div className="coffee-preparing">
              <div className="coffee-spinner" />
              <p>{preparingMessage}</p>
              {orderSummary && <p className="coffee-current-order">{orderSummary}</p>}
            </div>
          ) : (
            <div className="coffee-preparing">
              <div className="coffee-spinner" />
              <p>Working...</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Debug drawer toggle ──────────────────────────── */}
      <button
        className={`debug-toggle ${debugOpen ? 'open' : ''}`}
        onClick={() => setDebugOpen((v) => !v)}
        title="Toggle debug panel"
      >
        <span className="debug-toggle-icon">{debugOpen ? '\u25BC' : '\u25B2'}</span>
        <span>Debug</span>
      </button>

      {/* ── Debug drawer ─────────────────────────────────── */}
      <div className={`debug-drawer ${debugOpen ? 'open' : ''}`}>
        <div className="debug-panels">
          <div className="panel">
            <div className="panel-header"><h2>Workflow Graph</h2></div>
            <div className="panel-body">
              <WorkflowGraph nodes={state.nodeDisplayList} />
            </div>
          </div>
          <div className="panel">
            <div className="panel-header"><h2>Blackboard</h2></div>
            <div className="panel-body">
              <Blackboard entries={state.blackboardEntries} stackDepth={state.stack.length} />
            </div>
          </div>
          <div className="panel">
            <div className="panel-header"><h2>Stack</h2></div>
            <div className="panel-body">
              <Stack stack={state.stack} currentWorkflowId={state.currentWorkflowId} currentNodeId={state.currentNodeId} />
            </div>
          </div>
          <div className="panel">
            <div className="panel-header"><h2>Events</h2></div>
            <div className="panel-body">
              <EventLog events={state.events} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
