export type ServiceCardRecord = {
  id: string;
  slug: string;
  icon_key: string;
  icon_image_url: string;
  title_primary_th: string;
  title_primary_en: string;
  title_secondary_th: string;
  title_secondary_en: string;
  details_th: string;
  details_en: string;
  info_heading_th: string;
  info_heading_en: string;
  info_lines_th: string;
  info_lines_en: string;
  note_lines_th: string;
  note_lines_en: string;
  duration_th: string;
  duration_en: string;
  price_lines: string[];
  extra_th: string;
  extra_en: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ServiceCardFormState = {
  id?: string;
  slug: string;
  icon_key: string;
  icon_image_url: string;
  title_primary_th: string;
  title_primary_en: string;
  title_secondary_th: string;
  title_secondary_en: string;
  details_th: string;
  details_en: string;
  info_heading_th: string;
  info_heading_en: string;
  info_lines_th: string;
  info_lines_en: string;
  note_lines_th: string;
  note_lines_en: string;
  duration_th: string;
  duration_en: string;
  price_from: string;
  price_to: string;
  extra_th: string;
  extra_en: string;
  sort_order: string;
  active: boolean;
};

export const serviceCardIconOptions = [
  { key: "consult1", label: "Individual / Counselling" },
  { key: "consult2", label: "Couple / Family" },
  { key: "consult3", label: "Assessment / Conditions" },
] as const;

export type ServiceCardDefaultContent = {
  info_heading_th: string;
  info_heading_en: string;
  info_lines_th: string;
  info_lines_en: string;
};

const serviceCardDefaultsByIcon: Record<string, ServiceCardDefaultContent> = {
  consult1: {
    info_heading_th: "ให้บริการโดย",
    info_heading_en: "Provided by",
    info_lines_th: "นักจิตวิทยาคลินิก\nผู้ได้รับการรับรองเป็นผู้ประกอบโรคศิลปะ\nสาขาจิตวิทยาคลินิก",
    info_lines_en:
      "Clinical psychologists\nlicensed health professionals\nin clinical psychology",
  },
  consult2: {
    info_heading_th: "ให้บริการโดย",
    info_heading_en: "Provided by",
    info_lines_th: "นักจิตวิทยาคลินิก\nผู้ได้รับการรับรองเป็นผู้ประกอบโรคศิลปะ\nสาขาจิตวิทยาคลินิก",
    info_lines_en:
      "Clinical psychologists\nlicensed health professionals\nin clinical psychology",
  },
  consult3: {
    info_heading_th: "เงื่อนไข",
    info_heading_en: "Conditions",
    info_lines_th: "ประเมินโดยนักจิตวิทยาคลินิก\nผู้ได้รับการรับรองเป็นผู้ประกอบโรคศิลปะ\nสาขาจิตวิทยาคลินิก",
    info_lines_en:
      "Assessed by clinical psychologists\nwho are licensed health professionals\nin clinical psychology",
  },
};

export function getServiceCardDefaults(iconKey: string): ServiceCardDefaultContent {
  return serviceCardDefaultsByIcon[iconKey] ?? serviceCardDefaultsByIcon[serviceCardIconOptions[0].key];
}

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function normalizeInlineText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeMultilineText(value: string) {
  return value
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function parseLineList(value: string) {
  const seen = new Set<string>();

  return value
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) {
        return false;
      }

      seen.add(item);
      return true;
    });
}

const durationUnitByLanguage = {
  th: "นาที",
  en: "mins",
} as const;

function stripDurationUnitFromLine(value: string, language: "th" | "en") {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (language === "th") {
    return trimmed.replace(/\s*นาที$/u, "").trim();
  }

  return trimmed.replace(/\s*mins?$/iu, "").trim();
}

export function durationLinesToFormValue(value: string, language: "th" | "en") {
  return value
    .split("\n")
    .map((line) => stripDurationUnitFromLine(line, language))
    .filter(Boolean)
    .join("\n");
}

export function durationLinesToStoredValue(value: string, language: "th" | "en") {
  const unit = durationUnitByLanguage[language];

  return value
    .split("\n")
    .map((line) => stripDurationUnitFromLine(line, language))
    .filter(Boolean)
    .map((line) => `${line} ${unit}`)
    .join("\n");
}

export function durationLinesForPreview(value: string, language: "th" | "en") {
  const unit = durationUnitByLanguage[language];

  return parseLineList(value).map((line) => {
    const normalized = stripDurationUnitFromLine(line, language);
    return normalized ? `${normalized} ${unit}` : "";
  });
}

function normalizePricePart(value: string) {
  return value.replace(/\s+/g, " ").replace(/-+/g, "-").trim().replace(/\s*-\s*/g, " - ");
}

export function priceLinesToFormValue(priceLines: string[] | null | undefined) {
  const joined = (priceLines ?? [])
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!joined) {
    return { price_from: "", price_to: "" };
  }

  const rangeMatch = joined.match(/^(.*?)\s*-\s*(.*?)$/);

  if (rangeMatch) {
    return {
      price_from: normalizePricePart(rangeMatch[1] ?? ""),
      price_to: normalizePricePart(rangeMatch[2] ?? ""),
    };
  }

  if ((priceLines ?? []).length > 1) {
    const [first, second] = (priceLines ?? []).map((line) => normalizePricePart(line));
    return {
      price_from: first.replace(/\s*-\s*$/, "").trim(),
      price_to: second ?? "",
    };
  }

  return { price_from: normalizePricePart(joined), price_to: "" };
}

export function priceFieldsToStoredLines(priceFrom: string, priceTo: string) {
  const from = normalizePricePart(priceFrom).replace(/\s*-\s*$/, "").trim();
  const to = normalizePricePart(priceTo).replace(/^\s*-\s*/, "").trim();

  if (!from && !to) {
    return [];
  }

  if (!to) {
    return [from];
  }

  return [`${from} -`, to];
}

export function priceFieldsToPreviewLines(priceFrom: string, priceTo: string) {
  return priceFieldsToStoredLines(priceFrom, priceTo);
}

export function serviceCardToForm(card: ServiceCardRecord): ServiceCardFormState {
  const defaults = getServiceCardDefaults(card.icon_key);
  const price = priceLinesToFormValue(card.price_lines);

  return {
    id: card.id,
    slug: card.slug,
    icon_key: card.icon_key,
    icon_image_url: card.icon_image_url || "",
    title_primary_th: card.title_primary_th,
    title_primary_en: card.title_primary_en,
    title_secondary_th: card.title_secondary_th,
    title_secondary_en: card.title_secondary_en,
    details_th: card.details_th,
    details_en: card.details_en,
    info_heading_th: card.info_heading_th || defaults.info_heading_th,
    info_heading_en: card.info_heading_en || defaults.info_heading_en,
    info_lines_th: card.info_lines_th || defaults.info_lines_th,
    info_lines_en: card.info_lines_en || defaults.info_lines_en,
    note_lines_th: card.note_lines_th,
    note_lines_en: card.note_lines_en,
    duration_th: durationLinesToFormValue(card.duration_th, "th"),
    duration_en: durationLinesToFormValue(card.duration_en, "en"),
    price_from: price.price_from,
    price_to: price.price_to,
    extra_th: card.extra_th,
    extra_en: card.extra_en,
    sort_order: String(card.sort_order),
    active: card.active,
  };
}

export const emptyServiceCardForm = (sortOrder = 0): ServiceCardFormState => ({
  ...getServiceCardDefaults(serviceCardIconOptions[0].key),
  slug: "",
  icon_key: serviceCardIconOptions[0].key,
  icon_image_url: "",
  title_primary_th: "",
  title_primary_en: "",
  title_secondary_th: "",
  title_secondary_en: "",
  details_th: "",
  details_en: "",
  note_lines_th: "",
  note_lines_en: "",
  duration_th: "",
  duration_en: "",
  price_from: "",
  price_to: "",
  extra_th: "",
  extra_en: "",
  sort_order: String(sortOrder),
  active: true,
});

function shortenText(value: string, maxLength = 140) {
  const compact = value.replace(/\s+/g, " ").trim();

  if (!compact) {
    return "";
  }

  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 1).trimEnd()}...`;
}

export function getServiceCardPreviewText(
  detailsEn: string,
  detailsTh: string,
  language: "th" | "en" = "en",
  fallback = "No preview text yet.",
) {
  const source = language === "th" ? detailsTh || detailsEn : detailsEn || detailsTh;
  return shortenText(source || fallback);
}

export function formatDateTime(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
