import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, UserRound } from "lucide-react";
import type { StudentDirectoryRecord } from "../../services/studentService";

interface StudentSelectProps {
  students: StudentDirectoryRecord[];
  value: string;
  loading?: boolean;
  onChange: (student?: StudentDirectoryRecord) => void;
}

export function StudentSelect({ students, value, loading = false, onChange }: StudentSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = students.find(student => student.student_code === value);
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return students;
    return students.filter(student => [student.fullName, student.student_code, student.phone, student.email].some(field => field.toLowerCase().includes(term)));
  }, [query, students]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 30);
    else setQuery("");
  }, [open]);

  return (
    <div className="student-select" ref={containerRef}>
      <button type="button" className={`student-select-trigger${open ? " open" : ""}`} disabled={loading} onClick={() => setOpen(current => !current)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="student-select-avatar"><UserRound size={15}/></span>
        <span className="student-select-value">
          <strong>{selected?.fullName ?? (loading ? "Loading students…" : "Select a registered student")}</strong>
          <small>{selected ? `${selected.student_code} · ${selected.phone || selected.email || "Contact not recorded"}` : "Search by name, AECS code, phone or email"}</small>
        </span>
        <ChevronDown size={16}/>
      </button>
      {open && (
        <div className="student-select-menu" role="listbox">
          <div className="student-select-search"><Search size={15}/><input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search registered students…" /></div>
          <div className="student-select-results">
            {matches.length === 0 && <div className="student-select-empty"><UserRound size={18}/><span>No registered student matches this search.</span></div>}
            {matches.map(student => (
              <button type="button" role="option" aria-selected={student.student_code === value} key={student.id} className="student-select-option" onClick={() => { onChange(student); setOpen(false); }}>
                <span className="student-option-avatar">{student.fullName.slice(0, 1).toUpperCase()}</span>
                <span><strong>{student.fullName}</strong><small>{student.student_code} · {student.targetCountry || "Destination undecided"}</small></span>
                {student.student_code === value && <Check size={16}/>} 
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
