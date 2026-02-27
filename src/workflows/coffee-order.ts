import type { Workflow } from '@corpus-relica/reflex';

export const coffeeOrder: Workflow = {
  id: 'coffee-order',
  entry: 'GREET',
  nodes: {
    GREET: {
      id: 'GREET',
      description: 'Welcome the customer',
      spec: {
        message: '☕ Welcome to Reflex Coffee! What can I get you today?',
        autoAdvance: true,
      },
    },
    TAKE_ORDER: {
      id: 'TAKE_ORDER',
      description: 'Ask what drink the customer wants',
      spec: {
        prompt: 'What drink would you like?',
        suspend: true,
        choices: [
          { label: 'Espresso', value: 'espresso' },
          { label: 'Drip Coffee', value: 'drip' },
          { label: 'Tea', value: 'tea' },
        ],
        writeKey: 'drink_type',
      },
    },
    CHOOSE_SIZE: {
      id: 'CHOOSE_SIZE',
      description: 'Ask what size',
      spec: {
        prompt: 'What size?',
        suspend: true,
        choices: [
          { label: 'Small (8oz)', value: 'small' },
          { label: 'Medium (12oz)', value: 'medium' },
          { label: 'Large (16oz)', value: 'large' },
        ],
        writeKey: 'size',
      },
    },
    CUSTOMIZE: {
      id: 'CUSTOMIZE',
      description: 'Customization options',
      spec: {
        prompt: 'Any customizations?',
        suspend: true,
        choices: [
          { label: 'Oat milk', value: 'oat' },
          { label: 'Whole milk', value: 'whole' },
          { label: 'Black (no milk)', value: 'none' },
        ],
        writeKey: 'milk_type',
      },
    },
    PREP_ESPRESSO: {
      id: 'PREP_ESPRESSO',
      description: 'Prepare espresso drink',
      spec: { message: 'Starting espresso preparation...' },
      invokes: {
        workflowId: 'make-espresso',
        returnMap: [{ parentKey: 'drink_result', childKey: 'espresso_result' }],
      },
    },
    PREP_DRIP: {
      id: 'PREP_DRIP',
      description: 'Prepare drip coffee',
      spec: { message: 'Starting drip coffee preparation...' },
      invokes: {
        workflowId: 'make-drip',
        returnMap: [{ parentKey: 'drink_result', childKey: 'drip_result' }],
      },
    },
    PREP_TEA: {
      id: 'PREP_TEA',
      description: 'Prepare tea',
      spec: { message: 'Starting tea preparation...' },
      invokes: {
        workflowId: 'make-tea',
        returnMap: [{ parentKey: 'drink_result', childKey: 'tea_result' }],
      },
    },
    SERVE: {
      id: 'SERVE',
      description: 'Serve the completed drink',
      spec: {
        message: 'Here is your drink! Enjoy!',
        autoAdvance: true,
      },
    },
    DONE: {
      id: 'DONE',
      description: 'Order complete',
      spec: {
        message: '✨ Thank you for visiting Reflex Coffee! Come again!',
        terminal: true,
      },
    },
  },
  edges: [
    { id: 'e-greet-order', from: 'GREET', to: 'TAKE_ORDER', event: 'NEXT' },
    { id: 'e-order-size', from: 'TAKE_ORDER', to: 'CHOOSE_SIZE', event: 'NEXT' },
    { id: 'e-size-customize', from: 'CHOOSE_SIZE', to: 'CUSTOMIZE', event: 'NEXT' },
    {
      id: 'e-customize-espresso',
      from: 'CUSTOMIZE',
      to: 'PREP_ESPRESSO',
      event: 'PREP',
      guard: { type: 'equals', key: 'drink_type', value: 'espresso' },
    },
    {
      id: 'e-customize-drip',
      from: 'CUSTOMIZE',
      to: 'PREP_DRIP',
      event: 'PREP',
      guard: { type: 'equals', key: 'drink_type', value: 'drip' },
    },
    {
      id: 'e-customize-tea',
      from: 'CUSTOMIZE',
      to: 'PREP_TEA',
      event: 'PREP',
      guard: { type: 'equals', key: 'drink_type', value: 'tea' },
    },
    { id: 'e-espresso-serve', from: 'PREP_ESPRESSO', to: 'SERVE', event: 'NEXT' },
    { id: 'e-drip-serve', from: 'PREP_DRIP', to: 'SERVE', event: 'NEXT' },
    { id: 'e-tea-serve', from: 'PREP_TEA', to: 'SERVE', event: 'NEXT' },
    { id: 'e-serve-done', from: 'SERVE', to: 'DONE', event: 'NEXT' },
  ],
};
