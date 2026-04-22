export type BlogStatus = "draft" | "published" | "archived";

export type BlogPost = {
  id: string;
  slug: string;
  title_th: string;
  title_en: string;
  excerpt_th: string | null;
  excerpt_en: string | null;
  content_th: string;
  content_en: string;
  cover_image_url: string;
  youtube_url: string | null;
  status: BlogStatus;
  published_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type BlogFormState = {
  id?: string;
  slug: string;
  title_th: string;
  title_en: string;
  content_th: string;
  content_en: string;
  cover_image_url: string;
  youtube_url: string;
  status: BlogStatus;
  sort_order: string;
};

export function postToForm(post: BlogPost): BlogFormState {
  return {
    id: post.id,
    slug: post.slug,
    title_th: post.title_th,
    title_en: post.title_en,
    content_th: post.content_th,
    content_en: post.content_en,
    cover_image_url: post.cover_image_url,
    youtube_url: post.youtube_url ?? "",
    status: post.status,
    sort_order: String(post.sort_order),
  };
}

export const emptyForm = (sortOrder = 0): BlogFormState => ({
  slug: "",
  title_th: "",
  title_en: "",
  content_th: "",
  content_en: "",
  cover_image_url: "",
  youtube_url: "",
  status: "draft",
  sort_order: String(sortOrder),
});

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function statusLabel(status: BlogStatus) {
  switch (status) {
    case "published":
      return "Published";
    case "archived":
      return "Archived";
    default:
      return "Draft";
  }
}

export function statusClass(status: BlogStatus) {
  switch (status) {
    case "published":
      return "badge success";
    case "archived":
      return "badge neutral";
    default:
      return "badge warning";
  }
}

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

export function getBlogPreviewText(
  contentEn: string,
  contentTh: string,
  language: "th" | "en" = "en",
  fallback = "No preview text yet.",
) {
  const source = language === "th" ? contentTh || contentEn : contentEn || contentTh;
  return shortenText(source || fallback);
}
