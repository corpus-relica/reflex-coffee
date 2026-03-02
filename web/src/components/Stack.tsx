import type { StackFrame } from '@corpus-relica/reflex';

interface Props {
  stack: StackFrame[];
  currentWorkflowId: string | null;
  currentNodeId: string | null;
}

export function Stack({ stack, currentWorkflowId, currentNodeId }: Props) {
  // Build display: current context on top, then stack frames
  const frames: Array<{
    depth: number;
    workflowId: string;
    nodeId: string;
    active: boolean;
  }> = [];

  // Current execution context
  if (currentWorkflowId && currentNodeId) {
    frames.push({
      depth: stack.length,
      workflowId: currentWorkflowId,
      nodeId: currentNodeId,
      active: true,
    });
  }

  // Stack frames (most recent first)
  for (let i = stack.length - 1; i >= 0; i--) {
    const frame = stack[i];
    frames.push({
      depth: i,
      workflowId: frame.workflowId,
      nodeId: frame.currentNodeId,
      active: false,
    });
  }

  if (frames.length === 0) {
    return <div className="stack-empty">No stack frames</div>;
  }

  return (
    <div>
      {frames.map((frame) => (
        <div
          key={frame.depth}
          className={`stack-frame${frame.active ? ' active' : ''}`}
        >
          <span className="depth">[{frame.depth}]</span>
          <span className="workflow-id">{frame.workflowId}</span>
          <span className="arrow">&rarr;</span>
          <span className="node-id">{frame.nodeId}</span>
        </div>
      ))}
    </div>
  );
}
