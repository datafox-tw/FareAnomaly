// Destination & origin metadata — PRD §8.2 / §13 MVP route coverage.

export type Region =
  | "日本"
  | "韓國"
  | "東南亞"
  | "港澳"
  | "北美"
  | "歐洲";

export type HotelCost = "low" | "mid" | "high";

export interface Airport {
  code: string;
  city: string;
  country: string;
  region: Region;
  tzOffset: number; // hours from UTC
  visaNote: string;
  hotelCost: HotelCost;
  weekendSuitable: boolean; // good for a Fri-night / Sun-Mon short trip
  tags: string[];
  /** Typical round-trip baseline from TPE in NT$ — used to seed fake history. */
  baseFare: number;
  /** Typical non-stop flight time one-way, minutes. */
  baseDuration: number;
}

export const ORIGINS = ["TPE", "TSA", "KHH"] as const;
export type Origin = (typeof ORIGINS)[number];

export const ORIGIN_LABEL: Record<Origin, string> = {
  TPE: "台北桃園 (TPE)",
  TSA: "台北松山 (TSA)",
  KHH: "高雄 (KHH)",
};

export const REGIONS: Region[] = [
  "日本",
  "韓國",
  "東南亞",
  "港澳",
  "北美",
  "歐洲",
];

export const AIRPORTS: Airport[] = [
  // 日本
  { code: "NRT", city: "東京成田", country: "日本", region: "日本", tzOffset: 9, visaNote: "免簽 90 天", hotelCost: "high", weekendSuitable: true, tags: ["city", "food", "shopping"], baseFare: 11000, baseDuration: 200 },
  { code: "HND", city: "東京羽田", country: "日本", region: "日本", tzOffset: 9, visaNote: "免簽 90 天", hotelCost: "high", weekendSuitable: true, tags: ["city", "food"], baseFare: 12000, baseDuration: 195 },
  { code: "KIX", city: "大阪關西", country: "日本", region: "日本", tzOffset: 9, visaNote: "免簽 90 天", hotelCost: "mid", weekendSuitable: true, tags: ["city", "food"], baseFare: 9500, baseDuration: 175 },
  { code: "FUK", city: "福岡", country: "日本", region: "日本", tzOffset: 9, visaNote: "免簽 90 天", hotelCost: "mid", weekendSuitable: true, tags: ["food", "city", "cheap"], baseFare: 8500, baseDuration: 150 },
  { code: "CTS", city: "札幌新千歲", country: "日本", region: "日本", tzOffset: 9, visaNote: "免簽 90 天", hotelCost: "mid", weekendSuitable: false, tags: ["nature", "ski", "food"], baseFare: 13000, baseDuration: 240 },
  { code: "OKA", city: "沖繩那霸", country: "日本", region: "日本", tzOffset: 9, visaNote: "免簽 90 天", hotelCost: "mid", weekendSuitable: true, tags: ["beach", "nature"], baseFare: 8000, baseDuration: 110 },
  { code: "NGO", city: "名古屋中部", country: "日本", region: "日本", tzOffset: 9, visaNote: "免簽 90 天", hotelCost: "mid", weekendSuitable: true, tags: ["city", "food"], baseFare: 9000, baseDuration: 180 },

  // 韓國
  { code: "ICN", city: "首爾仁川", country: "韓國", region: "韓國", tzOffset: 9, visaNote: "免簽 90 天 (需 K-ETA)", hotelCost: "mid", weekendSuitable: true, tags: ["city", "food", "shopping"], baseFare: 8000, baseDuration: 155 },
  { code: "GMP", city: "首爾金浦", country: "韓國", region: "韓國", tzOffset: 9, visaNote: "免簽 90 天 (需 K-ETA)", hotelCost: "mid", weekendSuitable: true, tags: ["city", "food"], baseFare: 8500, baseDuration: 155 },
  { code: "PUS", city: "釜山", country: "韓國", region: "韓國", tzOffset: 9, visaNote: "免簽 90 天 (需 K-ETA)", hotelCost: "low", weekendSuitable: true, tags: ["beach", "food", "cheap"], baseFare: 7500, baseDuration: 140 },
  { code: "CJU", city: "濟州", country: "韓國", region: "韓國", tzOffset: 9, visaNote: "免簽 30 天", hotelCost: "mid", weekendSuitable: false, tags: ["nature", "beach"], baseFare: 9000, baseDuration: 130 },

  // 東南亞
  { code: "BKK", city: "曼谷蘇凡納布", country: "泰國", region: "東南亞", tzOffset: 7, visaNote: "免簽 30 天", hotelCost: "low", weekendSuitable: false, tags: ["city", "food", "cheap"], baseFare: 9500, baseDuration: 230 },
  { code: "DMK", city: "曼谷廊曼", country: "泰國", region: "東南亞", tzOffset: 7, visaNote: "免簽 30 天", hotelCost: "low", weekendSuitable: false, tags: ["city", "cheap"], baseFare: 8500, baseDuration: 230 },
  { code: "SIN", city: "新加坡樟宜", country: "新加坡", region: "東南亞", tzOffset: 8, visaNote: "免簽 30 天", hotelCost: "high", weekendSuitable: false, tags: ["city", "food", "expensive"], baseFare: 11000, baseDuration: 280 },
  { code: "KUL", city: "吉隆坡", country: "馬來西亞", region: "東南亞", tzOffset: 8, visaNote: "免簽 30 天", hotelCost: "low", weekendSuitable: false, tags: ["city", "food", "cheap"], baseFare: 10500, baseDuration: 280 },
  { code: "SGN", city: "胡志明市", country: "越南", region: "東南亞", tzOffset: 7, visaNote: "免簽 45 天", hotelCost: "low", weekendSuitable: false, tags: ["food", "city", "cheap"], baseFare: 8500, baseDuration: 210 },
  { code: "HAN", city: "河內", country: "越南", region: "東南亞", tzOffset: 7, visaNote: "免簽 45 天", hotelCost: "low", weekendSuitable: false, tags: ["food", "nature", "cheap"], baseFare: 8000, baseDuration: 200 },
  { code: "DAD", city: "峴港", country: "越南", region: "東南亞", tzOffset: 7, visaNote: "免簽 45 天", hotelCost: "low", weekendSuitable: false, tags: ["beach", "cheap"], baseFare: 7500, baseDuration: 175 },
  { code: "MNL", city: "馬尼拉", country: "菲律賓", region: "東南亞", tzOffset: 8, visaNote: "免簽 30 天", hotelCost: "low", weekendSuitable: false, tags: ["beach", "city", "cheap"], baseFare: 8000, baseDuration: 130 },
  { code: "CEB", city: "宿霧", country: "菲律賓", region: "東南亞", tzOffset: 8, visaNote: "免簽 30 天", hotelCost: "low", weekendSuitable: false, tags: ["beach", "nature", "cheap"], baseFare: 8500, baseDuration: 175 },

  // 港澳
  { code: "HKG", city: "香港", country: "香港", region: "港澳", tzOffset: 8, visaNote: "免簽 30 天", hotelCost: "high", weekendSuitable: true, tags: ["city", "food", "shopping"], baseFare: 6500, baseDuration: 95 },
  { code: "MFM", city: "澳門", country: "澳門", region: "港澳", tzOffset: 8, visaNote: "免簽 30 天", hotelCost: "mid", weekendSuitable: true, tags: ["city", "food"], baseFare: 6000, baseDuration: 95 },

  // 北美 (長途少量測試)
  { code: "LAX", city: "洛杉磯", country: "美國", region: "北美", tzOffset: -7, visaNote: "需 ESTA / 簽證", hotelCost: "high", weekendSuitable: false, tags: ["city", "expensive"], baseFare: 32000, baseDuration: 720 },
  { code: "SFO", city: "舊金山", country: "美國", region: "北美", tzOffset: -7, visaNote: "需 ESTA / 簽證", hotelCost: "high", weekendSuitable: false, tags: ["city", "expensive"], baseFare: 33000, baseDuration: 700 },
  { code: "YVR", city: "溫哥華", country: "加拿大", region: "北美", tzOffset: -7, visaNote: "需 eTA", hotelCost: "high", weekendSuitable: false, tags: ["nature", "city"], baseFare: 30000, baseDuration: 660 },

  // 歐洲 (長途少量測試)
  { code: "LHR", city: "倫敦", country: "英國", region: "歐洲", tzOffset: 1, visaNote: "免簽 6 個月", hotelCost: "high", weekendSuitable: false, tags: ["city", "expensive"], baseFare: 30000, baseDuration: 900 },
  { code: "CDG", city: "巴黎", country: "法國", region: "歐洲", tzOffset: 2, visaNote: "申根免簽 90 天", hotelCost: "high", weekendSuitable: false, tags: ["city", "expensive"], baseFare: 29000, baseDuration: 870 },
  { code: "AMS", city: "阿姆斯特丹", country: "荷蘭", region: "歐洲", tzOffset: 2, visaNote: "申根免簽 90 天", hotelCost: "high", weekendSuitable: false, tags: ["city", "nature"], baseFare: 28000, baseDuration: 850 },
  { code: "HEL", city: "赫爾辛基", country: "芬蘭", region: "歐洲", tzOffset: 3, visaNote: "申根免簽 90 天", hotelCost: "high", weekendSuitable: false, tags: ["nature", "city"], baseFare: 27000, baseDuration: 800 },
];

export const AIRPORT_BY_CODE: Record<string, Airport> = Object.fromEntries(
  AIRPORTS.map((a) => [a.code, a]),
);
