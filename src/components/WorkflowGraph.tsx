import React from 'react';
import { Box, Text } from 'ink';
import type { NodeDisplayInfo } from '../types.js';

interface Props {
  nodes: NodeDisplayInfo[];
  currentWorkflowId: string | null;
}

function statusIcon(status: NodeDisplayInfo['status']): string {
  switch (status) {
    case 'current':
      return '◉';
    case 'visited':
      return '●';
    case 'unvisited':
      return '○';
  }
}

function statusColor(status: NodeDisplayInfo['status']): string {
  switch (status) {
    case 'current':
      return 'yellow';
    case 'visited':
      return 'green';
    case 'unvisited':
      return 'gray';
  }
}

export function WorkflowGraph({ nodes, currentWorkflowId }: Props) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold underline>
        Workflow Graph
      </Text>
      <Text> </Text>
      {nodes.map((node) => {
        const icon = statusIcon(node.status);
        const color = statusColor(node.status);
        const indent = node.depth > 0 ? '  ├ ' : '';
        const currentMarker = node.status === 'current' ? ' ← current' : '';

        return (
          <Box key={`${node.workflowId}:${node.id}`}>
            <Text color={color}>
              {indent}
              {icon} {node.id}
            </Text>
            {currentMarker && (
              <Text color="yellow" dimColor>
                {currentMarker}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
