import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useApp } from 'ink';
import type { ReflexEngine, EngineEvent, Node, Workflow, Edge, StackFrame, BlackboardEntry } from '@corpus-relica/reflex';
import { WorkflowGraph } from './components/WorkflowGraph.js';
import { Blackboard } from './components/Blackboard.js';
import { Stack } from './components/Stack.js';
import { EventLog } from './components/EventLog.js';
import { InputPanel } from './components/InputPanel.js';
import type { AppState, NodeDisplayInfo, EventLogEntry, CoffeeNodeSpec, SuspendChoice } from './types.js';
import { coffeeOrder } from './workflows/coffee-order.js';
import { makeEspresso } from './workflows/make-espresso.js';
import { makeDrip } from './workflows/make-drip.js';
import { makeTea } from './workflows/make-tea.js';
import { pendingChoice } from './agent.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All workflows keyed by id */
const allWorkflows: Record<string, Workflow> = {
  'coffee-order': coffeeOrder,
  'make-espresso': makeEspresso,
  'make-drip': makeDrip,
  'make-tea': makeTea,
};

/** Get ordered node ids for a workflow */
function getWorkflowNodeIds(workflowId: string): string[] {
  const wf = allWorkflows[workflowId];
  if (!wf) return [];
  // Topological order: walk from entry following edges
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

  // Always show root workflow
  const rootNodeIds = getWorkflowNodeIds('coffee-order');

  // Figure out active sub-workflow
  let activeSubWorkflowId: string | null = null;
  let activeSubAfterNode: string | null = null;

  if (currentWorkflowId && currentWorkflowId !== 'coffee-order') {
    activeSubWorkflowId = currentWorkflowId;
    // The parent's invoking node is on the stack
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
    // If we're in a sub-workflow, mark the invoking node as current
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

    // Insert sub-workflow nodes after the invoking node
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

interface AppProps {
  engine: ReflexEngine;
}

export function App({ engine }: AppProps) {
  const { exit } = useApp();
  const engineRef = useRef(engine);

  // Compute initial state from the already-initialized engine
  const initialNode = engine.currentNode();
  const initialWorkflow = engine.currentWorkflow();
  const initialVisited = new Set<string>();
  if (initialWorkflow && initialNode) {
    initialVisited.add(`${initialWorkflow.id}:${initialNode.id}`);
  }
  const initialNodeDisplayList = buildNodeDisplayList(
    initialWorkflow?.id ?? null,
    initialNode?.id ?? null,
    [],
    initialVisited,
  );

  const [state, setState] = useState<AppState>({
    currentNodeId: initialNode?.id ?? null,
    currentWorkflowId: initialWorkflow?.id ?? null,
    stack: [],
    blackboardEntries: [],
    validEdges: engine.validEdges(),
    nodeDisplayList: initialNodeDisplayList,
    visitedNodes: initialVisited,
    events: [],
    eventCounter: 0,
    mode: 'step',
    suspended: false,
    suspendChoices: null,
    suspendPrompt: null,
    completed: false,
    statusMessage: 'Press Enter to step',
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // Auto-step timer
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
    const node = eng.currentNode();
    const workflow = eng.currentWorkflow();
    const stackFrames = [...eng.stack()] as StackFrame[];
    const bb = eng.blackboard();

    setState((prev) => {
      const newVisited = new Set(prev.visitedNodes);
      // Mark current node as visited
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

  // Register engine event handlers
  useEffect(() => {
    const eng = engineRef.current;

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

  // The step function — advances the engine one step
  const doStep = useCallback(async () => {
    const eng = engineRef.current;
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
        // Check if this is a user-input suspension
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
            statusMessage: result.reason,
          }));
        }
        return;
      }

      // For advanced/invoked/popped — check if the new node is auto-advance
      // in auto mode, schedule next step
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

  // Handle user choice at suspend points
  const handleChoice = useCallback(
    async (value: string) => {
      const eng = engineRef.current;
      const node = eng.currentNode();
      const spec = node?.spec as CoffeeNodeSpec | undefined;

      if (!spec?.writeKey) return;

      // Set pending choice — agent reads and clears it on next step
      pendingChoice.value = value;
      pendingChoice.key = spec.writeKey;

      setState((prev) => ({
        ...prev,
        suspended: false,
        suspendChoices: null,
        suspendPrompt: null,
      }));

      // Step the engine — agent will see the pending choice and advance
      await doStep();
    },
    [doStep],
  );

  const handleStep = useCallback(() => {
    doStep();
  }, [doStep]);

  const handleToggleMode = useCallback(() => {
    setState((prev) => {
      const newMode = prev.mode === 'step' ? 'auto' : 'step';
      if (newMode === 'auto' && !prev.suspended && !prev.completed) {
        // Start auto-stepping
        setTimeout(() => doStep(), 300);
      }
      if (newMode === 'step' && autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      return { ...prev, mode: newMode };
    });
  }, [doStep]);

  const handleQuit = useCallback(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
    }
    exit();
  }, [exit]);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray">
      {/* Header */}
      <Box justifyContent="space-between" paddingX={1}>
        <Text bold color="yellow">
          ☕ reflex-coffee
        </Text>
        <Text dimColor>v0.1.0</Text>
      </Box>

      {/* Main panels */}
      <Box flexGrow={1}>
        {/* Left: Workflow Graph */}
        <Box
          flexDirection="column"
          width="50%"
          borderStyle="single"
          borderColor="gray"
        >
          <WorkflowGraph
            nodes={state.nodeDisplayList}
            currentWorkflowId={state.currentWorkflowId}
          />
        </Box>

        {/* Right: Blackboard + Stack */}
        <Box flexDirection="column" width="50%">
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="gray"
            flexGrow={1}
          >
            <Blackboard
              entries={state.blackboardEntries}
              currentStackDepth={state.stack.length}
            />
          </Box>
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="gray"
          >
            <Stack
              stack={state.stack}
              currentWorkflowId={state.currentWorkflowId}
              currentNodeId={state.currentNodeId}
            />
          </Box>
        </Box>
      </Box>

      {/* Events */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
      >
        <EventLog events={state.events} />
      </Box>

      {/* Input */}
      <Box
        borderStyle="single"
        borderColor="gray"
      >
        <InputPanel
          suspended={state.suspended}
          completed={state.completed}
          choices={state.suspendChoices}
          prompt={state.suspendPrompt}
          mode={state.mode}
          statusMessage={state.statusMessage}
          onChoice={handleChoice}
          onStep={handleStep}
          onToggleMode={handleToggleMode}
          onQuit={handleQuit}
        />
      </Box>
    </Box>
  );
}


