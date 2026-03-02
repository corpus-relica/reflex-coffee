import type { NodeDisplayInfo } from '@shared/types.js';

interface Props {
  nodes: NodeDisplayInfo[];
}

export function WorkflowGraph({ nodes }: Props) {
  return (
    <div>
      {nodes.map((node, i) => {
        // Show connector line for sub-workflow nodes
        const isSubNode = node.depth > 0;
        const isLastSub =
          isSubNode && (i === nodes.length - 1 || nodes[i + 1]?.depth === 0);

        return (
          <div
            key={`${node.workflowId}:${node.id}`}
            className={`graph-node depth-${node.depth} status-${node.status}`}
          >
            {isSubNode && (
              <span className="graph-connector">{isLastSub ? '└' : '├'}</span>
            )}
            <span className="icon" />
            <span className="label">{node.id}</span>
            <span className="desc">{node.description}</span>
          </div>
        );
      })}
    </div>
  );
}
