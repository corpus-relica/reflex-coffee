import { useRef, useEffect } from 'react';
import type { BlackboardEntry } from '@corpus-relica/reflex';

interface Props {
  entries: BlackboardEntry[];
  stackDepth: number;
}

export function Blackboard({ entries, stackDepth }: Props) {
  const prevCountRef = useRef(entries.length);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track which entries are new for flash animation
  useEffect(() => {
    prevCountRef.current = entries.length;
  }, [entries.length]);

  if (entries.length === 0) {
    return <div className="bb-empty">No entries yet</div>;
  }

  return (
    <div ref={containerRef}>
      {entries.map((entry, i) => {
        const isChild = (entry as any).stackDepth > 0;
        const isNew = i >= prevCountRef.current;
        const value =
          typeof entry.value === 'string'
            ? entry.value
            : JSON.stringify(entry.value);

        return (
          <div
            key={entry.key}
            className={`bb-entry${isNew ? ' flash' : ''}`}
          >
            <span className="bb-key">{entry.key}</span>
            <span className="bb-value" title={value}>
              {value}
            </span>
            <span className={`bb-scope${isChild ? ' child' : ''}`}>
              {isChild ? 'child' : 'local'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
