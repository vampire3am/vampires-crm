import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
type View = "years" | "months" | "days";

export function DobPicker({ value, onChange, required }: { value: string; onChange: (value: string) => void; required?: boolean }) {
  const parsed = value ? new Date(`${value}T00:00:00`) : null;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("years");
  const [yearStart, setYearStart] = useState(parsed?.getFullYear() ? Math.floor(parsed.getFullYear() / 12) * 12 : 2001);
  const [year, setYear] = useState(parsed?.getFullYear() || 2001);
  const [month, setMonth] = useState(parsed?.getMonth() || 0);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  const years = useMemo(() => Array.from({ length: 12 }, (_, index) => yearStart + index), [yearStart]);
  const days = useMemo(() => Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => index + 1), [year, month]);
  const chooseDay = (day: number) => { onChange(`${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`); setOpen(false); setView("years"); };
  const display = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) : "Select date of birth";
  return <div className="dob-picker" ref={root}>
    <button type="button" className={`dob-trigger ${value ? "selected" : ""}`} onClick={() => setOpen(current => !current)} aria-haspopup="dialog" aria-expanded={open}><span>{display}</span><CalendarDays size={18}/></button>
    {open && <div className="dob-popover" role="dialog" aria-label="Choose date of birth">
      <header><button type="button" aria-label="Previous" onClick={() => view === "years" ? setYearStart(start => start - 12) : view === "months" ? setYear(current => current - 1) : setMonth(current => current === 0 ? 11 : current - 1)}><ChevronLeft/></button><strong>{view === "years" ? `${yearStart}–${yearStart + 11}` : view === "months" ? year : `${months[month]} ${year}`}</strong><button type="button" aria-label="Next" onClick={() => view === "years" ? setYearStart(start => Math.min(start + 12, new Date().getFullYear() - 11)) : view === "months" ? setYear(current => Math.min(current + 1, new Date().getFullYear())) : setMonth(current => current === 11 ? 0 : current + 1)}><ChevronRight/></button></header>
      {view === "years" && <div className="dob-year-grid">{years.filter(item => item <= new Date().getFullYear()).map(item => <button type="button" className={item === year ? "active" : ""} key={item} onClick={() => { setYear(item); setView("months"); }}>{item}</button>)}</div>}
      {view === "months" && <div className="dob-month-grid">{months.map((item,index) => <button type="button" className={index === month ? "active" : ""} key={item} onClick={() => { setMonth(index); setView("days"); }}>{item}</button>)}</div>}
      {view === "days" && <div className="dob-day-grid">{days.map(day => <button type="button" key={day} onClick={() => chooseDay(day)}>{day}</button>)}</div>}
      <footer><button type="button" onClick={() => { onChange(""); setOpen(false); }}>Clear</button>{required && <span>Required</span>}</footer>
    </div>}
  </div>;
}
