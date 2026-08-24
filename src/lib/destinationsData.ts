export interface DestinationCountry {
  name: string;
  code: string;
  currency: string;
  dialCode: string;
  popularIntakes: string[];
}

export const AECS_AUTHORIZED_COUNTRIES: DestinationCountry[] = [
  {
    name: "Australia",
    code: "AU",
    currency: "AUD",
    dialCode: "+61",
    popularIntakes: ["February", "July", "November"],
  },
  {
    name: "United Kingdom",
    code: "GB",
    currency: "GBP",
    dialCode: "+44",
    popularIntakes: ["September", "January", "May"],
  },
  {
    name: "United States",
    code: "US",
    currency: "USD",
    dialCode: "+1",
    popularIntakes: ["Fall (August/September)", "Spring (January)", "Summer (May)"],
  },
  {
    name: "New Zealand",
    code: "NZ",
    currency: "NZD",
    dialCode: "+64",
    popularIntakes: ["February", "July", "November"],
  },
  {
    name: "Canada",
    code: "CA",
    currency: "CAD",
    dialCode: "+1",
    popularIntakes: ["Fall (September)", "Winter (January)", "Summer (May)"],
  },
  {
    name: "Germany",
    code: "DE",
    currency: "EUR",
    dialCode: "+49",
    popularIntakes: ["Winter (September/October)", "Summer (March/April)"],
  },
  {
    name: "Finland",
    code: "FI",
    currency: "EUR",
    dialCode: "+358",
    popularIntakes: ["Autumn (August/September)", "Spring (January)"],
  },
  {
    name: "Malta",
    code: "MT",
    currency: "EUR",
    dialCode: "+356",
    popularIntakes: ["October", "February", "June"],
  },
  {
    name: "Cyprus",
    code: "CY",
    currency: "EUR",
    dialCode: "+357",
    popularIntakes: ["Fall (October)", "Spring (February)", "Summer (June)"],
  },
  {
    name: "Hungary",
    code: "HU",
    currency: "HUF",
    dialCode: "+36",
    popularIntakes: ["September", "February"],
  },
  {
    name: "Japan",
    code: "JP",
    currency: "JPY",
    dialCode: "+81",
    popularIntakes: ["April", "October", "July", "January"],
  },
  {
    name: "South Korea",
    code: "KR",
    currency: "KRW",
    dialCode: "+82",
    popularIntakes: ["Spring (March)", "Fall (September)"],
  },
];

export const MONTHS = [
  { short: "Jan", full: "January", num: 1 },
  { short: "Feb", full: "February", num: 2 },
  { short: "Mar", full: "March", num: 3 },
  { short: "Apr", full: "April", num: 4 },
  { short: "May", full: "May", num: 5 },
  { short: "Jun", full: "June", num: 6 },
  { short: "Jul", full: "July", num: 7 },
  { short: "Aug", full: "August", num: 8 },
  { short: "Sep", full: "September", num: 9 },
  { short: "Oct", full: "October", num: 10 },
  { short: "Nov", full: "November", num: 11 },
  { short: "Dec", full: "December", num: 12 },
];

export const INTAKE_YEARS = [2026, 2027, 2028, 2029, 2030];
