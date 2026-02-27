import React from 'react';
import { Box, Text } from 'ink';
import type { StackFrame } from '@corpus-relica/reflex';

interface Props {
  stack: StackFrame[];
  currentWorkflowId: string | null;
  currentNodeId: string | null;
}

export function Stack({ stack, currentWorkflowId, currentNodeId }: Props) {
  // Display: current frame on top, then stack frames (most recent parent first)
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold underline>
        Stack
      </Text>
      <Text> </Text>
      {currentWorkflowId ? (
        <Box>
          <Text color="yellow">
            [{stack.length}] {currentWorkflowId} → {currentNodeId}
          </Text>
          <Text dimColor> ← active</Text>
        </Box>
      ) : (
        <Text dimColor>(no active workflow)</Text>
      )}
      {stack.map((frame, i) => (
        <Box key={i}>
          <Text color="gray">
            [{stack.length - 1 - i}] {frame.workflowId} → {frame.currentNodeId}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
