import { ADtoBS, BStoAD, NepaliDate } from "nepali-date-library";

const AD_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const adIso = (value: string | Date) => {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (AD_DATE_PATTERN.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid AD date");
  return adIso(parsed);
};

export const adToBs = (value: string | Date) => ADtoBS(adIso(value));

export const bsToAd = (value: string) => {
  if (!BS_DATE_PATTERN.test(value)) throw new Error("Use YYYY-MM-DD BS format");
  return BStoAD(value);
};

export const isValidBsDate = (value: string) => {
  try {
    return BS_DATE_PATTERN.test(value) && Boolean(bsToAd(value));
  } catch {
    return false;
  }
};

export const todayAd = () => adIso(new Date());
export const todayBs = () => adToBs(new Date());

export const formatBsDate = (value: string | Date, style: "numeric" | "medium" = "medium") => {
  try {
    const bs = adToBs(value);
    if (style === "numeric") return `${bs} BS`;
    const [year, month, day] = bs.split("-").map(Number);
    const monthName = NepaliDate.getMonthName(month - 1, true, false);
    return `${String(day).padStart(2, "0")} ${monthName} ${year} BS`;
  } catch {
    return "—";
  }
};

export const formatBsPeriod = (start: string, end: string) => `${formatBsDate(start)} – ${formatBsDate(end)}`;
