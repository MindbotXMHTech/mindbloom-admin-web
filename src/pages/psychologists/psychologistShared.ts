type LocalizedText = {
  th: string;
  en: string;
};

export type PsychologistTopicKey =
  | "relationships"
  | "adjustment"
  | "emotions"
  | "behavior"
  | "thinking"
  | "personality"
  | "stress"
  | "depression"
  | "work";

export const psychologistTopicOptions: Array<{
  key: PsychologistTopicKey;
  label: LocalizedText;
}> = [
  { key: "relationships", label: { th: "ความสัมพันธ์", en: "Relationships" } },
  { key: "adjustment", label: { th: "การปรับตัว", en: "Adjustment" } },
  { key: "emotions", label: { th: "อารมณ์", en: "Emotions" } },
  { key: "behavior", label: { th: "พฤติกรรม", en: "Behavior" } },
  { key: "thinking", label: { th: "ปัญหาความคิด", en: "Thought patterns" } },
  { key: "personality", label: { th: "บุคลิกภาพ", en: "Personality" } },
  { key: "stress", label: { th: "ความเครียด", en: "Stress" } },
  { key: "depression", label: { th: "ซึมเศร้า", en: "Depression" } },
  { key: "work", label: { th: "การงาน", en: "Work" } },
];

export type PsychologistRecord = {
  id: string;
  slug: string;
  name_th: string;
  name_en: string;
  nickname_th: string;
  nickname_en: string;
  license_no: string;
  photo_url: string;
  approach_th: string;
  approach_en: string;
  value_th: string;
  value_en: string;
  quote_th: string;
  quote_en: string;
  topics: string[];
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PsychologistFormState = {
  id: string;
  slug: string;
  name_th: string;
  name_en: string;
  nickname_th: string;
  nickname_en: string;
  license_no: string;
  photo_url: string;
  approach_th: string;
  approach_en: string;
  value_th: string;
  value_en: string;
  quote_th: string;
  quote_en: string;
  topics: PsychologistTopicKey[];
  active: boolean;
  sort_order: number;
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9ก-๙]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeLicenseNumber(value: string) {
  return value
    .replace(/^จค\.\s*/i, "")
    .replace(/[^0-9]/g, "")
    .trim();
}

export function formatLicenseNumber(value: string, language: "th" | "en" = "th") {
  const cleaned = normalizeLicenseNumber(value);
  if (!cleaned) return "";
  return language === "th" ? `จค. ${cleaned}` : `Lic. No. ${cleaned}`;
}

export function emptyPsychologistForm(sortOrder = 0): PsychologistFormState {
  return {
    id: "",
    slug: "",
    name_th: "",
    name_en: "",
    nickname_th: "",
    nickname_en: "",
    license_no: "",
    photo_url: "",
    approach_th: "",
    approach_en: "",
    value_th: "",
    value_en: "",
    quote_th: "",
    quote_en: "",
    topics: [],
    active: true,
    sort_order: sortOrder,
  };
}

export function psychologistToForm(row: PsychologistRecord): PsychologistFormState {
  return {
    id: row.id,
    slug: row.slug,
    name_th: row.name_th,
    name_en: row.name_en,
    nickname_th: row.nickname_th,
    nickname_en: row.nickname_en,
    license_no: normalizeLicenseNumber(row.license_no),
    photo_url: row.photo_url,
    approach_th: row.approach_th,
    approach_en: row.approach_en,
    value_th: row.value_th,
    value_en: row.value_en,
    quote_th: row.quote_th,
    quote_en: row.quote_en,
    topics: row.topics.filter((topic): topic is PsychologistTopicKey =>
      psychologistTopicOptions.some((option) => option.key === topic),
    ),
    active: row.active,
    sort_order: row.sort_order,
  };
}

export function formatPsychologistName(row: PsychologistRecord) {
  return normalizeWhitespace(row.name_th) || normalizeWhitespace(row.name_en) || "Untitled";
}
