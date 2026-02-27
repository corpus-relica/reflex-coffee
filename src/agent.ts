import type { DecisionAgent, DecisionContext, Decision } from '@corpus-relica/reflex';
import type { CoffeeNodeSpec } from './types.js';

/**
 * Shared mutable slot for TUI → Agent communication.
 * The TUI writes the user's choice here; the agent reads and clears it.
 */
export const pendingChoice: { key: string | null; value: string | null } = {
  key: null,
  value: null,
};

/**
 * CoffeeAgent — a DecisionAgent that drives the coffee shop workflow.
 *
 * At suspend nodes (TAKE_ORDER, CHOOSE_SIZE, CUSTOMIZE): returns suspend
 * unless pendingChoice has been set by the TUI, in which case it writes
 * the choice to blackboard and advances.
 *
 * At auto-advance nodes: writes status values and picks the single outgoing edge.
 * At terminal nodes: writes result values and returns complete.
 * At fan-out nodes: the engine filters edges via guards — agent picks the remaining edge.
 */
export class CoffeeAgent implements DecisionAgent {
  async resolve(context: DecisionContext): Promise<Decision> {
    const spec = context.node.spec as CoffeeNodeSpec;

    // -- Terminal nodes: complete ------------------------------------------
    if (spec.terminal || context.validEdges.length === 0) {
      const writes = [];
      if (spec.writeKey) {
        const drinkType = (context.blackboard.get('drink_type') as string) ?? 'drink';
        const size = (context.blackboard.get('size') as string) ?? '';
        const milk = (context.blackboard.get('milk_type') as string) ?? '';
        const resultValue = `${size} ${drinkType}${milk && milk !== 'none' ? ` with ${milk} milk` : ', black'}`;
        writes.push({ key: spec.writeKey, value: resultValue.trim() });
      }
      return { type: 'complete', writes };
    }

    // -- Suspend nodes: check for pending user choice ----------------------
    if (spec.suspend) {
      // Check if user has provided a choice via the TUI
      if (pendingChoice.key === spec.writeKey && pendingChoice.value !== null) {
        const writes = [{ key: pendingChoice.key, value: pendingChoice.value }];
        // Clear the pending choice
        pendingChoice.key = null;
        pendingChoice.value = null;

        // Pick the single valid edge
        const edge = context.validEdges[0];
        if (!edge) {
          return { type: 'suspend', reason: 'No valid edges after choice' };
        }
        return { type: 'advance', edge: edge.id, writes };
      }

      // No choice yet — suspend and wait for user input
      return { type: 'suspend', reason: spec.prompt ?? 'Awaiting input' };
    }

    // -- Auto-advance nodes: write status and advance ----------------------
    const writes = [];
    if (spec.writeKey && spec.writeValue) {
      writes.push({ key: spec.writeKey, value: spec.writeValue });
    }

    // Pick the single valid edge (guards have already filtered)
    const edge = context.validEdges[0];
    if (!edge) {
      return { type: 'suspend', reason: 'No valid edges available' };
    }

    return { type: 'advance', edge: edge.id, writes };
  }
}
