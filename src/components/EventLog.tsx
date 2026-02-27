import React from 'react';
import { Box, Text } from 'ink';
import type { EventLogEntry } from '../types.js';

interface Props {
  events: EventLogEntry[];
  maxVisible?: number;
}

const eventColors: Record<string, string> = {
  'node:enter': 'green',
  'node:exit': 'gray',
  'edge:traverse': 'blue',
  'workflow:push': 'magenta',
  'workflow:pop': 'magenta',
  'blackboard:write': 'cyan',
  'engine:complete': 'greenBright',
  'engine:suspend': 'yellow',
  'engine:error': 'red',
};

export function EventLog({ events, maxVisible = 8 }: Props) {
  const visible = events.slice(-maxVisible);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold underline>
        Events
      </Text>
      {visible.length === 0 ? (
        <Text dimColor>(no events yet)</Text>
      ) : (
        visible.map((event) => (
          <Box key={event.id}>
            <Text color={eventColors[event.type] ?? 'white'}>
              {event.type}
            </Text>
            <Text> </Text>
            <Text dimColor>{event.message}</Text>
          </Box>
        ))
      )}
    </Box>
  );
}
