import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

export interface CountryCode {
  name: string;
  code: string;
  dialCode: string;
  placeholder: string;
}

export const COUNTRIES: CountryCode[] = [
  { name: "Nepal", code: "NP", dialCode: "+977", placeholder: "98XXXXXXXX" },
  { name: "India", code: "IN", dialCode: "+91", placeholder: "98XXXXXXXX" },
  { name: "Australia", code: "AU", dialCode: "+61", placeholder: "4XX XXX XXX" },
  { name: "United Kingdom", code: "GB", dialCode: "+44", placeholder: "7XXX XXXXXX" },
  { name: "United States", code: "US", dialCode: "+1", placeholder: "(555) 000-0000" },
  { name: "Canada", code: "CA", dialCode: "+1", placeholder: "(555) 000-0000" },
  { name: "Germany", code: "DE", dialCode: "+49", placeholder: "15X XXXXXXXX" },
  { name: "Japan", code: "JP", dialCode: "+81", placeholder: "90 XXXX XXXX" },
  { name: "United Arab Emirates", code: "AE", dialCode: "+971", placeholder: "50 XXX XXXX" },
  { name: "Saudi Arabia", code: "SA", dialCode: "+966", placeholder: "5X XXX XXXX" },
  { name: "Qatar", code: "QA", dialCode: "+974", placeholder: "33XX XXXX" },
  { name: "Malaysia", code: "MY", dialCode: "+60", placeholder: "1X-XXX XXXX" },
  { name: "New Zealand", code: "NZ", dialCode: "+64", placeholder: "2X XXX XXXX" },
  { name: "South Korea", code: "KR", dialCode: "+82", placeholder: "10 XXXX XXXX" },
  { name: "Bangladesh", code: "BD", dialCode: "+880", placeholder: "1XXX XXXXXX" },
  { name: "Pakistan", code: "PK", dialCode: "+92", placeholder: "3XX XXXXXXX" },
  { name: "Sri Lanka", code: "LK", dialCode: "+94", placeholder: "7X XXX XXXX" },
  { name: "Bhutan", code: "BT", dialCode: "+975", placeholder: "17XX XXXX" },
  { name: "China", code: "CN", dialCode: "+86", placeholder: "13X XXXX XXXX" },
  { name: "Philippines", code: "PH", dialCode: "+63", placeholder: "9XX XXX XXXX" },
  { name: "France", code: "FR", dialCode: "+33", placeholder: "6 XX XX XX XX" },
  { name: "Netherlands", code: "NL", dialCode: "+31", placeholder: "6 XXXXXXXX" },
  { name: "Sweden", code: "SE", dialCode: "+46", placeholder: "70 XXX XX XX" },
  { name: "Italy", code: "IT", dialCode: "+39", placeholder: "3XX XXXXXXX" },
];

/**
 * High-Resolution Vector SVG Flag Component
 * Resolves the Windows OS limitation where emoji flags render as raw two-letter text (NP, IN, US).
 */
export function CountryFlag({ code, size = 18 }: { code: string; size?: number }) {
  const width = size * 1.33;
  const height = size;

  switch (code) {
    case "NP": // Nepal
      return (
        <svg width={width} height={height} viewBox="0 0 24 28" fill="none" style={{ borderRadius: "1px" }}>
          <path d="M0 0L20 14L8 14L22 28L0 28Z" fill="#DC143C" stroke="#003893" strokeWidth="2.5" />
          <circle cx="6" cy="9" r="2.5" fill="#FFFFFF" />
          <polygon points="6,20 7,22 9,21 8,23 10,24 8,25 9,27 7,26 6,28 5,26 3,27 4,25 2,24 4,23 3,21 5,22" fill="#FFFFFF" />
        </svg>
      );

    case "IN": // India
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="5.33" fill="#FF9933" />
          <rect y="5.33" width="24" height="5.33" fill="#FFFFFF" />
          <rect y="10.66" width="24" height="5.34" fill="#138808" />
          <circle cx="12" cy="8" r="2" stroke="#000088" strokeWidth="0.7" fill="none" />
          <circle cx="12" cy="8" r="0.6" fill="#000088" />
        </svg>
      );

    case "AU": // Australia
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="16" fill="#00008B" />
          {/* Canton Union Jack */}
          <rect width="12" height="8" fill="#012169" />
          <path d="M0 0L12 8M12 0L0 8" stroke="#FFFFFF" strokeWidth="1.5" />
          <path d="M0 0L12 8M12 0L0 8" stroke="#C8102E" strokeWidth="0.8" />
          <path d="M6 0V8M0 4H12" stroke="#FFFFFF" strokeWidth="2.5" />
          <path d="M6 0V8M0 4H12" stroke="#C8102E" strokeWidth="1.5" />
          {/* Commonwealth Star */}
          <polygon points="6,12 6.5,13.5 8,13.5 6.8,14.5 7.2,16 6,15 4.8,16 5.2,14.5 4,13.5 5.5,13.5" fill="#FFFFFF" />
          {/* Southern Cross */}
          <circle cx="18" cy="3" r="0.7" fill="#FFFFFF" />
          <circle cx="21" cy="6" r="0.7" fill="#FFFFFF" />
          <circle cx="18" cy="13" r="0.9" fill="#FFFFFF" />
          <circle cx="15.5" cy="7.5" r="0.7" fill="#FFFFFF" />
          <circle cx="19" cy="9" r="0.5" fill="#FFFFFF" />
        </svg>
      );

    case "GB": // United Kingdom
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="16" fill="#012169" />
          <path d="M0 0L24 16M24 0L0 16" stroke="#FFFFFF" strokeWidth="3" />
          <path d="M0 0L24 16M24 0L0 16" stroke="#C8102E" strokeWidth="1.5" />
          <path d="M12 0V16M0 8H24" stroke="#FFFFFF" strokeWidth="5" />
          <path d="M12 0V16M0 8H24" stroke="#C8102E" strokeWidth="3" />
        </svg>
      );

    case "US": // United States
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="16" fill="#B22234" />
          <path d="M0 2.46H24M0 4.92H24M0 7.38H24M0 9.84H24M0 12.3H24M0 14.76H24" stroke="#FFFFFF" strokeWidth="1.23" />
          <rect width="10" height="8.6" fill="#3C3B6E" />
          <circle cx="2.5" cy="2.2" r="0.5" fill="#FFFFFF" />
          <circle cx="5" cy="2.2" r="0.5" fill="#FFFFFF" />
          <circle cx="7.5" cy="2.2" r="0.5" fill="#FFFFFF" />
          <circle cx="3.75" cy="4.3" r="0.5" fill="#FFFFFF" />
          <circle cx="6.25" cy="4.3" r="0.5" fill="#FFFFFF" />
          <circle cx="2.5" cy="6.4" r="0.5" fill="#FFFFFF" />
          <circle cx="5" cy="6.4" r="0.5" fill="#FFFFFF" />
          <circle cx="7.5" cy="6.4" r="0.5" fill="#FFFFFF" />
        </svg>
      );

    case "CA": // Canada
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="6" height="16" fill="#D80621" />
          <rect x="6" width="12" height="16" fill="#FFFFFF" />
          <rect x="18" width="6" height="16" fill="#D80621" />
          <polygon points="12,3 13,6 15,5 14,7 16,9 13.5,9 14,12 12.5,11 12,13 11.5,11 10,12 10.5,9 8,9 10,7 9,5 11,6" fill="#D80621" />
        </svg>
      );

    case "DE": // Germany
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="5.33" fill="#000000" />
          <rect y="5.33" width="24" height="5.33" fill="#DD0000" />
          <rect y="10.66" width="24" height="5.34" fill="#FFCE00" />
        </svg>
      );

    case "JP": // Japan
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="16" fill="#FFFFFF" />
          <circle cx="12" cy="8" r="4.5" fill="#BC002D" />
        </svg>
      );

    case "AE": // UAE
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect x="6" width="18" height="5.33" fill="#00732F" />
          <rect x="6" y="5.33" width="18" height="5.33" fill="#FFFFFF" />
          <rect x="6" y="10.66" width="18" height="5.34" fill="#000000" />
          <rect width="6" height="16" fill="#FF0000" />
        </svg>
      );

    case "SA": // Saudi Arabia
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="16" fill="#006C35" />
          <path d="M5 8H19M7 10L17 10" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
        </svg>
      );

    case "QA": // Qatar
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="16" fill="#8D1B3D" />
          <path d="M0 0H8L6 1.7L8 3.5L6 5.3L8 7.1L6 8.9L8 10.7L6 12.5L8 14.3L6 16H0Z" fill="#FFFFFF" />
        </svg>
      );

    case "MY": // Malaysia
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="16" fill="#CC0000" />
          <path d="M0 2.28H24M0 4.56H24M0 6.84H24M0 9.12H24M0 11.4H24M0 13.68H24" stroke="#FFFFFF" strokeWidth="1.14" />
          <rect width="11" height="8" fill="#000066" />
          <circle cx="5.5" cy="4" r="2.2" fill="#FFCC00" />
          <circle cx="6.2" cy="4" r="1.8" fill="#000066" />
          <polygon points="8,4 8.5,4.5 9,4 8.7,4.8 9.5,5 8.7,5.2 9,6 8.5,5.5 8,6 8.2,5.2 7.5,5 8.2,4.8" fill="#FFCC00" />
        </svg>
      );

    case "NZ": // New Zealand
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="16" fill="#00247D" />
          {/* Canton Union Jack */}
          <rect width="12" height="8" fill="#012169" />
          <path d="M0 0L12 8M12 0L0 8" stroke="#FFFFFF" strokeWidth="1.5" />
          <path d="M0 0L12 8M12 0L0 8" stroke="#C8102E" strokeWidth="0.8" />
          <path d="M6 0V8M0 4H12" stroke="#FFFFFF" strokeWidth="2.5" />
          <path d="M6 0V8M0 4H12" stroke="#C8102E" strokeWidth="1.5" />
          {/* Southern Cross Red Stars */}
          <circle cx="18" cy="3.5" r="0.8" fill="#CC142B" stroke="#FFFFFF" strokeWidth="0.3" />
          <circle cx="21" cy="6.5" r="0.8" fill="#CC142B" stroke="#FFFFFF" strokeWidth="0.3" />
          <circle cx="18" cy="12.5" r="0.9" fill="#CC142B" stroke="#FFFFFF" strokeWidth="0.3" />
          <circle cx="15.5" cy="8" r="0.7" fill="#CC142B" stroke="#FFFFFF" strokeWidth="0.3" />
        </svg>
      );

    case "KR": // South Korea
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="16" fill="#FFFFFF" />
          <circle cx="12" cy="8" r="3.5" fill="#C60C30" />
          <path d="M12 4.5A3.5 3.5 0 0 1 12 11.5A1.75 1.75 0 0 1 12 8A1.75 1.75 0 0 0 12 4.5Z" fill="#003478" />
          {/* Trigrams */}
          <rect x="4" y="3" width="2" height="0.5" fill="#000000" />
          <rect x="4" y="4" width="2" height="0.5" fill="#000000" />
          <rect x="18" y="11.5" width="2" height="0.5" fill="#000000" />
          <rect x="18" y="12.5" width="2" height="0.5" fill="#000000" />
        </svg>
      );

    case "BD": // Bangladesh
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="16" fill="#006A4E" />
          <circle cx="10.5" cy="8" r="4.5" fill="#F42A41" />
        </svg>
      );

    case "PK": // Pakistan
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="16" fill="#01411C" />
          <rect width="6" height="16" fill="#FFFFFF" />
          <circle cx="15" cy="8" r="3.5" fill="#FFFFFF" />
          <circle cx="16" cy="7.2" r="3.2" fill="#01411C" />
          <polygon points="16,5.5 16.5,6.5 17.5,6 16.8,7 17.2,8 16.2,7.5 15.5,8.2 15.8,7.2 15,6.8 15.8,6.5" fill="#FFFFFF" />
        </svg>
      );

    case "LK": // Sri Lanka
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="16" fill="#FFBE29" />
          <rect x="1" y="1" width="4" height="14" fill="#00534E" />
          <rect x="5.5" y="1" width="4" height="14" fill="#EB7400" />
          <rect x="10.5" y="1" width="12.5" height="14" fill="#8D153A" />
          <circle cx="16.5" cy="8" r="2" fill="#FFBE29" />
        </svg>
      );

    case "BT": // Bhutan
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <polygon points="0,0 24,0 0,16" fill="#FFCC00" />
          <polygon points="24,0 24,16 0,16" fill="#FF4E12" />
          <circle cx="12" cy="8" r="2.5" fill="#FFFFFF" />
        </svg>
      );

    case "CN": // China
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="16" fill="#DE2910" />
          <polygon points="4,2.5 4.6,4.2 6.3,4.2 5,5.2 5.5,6.8 4,5.8 2.5,6.8 3,5.2 1.7,4.2 3.4,4.2" fill="#FFDE00" />
          <circle cx="8" cy="2" r="0.6" fill="#FFDE00" />
          <circle cx="9.5" cy="3.5" r="0.6" fill="#FFDE00" />
          <circle cx="9.5" cy="5.5" r="0.6" fill="#FFDE00" />
          <circle cx="8" cy="7" r="0.6" fill="#FFDE00" />
        </svg>
      );

    case "PH": // Philippines
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="8" fill="#0038A8" />
          <rect y="8" width="24" height="8" fill="#CE1126" />
          <polygon points="0,0 12,8 0,16" fill="#FFFFFF" />
          <circle cx="4" cy="8" r="1.5" fill="#FCD116" />
        </svg>
      );

    case "FR": // France
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="8" height="16" fill="#002654" />
          <rect x="8" width="8" height="16" fill="#FFFFFF" />
          <rect x="16" width="8" height="16" fill="#ED2939" />
        </svg>
      );

    case "NL": // Netherlands
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="5.33" fill="#AE1C28" />
          <rect y="5.33" width="24" height="5.33" fill="#FFFFFF" />
          <rect y="10.66" width="24" height="5.34" fill="#21468B" />
        </svg>
      );

    case "SE": // Sweden
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="16" fill="#006AA7" />
          <rect x="7" width="3" height="16" fill="#FECC00" />
          <rect y="6.5" width="24" height="3" fill="#FECC00" />
        </svg>
      );

    case "IT": // Italy
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="8" height="16" fill="#009246" />
          <rect x="8" width="8" height="16" fill="#FFFFFF" />
          <rect x="16" width="8" height="16" fill="#CE2B37" />
        </svg>
      );

    case "FI": // Finland
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="16" fill="#FFFFFF" />
          <rect x="6" width="4" height="16" fill="#002F6C" />
          <rect y="6" width="24" height="4" fill="#002F6C" />
        </svg>
      );

    case "MT": // Malta
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="12" height="16" fill="#FFFFFF" />
          <rect x="12" width="12" height="16" fill="#CF142B" />
          <rect x="1.5" y="1.5" width="3" height="3" fill="#888888" rx="0.5" />
        </svg>
      );

    case "CY": // Cyprus
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="16" fill="#FFFFFF" />
          <path d="M7 6L14 3L17 7L13 9L9 10Z" fill="#D47000" />
          <path d="M8 12C10 13.5 14 13.5 16 12" stroke="#4E5B31" strokeWidth="1" fill="none" strokeLinecap="round" />
        </svg>
      );

    case "BE": // Belgium
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="8" height="16" fill="#000000" />
          <rect x="8" width="8" height="16" fill="#FDDA24" />
          <rect x="16" width="8" height="16" fill="#EF3340" />
        </svg>
      );

    case "HU": // Hungary
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="24" height="5.33" fill="#CE2939" />
          <rect y="5.33" width="24" height="5.33" fill="#FFFFFF" />
          <rect y="10.66" width="24" height="5.34" fill="#477050" />
        </svg>
      );

    case "IE": // Ireland
      return (
        <svg width={width} height={height} viewBox="0 0 24 16" fill="none" style={{ borderRadius: "2px", border: "1px solid rgba(0,0,0,0.1)" }}>
          <rect width="8" height="16" fill="#169B62" />
          <rect x="8" width="8" height="16" fill="#FFFFFF" />
          <rect x="16" width="8" height="16" fill="#FF883E" />
        </svg>
      );

    default:
      return (
        <img
          src={`https://flagcdn.com/${code.toLowerCase()}.svg`}
          width={width}
          height={height}
          alt={`${code.toUpperCase()} flag`}
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{
            width,
            height,
            display: "block",
            objectFit: "cover",
            borderRadius: "2px",
            border: "1px solid rgba(0,0,0,0.1)",
          }}
        />
      );
  }
}

interface PhoneInputProps {
  value: string;
  onChange: (fullNumber: string) => void;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
}

export function PhoneInput({
  value,
  onChange,
  required = false,
  disabled = false,
  id,
  name,
}: PhoneInputProps) {
  // Parse incoming value to find matching country code and local number
  const parseValue = (val: string) => {
    if (!val) return { country: COUNTRIES[0], local: "" };
    const cleaned = val.trim();
    // Try to match longest dial code first
    const matched = COUNTRIES.slice().sort((a, b) => b.dialCode.length - a.dialCode.length).find(c =>
      cleaned.startsWith(c.dialCode)
    );
    if (matched) {
      const local = cleaned.substring(matched.dialCode.length).trim();
      return { country: matched, local };
    }
    return { country: COUNTRIES[0], local: cleaned.replace(/^\+977\s*/, "") };
  };

  const initial = parseValue(value);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(initial.country);
  const [localNumber, setLocalNumber] = useState<string>(initial.local);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync if parent value changes externally
  useEffect(() => {
    const parsed = parseValue(value);
    setSelectedCountry(parsed.country);
    setLocalNumber(parsed.local);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  const handleCountrySelect = (country: CountryCode) => {
    setSelectedCountry(country);
    setIsOpen(false);
    const combined = localNumber.trim() ? `${country.dialCode} ${localNumber.trim()}` : country.dialCode;
    onChange(combined);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalNumber(raw);
    const combined = raw.trim() ? `${selectedCountry.dialCode} ${raw.trim()}` : selectedCountry.dialCode;
    onChange(combined);
  };

  const filteredCountries = COUNTRIES.filter(
    c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dialCode.includes(search) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "stretch",
        width: "100%",
      }}
      ref={dropdownRef}
    >
      {/* Country Selector Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(v => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "0 10px",
          background: "var(--bg-card-subtle)",
          border: "1px solid var(--border-subtle)",
          borderRight: "none",
          borderTopLeftRadius: "var(--radius-sm)",
          borderBottomLeftRadius: "var(--radius-sm)",
          color: "var(--text-main)",
          fontSize: "13px",
          cursor: disabled ? "not-allowed" : "pointer",
          userSelect: "none",
          transition: "all 0.15s ease",
          flexShrink: 0,
        }}
        title={`Selected: ${selectedCountry.name} (${selectedCountry.dialCode})`}
        aria-label="Select Country Code"
      >
        <CountryFlag code={selectedCountry.code} size={15} />
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "12.5px" }}>
          {selectedCountry.dialCode}
        </span>
        <ChevronDown size={13} style={{ color: "var(--text-muted)", marginLeft: "2px" }} />
      </button>

      {/* Local Phone Number Input */}
      <input
        type="tel"
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        value={localNumber}
        onChange={handleNumberChange}
        placeholder={selectedCountry.placeholder}
        style={{
          flex: 1,
          height: "38px",
          padding: "0 12px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderTopRightRadius: "var(--radius-sm)",
          borderBottomRightRadius: "var(--radius-sm)",
          color: "var(--text-main)",
          fontSize: "13px",
          outline: "none",
          fontFamily: "var(--font-mono)",
        }}
      />

      {/* Google-Style Country Search Dropdown */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            width: "320px",
            maxHeight: "280px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Search Header */}
          <div
            style={{
              padding: "8px 10px",
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
              placeholder="Search country or dial code…"
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

          {/* Countries List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            {filteredCountries.length > 0 ? (
              filteredCountries.map(country => (
                <div
                  key={country.code}
                  onClick={() => handleCountrySelect(country)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    fontSize: "12.5px",
                    cursor: "pointer",
                    background:
                      selectedCountry.code === country.code ? "var(--accent-blue-soft)" : "transparent",
                    color: "var(--text-main)",
                    transition: "background 0.1s ease",
                  }}
                  onMouseEnter={e => {
                    if (selectedCountry.code !== country.code) {
                      e.currentTarget.style.background = "var(--bg-card-subtle)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (selectedCountry.code !== country.code) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <CountryFlag code={country.code} size={15} />
                    <span style={{ fontWeight: selectedCountry.code === country.code ? 700 : 500 }}>
                      {country.name}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11.5px",
                      color: "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    {country.dialCode}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: "12px", textAlign: "center", fontSize: "11.5px", color: "var(--text-muted)" }}>
                No country found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PhoneInput;
