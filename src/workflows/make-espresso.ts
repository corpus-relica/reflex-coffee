import type { Workflow } from '@corpus-relica/reflex';

export const makeEspresso: Workflow = {
  id: 'make-espresso',
  entry: 'GRIND',
  nodes: {
    GRIND: {
      id: 'GRIND',
      description: 'Grind the espresso beans',
      spec: {
        message: '⚙️  Grinding espresso beans...',
        autoAdvance: true,
        writeKey: 'grind_status',
        writeValue: 'done',
        delay: 400,
      },
    },
    TAMP: {
      id: 'TAMP',
      description: 'Tamp the grounds',
      spec: {
        message: '🔨 Tamping grounds firmly...',
        autoAdvance: true,
        writeKey: 'tamp_status',
        writeValue: 'done',
        delay: 300,
      },
    },
    EXTRACT: {
      id: 'EXTRACT',
      description: 'Extract the espresso shot',
      spec: {
        message: '💧 Extracting espresso shot...',
        autoAdvance: true,
        writeKey: 'extract_status',
        writeValue: 'done',
        delay: 500,
      },
    },
    STEAM_MILK: {
      id: 'STEAM_MILK',
      description: 'Steam milk if requested',
      spec: {
        message: '🥛 Steaming milk...',
        autoAdvance: true,
        writeKey: 'steam_status',
        writeValue: 'done',
        delay: 400,
      },
    },
    ESPRESSO_DONE: {
      id: 'ESPRESSO_DONE',
      description: 'Espresso preparation complete',
      spec: {
        message: '✅ Espresso ready!',
        terminal: true,
        writeKey: 'espresso_result',
      },
    },
  },
  edges: [
    { id: 'e-grind-tamp', from: 'GRIND', to: 'TAMP', event: 'NEXT' },
    { id: 'e-tamp-extract', from: 'TAMP', to: 'EXTRACT', event: 'NEXT' },
    { id: 'e-extract-steam', from: 'EXTRACT', to: 'STEAM_MILK', event: 'NEXT' },
    { id: 'e-steam-done', from: 'STEAM_MILK', to: 'ESPRESSO_DONE', event: 'NEXT' },
  ],
};
