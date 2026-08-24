import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const countryCodes: Record<string, string> = { Australia:"au", UK:"gb", USA:"us", "New Zealand":"nz", Canada:"ca", Germany:"de", Finland:"fi", Malta:"mt", Cyprus:"cy", Sweden:"se", Belgium:"be", Hungary:"hu", Netherlands:"nl", Ireland:"ie", Japan:"jp", "South Korea":"kr" };

function Flag({ country }: { country: string }) {
  const code = countryCodes[country];
  return code ? <img className="country-flag" src={`https://flagcdn.com/w40/${code}.png`} srcSet={`https://flagcdn.com/w80/${code}.png 2x`} alt="" loading="lazy" /> : null;
}

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  required?: boolean;
  country?: boolean;
  format?: (value: string) => string;
  optionIcon?: (value: string) => ReactNode;
};

export function FancySelect({ label, value, onChange, options, required, country = false, format, optionIcon }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => options.filter(option => (format?.(option) || option).toLowerCase().includes(query.toLowerCase())), [options, query, format]);

  useEffect(() => {
    const close = (event: MouseEvent | TouchEvent) => { if (!root.current?.contains(event.target as Node)) { setOpen(false); setQuery(""); } };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); setQuery(""); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close, { passive: true });
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); document.removeEventListener("keydown", escape); };
  }, []);

  const shown = value ? (format?.(value) || value) : "Select an option";
  return <label className="fancy-field">{label}{required && <b> *</b>}<div className={`fancy-select ${open ? "open" : ""}`} ref={root}>
    <button type="button" className="fancy-trigger" onClick={() => setOpen(current => !current)} aria-expanded={open} aria-haspopup="listbox" aria-required={required}><span>{country && value && <Flag country={value} />}{value && optionIcon?.(value)}{shown}</span><ChevronDown size={18} /></button>
    {open && <div className="fancy-menu">{(country || options.length > 6) && <div className="fancy-search"><Search size={15} /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder={country ? "Search country…" : "Search options…"} /></div>}<div className="fancy-options" role="listbox">{filtered.map(option => <button type="button" role="option" aria-selected={option === value} className={option === value ? "selected" : ""} key={option} onClick={() => { onChange(option); setOpen(false); setQuery(""); }}>{country && <Flag country={option} />}{optionIcon?.(option)}<span>{format?.(option) || option}</span>{option === value && <Check size={17} />}</button>)}{filtered.length === 0 && <p>No options found</p>}</div></div>}
  </div></label>;
}
