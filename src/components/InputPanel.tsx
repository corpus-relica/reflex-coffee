import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { SuspendChoice } from '../types.js';

interface Props {
  suspended: boolean;
  completed: boolean;
  choices: SuspendChoice[] | null;
  prompt: string | null;
  mode: 'step' | 'auto';
  statusMessage: string;
  onChoice: (value: string) => void;
  onStep: () => void;
  onToggleMode: () => void;
  onQuit: () => void;
}

export function InputPanel({
  suspended,
  completed,
  choices,
  prompt,
  mode,
  statusMessage,
  onChoice,
  onStep,
  onToggleMode,
  onQuit,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (input === 'q' || input === 'Q') {
      onQuit();
      return;
    }

    if (completed) return;

    if (suspended && choices && choices.length > 0) {
      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(choices.length - 1, prev + 1));
      } else if (key.return) {
        const choice = choices[selectedIndex];
        setSelectedIndex(0);
        onChoice(choice.value);
      }
      return;
    }

    if (key.tab) {
      onToggleMode();
    } else if (key.return && mode === 'step') {
      onStep();
    }
  });

  if (completed) {
    return (
      <Box paddingX={1}>
        <Text color="greenBright" bold>
          ✨ Order complete! Press Q to quit.
        </Text>
      </Box>
    );
  }

  if (suspended && choices && choices.length > 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="yellow">
          {prompt ?? 'Choose:'}
        </Text>
        {choices.map((choice, i) => (
          <Box key={choice.value}>
            <Text color={i === selectedIndex ? 'yellow' : 'white'}>
              {i === selectedIndex ? '❯ ' : '  '}
              {choice.label}
            </Text>
          </Box>
        ))}
        <Text dimColor>↑↓ navigate · Enter to select</Text>
      </Box>
    );
  }

  return (
    <Box paddingX={1} gap={2}>
      <Text dimColor>
        {mode === 'step' ? '[Enter] Step' : '🔄 Auto-stepping...'}
        {'  '}[Tab] Toggle mode ({mode}){'  '}[Q] Quit
      </Text>
      {statusMessage && (
        <Text color="gray">{statusMessage}</Text>
      )}
    </Box>
  );
}
