import type { Workflow } from '@corpus-relica/reflex';

export const makeTea: Workflow = {
  id: 'make-tea',
  entry: 'BOIL',
  nodes: {
    BOIL: {
      id: 'BOIL',
      description: 'Boil water',
      spec: {
        message: '🔥 Boiling water...',
        autoAdvance: true,
        writeKey: 'boil_status',
        writeValue: 'done',
        delay: 400,
      },
    },
    STEEP: {
      id: 'STEEP',
      description: 'Steep tea leaves',
      spec: {
        message: '🍵 Steeping tea leaves...',
        autoAdvance: true,
        writeKey: 'steep_status',
        writeValue: 'done',
        delay: 500,
      },
    },
    TEA_DONE: {
      id: 'TEA_DONE',
      description: 'Tea ready',
      spec: {
        message: '✅ Tea ready!',
        terminal: true,
        writeKey: 'tea_result',
      },
    },
  },
  edges: [
    { id: 'e-boil-steep', from: 'BOIL', to: 'STEEP', event: 'NEXT' },
    { id: 'e-steep-done', from: 'STEEP', to: 'TEA_DONE', event: 'NEXT' },
  ],
};
