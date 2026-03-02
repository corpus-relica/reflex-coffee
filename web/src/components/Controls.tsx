import type { SuspendChoice } from '@shared/types.js';

interface Props {
  mode: 'step' | 'auto';
  suspended: boolean;
  completed: boolean;
  choices: SuspendChoice[] | null;
  prompt: string | null;
  statusMessage: string;
  onStep: () => void;
  onChoice: (value: string) => void;
  onToggleMode: () => void;
  onReset: () => void;
}

export function Controls({
  mode,
  suspended,
  completed,
  choices,
  prompt,
  statusMessage,
  onStep,
  onChoice,
  onToggleMode,
  onReset,
}: Props) {
  if (completed) {
    return (
      <div className="controls">
        <div className="status-complete">Order complete!</div>
        <button className="btn" onClick={onReset}>
          Reset
        </button>
      </div>
    );
  }

  if (suspended && choices && choices.length > 0) {
    return (
      <div className="controls">
        <div className="choices">
          <span className="prompt">{prompt}</span>
          {choices.map((choice) => (
            <button
              key={choice.value}
              className="choice-btn"
              onClick={() => onChoice(choice.value)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="controls">
      <div className="controls-left">
        <button
          className="btn primary"
          onClick={onStep}
          disabled={mode === 'auto'}
        >
          Step
        </button>
        <button
          className={`btn${mode === 'auto' ? ' active' : ''}`}
          onClick={onToggleMode}
        >
          {mode === 'auto' ? 'Stop' : 'Auto'}
        </button>
        <div className="divider" />
        <button className="btn" onClick={onReset}>
          Reset
        </button>
      </div>

      {statusMessage && (
        <span className="status-message">{statusMessage}</span>
      )}
    </div>
  );
}
