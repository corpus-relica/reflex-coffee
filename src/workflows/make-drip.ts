import type { Workflow } from '@corpus-relica/reflex';

export const makeDrip: Workflow = {
  id: 'make-drip',
  entry: 'MEASURE',
  nodes: {
    MEASURE: {
      id: 'MEASURE',
      description: 'Measure coffee grounds',
      spec: {
        message: '⚖️  Measuring coffee grounds...',
        autoAdvance: true,
        writeKey: 'measure_status',
        writeValue: 'done',
        delay: 300,
      },
    },
    BREW: {
      id: 'BREW',
      description: 'Brew drip coffee',
      spec: {
        message: '☕ Brewing drip coffee...',
        autoAdvance: true,
        writeKey: 'brew_status',
        writeValue: 'done',
        delay: 600,
      },
    },
    DRIP_DONE: {
      id: 'DRIP_DONE',
      description: 'Drip coffee ready',
      spec: {
        message: '✅ Drip coffee ready!',
        terminal: true,
        writeKey: 'drip_result',
      },
    },
  },
  edges: [
    { id: 'e-measure-brew', from: 'MEASURE', to: 'BREW', event: 'NEXT' },
    { id: 'e-brew-done', from: 'BREW', to: 'DRIP_DONE', event: 'NEXT' },
  ],
};
