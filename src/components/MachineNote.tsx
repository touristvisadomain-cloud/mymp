import { MACHINE_NOTE } from '@/lib/headline';

/**
 * "Headlines translated automatically from Bangla by Google Translate…": the
 * quiet line under a list of headlines on an English page. English pages only,
 * and only where a list shows a machine translation; it uses no hooks, so a
 * server or a client component can draw it.
 */
export default function MachineNote({ className = '' }: { className?: string }) {
  return <p className={`text-[12.5px] text-muted leading-relaxed ${className}`.trim()}>{MACHINE_NOTE}</p>;
}
