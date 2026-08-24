import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { AECS_AUTHORIZED_COUNTRIES, DestinationCountry } from "../../lib/destinationsData";
import { CountryFlag } from "./PhoneInput";

interface CountrySelectProps {
  value: string;
  onChange: (countryName: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
  placement?: "auto" | "top" | "bottom";
}

export function CountrySelect({
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = "Select destination country",
  id,
  name,
  placement = "auto",
}: CountrySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCountry = AECS_AUTHORIZED_COUNTRIES.find(
    c => c.name.toLowerCase() === value.toLowerCase() || c.code.toLowerCase() === value.toLowerCase()
  );

  useEffect(() => {
    if (isOpen && containerRef.current) {
      if (placement === "top") {
        setOpenUpward(true);
      } else if (placement === "bottom") {
        setOpenUpward(false);
      } else {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        setOpenUpward(spaceBelow < 260);
      }
    }
  }, [isOpen, placement]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  const handleSelect = (c: DestinationCountry) => {
    onChange(c.name);
    setIsOpen(false);
  };

  const filtered = AECS_AUTHORIZED_COUNTRIES.filter(
    c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(v => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          height: "38px",
          padding: "0 12px",
          background: "var(--bg-card)",
          border: isOpen ? "1.5px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-sm)",
          color: value ? "var(--text-main)" : "var(--text-muted)",
          fontSize: "13px",
          cursor: disabled ? "not-allowed" : "pointer",
          userSelect: "none",
          transition: "all 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {selectedCountry ? (
            <>
              <CountryFlag code={selectedCountry.code} size={16} />
              <strong style={{ fontWeight: 600, color: "var(--text-main)" }}>{selectedCountry.name}</strong>
            </>
          ) : (
            <span>{placeholder}</span>
          )}
        </div>
        <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
      </button>

      {/* Hidden input for HTML form validation */}
      {required && (
        <input
          type="text"
          required
          value={value}
          onChange={() => {}}
          style={{ opacity: 0, height: 0, width: 0, position: "absolute", pointerEvents: "none" }}
          tabIndex={-1}
        />
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            ...(openUpward ? { bottom: "calc(100% + 4px)" } : { top: "calc(100% + 4px)" }),
            left: 0,
            width: "100%",
            minWidth: "260px",
            maxHeight: "220px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "0 12px 28px rgba(0, 0, 0, 0.28)",
            zIndex: 1200,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          onClick={e => e.stopPropagation()}
        >
          <div
            style={{
              padding: "6px 10px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--bg-card-subtle)",
            }}
          >
            <Search size={14} style={{ color: "var(--text-muted)" }} />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search destination country…"
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                fontSize: "12px",
                color: "var(--text-main)",
                outline: "none",
              }}
            />
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            {filtered.map(country => {
              const isSelected = selectedCountry?.code === country.code;
              return (
                <div
                  key={country.code}
                  onClick={() => handleSelect(country)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 12px",
                    fontSize: "12.5px",
                    cursor: "pointer",
                    background: isSelected ? "var(--accent-blue-soft)" : "transparent",
                    color: "var(--text-main)",
                    transition: "background 0.1s ease",
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = "var(--bg-card-subtle)";
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <CountryFlag code={country.code} size={15} />
                    <span style={{ fontWeight: isSelected ? 700 : 500 }}>{country.name}</span>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    {country.currency}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default CountrySelect;
