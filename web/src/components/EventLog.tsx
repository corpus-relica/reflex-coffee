import { useEffect, useRef } from 'react';
import type { EventLogEntry } from '@shared/types.js';

interface Props {
  events: EventLogEntry[];
}

function eventCategory(type: string): string {
  if (type.startsWith('node:')) return 'node';
  if (type.startsWith('edge:')) return 'edge';
  if (type.startsWith('blackboard:')) return 'bb';
  if (type.startsWith('workflow:')) return 'workflow';
  if (type.startsWith('engine:error')) return 'error';
  if (type.startsWith('engine:')) return 'engine';
  return 'engine';
}

function shortType(type: string): string {
  return type.replace('blackboard:', 'bb:');
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export function EventLog({ events }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [events.length]);

  if (events.length === 0) {
    return <div className="events-empty">No events yet</div>;
  }

  return (
    <div ref={scrollRef} style={{ overflow: 'auto' }}>
      {events.map((event) => {
        const cat = eventCategory(event.type);
        return (
          <div key={event.id} className="event-entry">
            <span className="event-time">{formatTime(event.timestamp)}</span>
            <span className={`event-type ${cat}`}>{shortType(event.type)}</span>
            <span className="event-message">{event.message}</span>
          </div>
        );
      })}
    </div>
  );
}
