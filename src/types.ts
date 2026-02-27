import type { Node, StackFrame, BlackboardEntry, Workflow, Edge } from '@corpus-relica/reflex';

// ---------------------------------------------------------------------------
// Node status for the graph visualization
// ---------------------------------------------------------------------------

export type NodeStatus = 'unvisited' | 'visited' | 'current';

export interface NodeDisplayInfo {
  id: string;
  description: string;
  status: NodeStatus;
  depth: number; // 0 = root workflow, 1 = sub-workflow
  workflowId: string;
}

// ---------------------------------------------------------------------------
// Engine event log entries
// ---------------------------------------------------------------------------

export interface EventLogEntry {
  id: number;
  type: string;
  message: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// App state — the unified state that drives all TUI panels
// ---------------------------------------------------------------------------

export interface AppState {
  // Engine state snapshots
  currentNodeId: string | null;
  currentWorkflowId: string | null;
  stack: StackFrame[];
  blackboardEntries: BlackboardEntry[];
  validEdges: Edge[];

  // Node tracking for the graph panel
  nodeDisplayList: NodeDisplayInfo[];
  visitedNodes: Set<string>; // "workflowId:nodeId" keys

  // Event log
  events: EventLogEntry[];
  eventCounter: number;

  // Interaction state
  mode: 'step' | 'auto';
  suspended: boolean;
  suspendChoices: SuspendChoice[] | null;
  suspendPrompt: string | null;
  completed: boolean;
  statusMessage: string;
}

// ---------------------------------------------------------------------------
// Suspend-point choices
// ---------------------------------------------------------------------------

export interface SuspendChoice {
  label: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Workflow node specs (domain-specific, but typed here for convenience)
// ---------------------------------------------------------------------------

export interface CoffeeNodeSpec {
  message?: string;
  prompt?: string;
  suspend?: boolean;
  autoAdvance?: boolean;
  terminal?: boolean;
  choices?: SuspendChoice[];
  writeKey?: string;
  writeValue?: string;
  delay?: number;
}
