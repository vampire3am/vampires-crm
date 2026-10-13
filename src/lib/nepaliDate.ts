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

export const formatBsMonth = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return "—";
  return `${NepaliDate.getMonthName(month - 1, true, false)} ${year}`;
};

export const bsMonthToAdRange = (value: string) => {
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error("Use YYYY-MM BS format");
  const start = bsToAd(`${value}-01`);
  for (let day = 32; day >= 28; day -= 1) {
    const candidate = `${value}-${String(day).padStart(2, "0")}`;
    if (isValidBsDate(candidate)) return { start, end: bsToAd(candidate) };
  }
  throw new Error("Invalid BS payroll month");
};

export type BsCalendarDay = {
  ad_date: string;
  bs_date: string;
  bs_day: number;
  day_type: "WORKING_DAY" | "WEEKLY_OFF";
};

export const bsFiscalYear = (bsMonth: string) => {
  const [year, month] = bsMonth.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) throw new Error("Invalid BS payroll month");
  return month >= 4 ? `${year}/${String((year + 1) % 100).padStart(2, "0")}` : `${year - 1}/${String(year % 100).padStart(2, "0")}`;
};

export const shiftBsMonth = (bsMonth: string, offset: number) => {
  const [year, month] = bsMonth.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12 || !Number.isInteger(offset)) throw new Error("Invalid BS payroll month");
  const shifted = year * 12 + month - 1 + offset;
  return `${Math.floor(shifted / 12)}-${String((shifted % 12 + 12) % 12 + 1).padStart(2, "0")}`;
};

export const getBsMonthCalendar = (value: string): BsCalendarDay[] => {
  const range = bsMonthToAdRange(value);
  const days: BsCalendarDay[] = [];
  for (let day = 1; day <= 32; day += 1) {
    const bsDate = `${value}-${String(day).padStart(2, "0")}`;
    if (!isValidBsDate(bsDate)) break;
    const adDate = bsToAd(bsDate);
    if (adDate < range.start || adDate > range.end) break;
    const isSaturday = new Date(`${adDate}T00:00:00Z`).getUTCDay() === 6;
    days.push({ ad_date: adDate, bs_date: bsDate, bs_day: day, day_type: isSaturday ? "WEEKLY_OFF" : "WORKING_DAY" });
  }
  if (days.length < 29 || days.length > 32) throw new Error("The selected BS month could not be generated safely");
  return days;
};
