import React from 'react';
import { Box, Text } from 'ink';
import type { BlackboardEntry } from '@corpus-relica/reflex';

interface Props {
  entries: BlackboardEntry[];
  currentStackDepth: number;
}

export function Blackboard({ entries, currentStackDepth }: Props) {
  // Deduplicate: show the latest value per key
  const latestByKey = new Map<string, BlackboardEntry>();
  for (const entry of entries) {
    latestByKey.set(entry.key, entry);
  }
  const displayEntries = Array.from(latestByKey.values());

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold underline>
        Blackboard
      </Text>
      <Text> </Text>
      {displayEntries.length === 0 ? (
        <Text dimColor>(empty)</Text>
      ) : (
        displayEntries.map((entry) => {
          const isChild = entry.source.stackDepth > 0;
          const scopeLabel = isChild ? ' [child]' : '';
          return (
            <Box key={entry.key}>
              <Text color="cyan">{entry.key}</Text>
              <Text>: </Text>
              <Text color="white">{String(entry.value)}</Text>
              {scopeLabel && (
                <Text dimColor color="magenta">
                  {' ← '}{scopeLabel.trim()}
                </Text>
              )}
            </Box>
          );
        })
      )}
    </Box>
  );
}
