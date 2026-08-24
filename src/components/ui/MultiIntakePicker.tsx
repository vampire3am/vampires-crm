import { CalendarDays, Check, ChevronDown, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { INTAKE_YEARS, MONTHS } from "../../lib/destinationsData";

export function MultiIntakePicker({ value, onChange, required = false }: { value: string; onChange: (value: string) => void; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(INTAKE_YEARS[0]);
  const root = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => value.split(",").map(item => item.trim()).filter(Boolean), [value]);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggle = (month: string) => {
    const intake = `${month} ${year}`;
    const next = selected.includes(intake) ? selected.filter(item => item !== intake) : [...selected, intake];
    onChange(next.join(", "));
  };

  const remove = (intake: string) => onChange(selected.filter(item => item !== intake).join(", "));

  return <div className="multi-intake-picker" ref={root}>
    <button type="button" className={`multi-intake-trigger ${open ? "open" : ""}`} onClick={() => setOpen(current => !current)} aria-expanded={open}>
      <span className="multi-intake-trigger-content">
        <CalendarDays size={17}/>
        {selected.length ? <span className="multi-intake-chips">{selected.map(intake => <span className="multi-intake-chip" key={intake}>{intake}<span role="button" tabIndex={0} aria-label={`Remove ${intake}`} onClick={event => { event.stopPropagation(); remove(intake); }}><X size={12}/></span></span>)}</span> : <span className="multi-intake-placeholder">Select intake month and year</span>}
      </span>
      <ChevronDown size={17}/>
    </button>
    {required && (
      <input className="multi-intake-validation" value={value} required readOnly tabIndex={-1} />
    )}
    {open && <div className="multi-intake-popover">
      <header><div><strong>Popular intake periods</strong><span>Select one or multiple intakes</span></div><span className="multi-intake-count">{selected.length} selected</span></header>
      <div className="multi-intake-year-strip" role="listbox" aria-label="Intake year">{INTAKE_YEARS.map(item => <button type="button" className={item === year ? "active" : ""} key={item} onClick={() => setYear(item)}>{item}</button>)}</div>
      <div className="multi-intake-month-grid">{MONTHS.map(month => { const intake = `${month.full} ${year}`; const active = selected.includes(intake); return <button type="button" className={active ? "active" : ""} key={month.full} onClick={() => toggle(month.full)}><span>{month.short}</span>{active && <Check size={14}/>}</button>; })}</div>
      <footer><span>Month and year are saved together.</span><button type="button" onClick={() => setOpen(false)}>Done</button></footer>
    </div>}
  </div>;
}
