import { CountryFlag } from "./PhoneInput";
import { AECS_AUTHORIZED_COUNTRIES } from "../../lib/destinationsData";

const aliases: Record<string, string> = {
  UK: "GB", "UNITED KINGDOM": "GB", ENGLAND: "GB",
  USA: "US", "U.S.A.": "US", "UNITED STATES": "US", "UNITED STATES OF AMERICA": "US",
  UAE: "AE", "UNITED ARAB EMIRATES": "AE",
  KOREA: "KR", "SOUTH KOREA": "KR",
  NEPAL: "NP", INDIA: "IN", AUSTRALIA: "AU", CANADA: "CA", GERMANY: "DE",
  JAPAN: "JP", "NEW ZEALAND": "NZ", FINLAND: "FI", MALTA: "MT", CYPRUS: "CY",
  HUNGARY: "HU", IRELAND: "IE", FRANCE: "FR", ITALY: "IT", SWEDEN: "SE",
  NETHERLANDS: "NL", CHINA: "CN", MALAYSIA: "MY", SINGAPORE: "SG",
};

export function countryCodeForName(country?: string | null) {
  const value = country?.trim();
  if (!value || ["ALL", "UNDECIDED", "NOT SPECIFIED", "NOT APPLICABLE", "STUDY ABROAD"].includes(value.toUpperCase())) return "";
  return aliases[value.toUpperCase()] || AECS_AUTHORIZED_COUNTRIES.find(item => item.name.toUpperCase() === value.toUpperCase())?.code || "";
}

export function CountryDisplay({ country, size = 16, className = "" }: { country?: string | null; size?: number; className?: string }) {
  const label = country?.trim() || "Not specified";
  const code = countryCodeForName(label);
  return <span className={`country-display ${className}`.trim()}>{code ? <CountryFlag code={code} size={size} /> : <span className="country-display-map" aria-hidden="true">⌖</span>}<span>{label}</span></span>;
}
