import React from 'react';
import { render } from 'ink';
import { createRegistry, createEngine } from '@corpus-relica/reflex';
import { coffeeOrder } from './workflows/coffee-order.js';
import { makeEspresso } from './workflows/make-espresso.js';
import { makeDrip } from './workflows/make-drip.js';
import { makeTea } from './workflows/make-tea.js';
import { CoffeeAgent } from './agent.js';
import { App } from './app.js';

async function main() {
  // Set up registry
  const registry = createRegistry();
  // Register sub-workflows first to avoid invocation warnings
  registry.register(makeEspresso);
  registry.register(makeDrip);
  registry.register(makeTea);
  registry.register(coffeeOrder);

  // Create agent and engine
  const agent = new CoffeeAgent();
  const engine = createEngine(registry, agent);

  // Initialize the root workflow
  await engine.init('coffee-order');

  // Render the TUI
  const { waitUntilExit } = render(<App engine={engine} />);
  await waitUntilExit();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
