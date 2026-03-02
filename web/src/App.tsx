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
import { Controls } from './components/Controls';

// ---------------------------------------------------------------------------
// Helpers
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
      if (!visited.has(edge.to)) {
        queue.push(edge.to);
      }
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
    if (stack.length > 0) {
      activeSubAfterNode = stack[0].currentNodeId;
    }
  }

  for (const nodeId of rootNodeIds) {
    const key = `coffee-order:${nodeId}`;
    let status: NodeDisplayInfo['status'] = 'unvisited';
    if (currentWorkflowId === 'coffee-order' && currentNodeId === nodeId) {
      status = 'current';
    } else if (visitedNodes.has(key)) {
      status = 'visited';
    }
    if (activeSubAfterNode === nodeId && activeSubWorkflowId) {
      status = 'current';
    }

    list.push({
      id: nodeId,
      description: allWorkflows['coffee-order'].nodes[nodeId]?.description ?? '',
      status,
      depth: 0,
      workflowId: 'coffee-order',
    });

    if (activeSubAfterNode === nodeId && activeSubWorkflowId) {
      const subNodeIds = getWorkflowNodeIds(activeSubWorkflowId);
      for (const subNodeId of subNodeIds) {
        const subKey = `${activeSubWorkflowId}:${subNodeId}`;
        let subStatus: NodeDisplayInfo['status'] = 'unvisited';
        if (currentNodeId === subNodeId && currentWorkflowId === activeSubWorkflowId) {
          subStatus = 'current';
        } else if (visitedNodes.has(subKey)) {
          subStatus = 'visited';
        }
        list.push({
          id: subNodeId,
          description: allWorkflows[activeSubWorkflowId]!.nodes[subNodeId]?.description ?? '',
          status: subStatus,
          depth: 1,
          workflowId: activeSubWorkflowId,
        });
      }
    }
  }

  return list;
}

// ---------------------------------------------------------------------------
// App
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

export function App() {
  const engineRef = useRef<ReflexEngine | null>(null);
  const [ready, setReady] = useState(false);

  const [state, setState] = useState<AppState>({
    currentNodeId: null,
    currentWorkflowId: null,
    stack: [],
    blackboardEntries: [],
    validEdges: [],
    nodeDisplayList: [],
    visitedNodes: new Set<string>(),
    events: [],
    eventCounter: 0,
    mode: 'step',
    suspended: false,
    suspendChoices: null,
    suspendPrompt: null,
    completed: false,
    statusMessage: 'Initializing...',
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addEvent = useCallback((type: string, message: string) => {
    setState((prev) => ({
      ...prev,
      eventCounter: prev.eventCounter + 1,
      events: [
        ...prev.events,
        { id: prev.eventCounter, type, message, timestamp: Date.now() },
      ],
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
      if (workflow && node) {
        newVisited.add(`${workflow.id}:${node.id}`);
      }
      const nodeDisplayList = buildNodeDisplayList(
        workflow?.id ?? null,
        node?.id ?? null,
        stackFrames,
        newVisited,
      );
      return {
        ...prev,
        currentNodeId: node?.id ?? null,
        currentWorkflowId: workflow?.id ?? null,
        stack: stackFrames,
        blackboardEntries: bb.entries(),
        validEdges: eng.validEdges(),
        nodeDisplayList,
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

      if (result.status === 'completed') {
        setState((prev) => ({
          ...prev,
          completed: true,
          suspended: false,
          suspendChoices: null,
          suspendPrompt: null,
          statusMessage: 'Order complete!',
        }));
        return;
      }

      if (result.status === 'suspended') {
        const node = eng.currentNode();
        const spec = node?.spec as CoffeeNodeSpec | undefined;
        if (spec?.suspend && spec?.choices) {
          setState((prev) => ({
            ...prev,
            suspended: true,
            suspendChoices: spec!.choices as SuspendChoice[],
            suspendPrompt: spec!.prompt ?? 'Choose:',
            statusMessage: '',
          }));
        } else {
          setState((prev) => ({
            ...prev,
            suspended: true,
            suspendChoices: null,
            suspendPrompt: null,
            statusMessage: result.reason ?? 'Suspended',
          }));
        }
        return;
      }

      // Auto-advance in auto mode
      if (currentState.mode === 'auto') {
        const node = eng.currentNode();
        const spec = node?.spec as CoffeeNodeSpec | undefined;
        const delay = spec?.delay ?? 300;
        autoTimerRef.current = setTimeout(() => doStep(), delay);
      }

      setState((prev) => ({
        ...prev,
        suspended: false,
        suspendChoices: null,
        suspendPrompt: null,
        statusMessage: '',
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        statusMessage: `Error: ${err}`,
      }));
    }
  }, [syncEngineState]);

  const handleChoice = useCallback(
    async (value: string) => {
      const eng = engineRef.current;
      if (!eng) return;
      const node = eng.currentNode();
      const spec = node?.spec as CoffeeNodeSpec | undefined;
      if (!spec?.writeKey) return;

      pendingChoice.value = value;
      pendingChoice.key = spec.writeKey;

      setState((prev) => ({
        ...prev,
        suspended: false,
        suspendChoices: null,
        suspendPrompt: null,
      }));

      await doStep();
    },
    [doStep],
  );

  const handleToggleMode = useCallback(() => {
    setState((prev) => {
      const newMode = prev.mode === 'step' ? 'auto' : 'step';
      if (newMode === 'auto' && !prev.suspended && !prev.completed) {
        setTimeout(() => doStep(), 300);
      }
      if (newMode === 'step' && autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      return { ...prev, mode: newMode };
    });
  }, [doStep]);

  const handleReset = useCallback(async () => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    pendingChoice.key = null;
    pendingChoice.value = null;

    const engine = await createCoffeeEngine();
    engineRef.current = engine;

    const node = engine.currentNode();
    const workflow = engine.currentWorkflow();
    const initialVisited = new Set<string>();
    if (workflow && node) {
      initialVisited.add(`${workflow.id}:${node.id}`);
    }

    // Re-register events
    registerEvents(engine);

    setState({
      currentNodeId: node?.id ?? null,
      currentWorkflowId: workflow?.id ?? null,
      stack: [],
      blackboardEntries: [],
      validEdges: engine.validEdges(),
      nodeDisplayList: buildNodeDisplayList(
        workflow?.id ?? null,
        node?.id ?? null,
        [],
        initialVisited,
      ),
      visitedNodes: initialVisited,
      events: [],
      eventCounter: 0,
      mode: 'step',
      suspended: false,
      suspendChoices: null,
      suspendPrompt: null,
      completed: false,
      statusMessage: 'Press Step to begin',
    });
  }, []);

  const registerEvents = useCallback((eng: ReflexEngine) => {
    eng.on('node:enter', (payload: any) => {
      addEvent('node:enter', `${payload.node.id} (${payload.workflow.id})`);
    });
    eng.on('node:exit', (payload: any) => {
      addEvent('node:exit', `${payload.node.id}`);
    });
    eng.on('edge:traverse', (payload: any) => {
      addEvent('edge:traverse', `${payload.edge.from} → ${payload.edge.to}`);
    });
    eng.on('workflow:push', (payload: any) => {
      addEvent('workflow:push', `→ ${payload.workflow.id}`);
    });
    eng.on('workflow:pop', (payload: any) => {
      addEvent('workflow:pop', `← ${payload.workflow.id}`);
    });
    eng.on('blackboard:write', (payload: any) => {
      const keys = payload.entries.map((e: any) => `${e.key}=${e.value}`).join(', ');
      addEvent('blackboard:write', keys);
    });
    eng.on('engine:suspend', (payload: any) => {
      addEvent('engine:suspend', payload.reason);
    });
    eng.on('engine:complete', () => {
      addEvent('engine:complete', 'Session finished');
    });
    eng.on('engine:error', (payload: any) => {
      addEvent('engine:error', String(payload.error));
    });
  }, [addEvent]);

  // Initialize engine on mount
  useEffect(() => {
    let cancelled = false;
    createCoffeeEngine().then((engine) => {
      if (cancelled) return;
      engineRef.current = engine;
      registerEvents(engine);

      const node = engine.currentNode();
      const workflow = engine.currentWorkflow();
      const initialVisited = new Set<string>();
      if (workflow && node) {
        initialVisited.add(`${workflow.id}:${node.id}`);
      }

      setState((prev) => ({
        ...prev,
        currentNodeId: node?.id ?? null,
        currentWorkflowId: workflow?.id ?? null,
        validEdges: engine.validEdges(),
        nodeDisplayList: buildNodeDisplayList(
          workflow?.id ?? null,
          node?.id ?? null,
          [],
          initialVisited,
        ),
        visitedNodes: initialVisited,
        statusMessage: 'Press Step to begin',
      }));
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [registerEvents]);

  if (!ready) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>Initializing engine...</span>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <h1>reflex-coffee<span>v0.1.0</span></h1>
      </div>

      <div className="main-panels">
        <div className="panel">
          <div className="panel-header">
            <h2>Workflow Graph</h2>
          </div>
          <div className="panel-body">
            <WorkflowGraph nodes={state.nodeDisplayList} />
          </div>
        </div>

        <div className="right-panels">
          <div className="panel">
            <div className="panel-header">
              <h2>Blackboard</h2>
            </div>
            <div className="panel-body">
              <Blackboard entries={state.blackboardEntries} stackDepth={state.stack.length} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Stack</h2>
            </div>
            <div className="panel-body">
              <Stack
                stack={state.stack}
                currentWorkflowId={state.currentWorkflowId}
                currentNodeId={state.currentNodeId}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="panel events-panel">
        <div className="panel-header">
          <h2>Events</h2>
        </div>
        <div className="panel-body">
          <EventLog events={state.events} />
        </div>
      </div>

      <Controls
        mode={state.mode}
        suspended={state.suspended}
        completed={state.completed}
        choices={state.suspendChoices}
        prompt={state.suspendPrompt}
        statusMessage={state.statusMessage}
        onStep={doStep}
        onChoice={handleChoice}
        onToggleMode={handleToggleMode}
        onReset={handleReset}
      />
    </div>
  );
}
