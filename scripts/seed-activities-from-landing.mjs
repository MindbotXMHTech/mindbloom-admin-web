import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adminRoot = path.resolve(__dirname, "..");
const landingRoot = path.resolve(adminRoot, "../mindbloom-landing-page");
const envPath = path.join(adminRoot, ".env.local");
const imageRoot = path.join(landingRoot, "src/assets/images");

function readEnvFile(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        return [key, value];
      }),
  );
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function toPublishedAt(eventDate) {
  return `${eventDate}T05:00:00.000Z`;
}

const seedActivities = [
  {
    slug: slugify("MindBloom Gallery"),
    title_th: "MindBloom Gallery",
    title_en: "MindBloom Gallery",
    summary_th: "นิทรรศการผลงานจากผู้ที่มีประสบการณ์ด้านสุขภาพจิต",
    summary_en: "An exhibition featuring works by people with lived mental health experience",
    content_th:
      "นิทรรศการผลงานจากผู้ที่มีประสบการณ์ด้านสุขภาพจิต ที่ชวนให้สังคมมองโรคทางใจด้วยความเข้าใจ พร้อมกิจกรรมเวิร์กชอปและการสนับสนุนผลงานตลอด 3 สัปดาห์",
    content_en:
      "An exhibition of work by people with lived mental health experiences, inviting society to see emotional struggles with greater understanding, alongside workshops and ongoing support for the artworks over three weeks.",
    event_date: "2025-01-12",
    sort_order: 0,
    coverFile: "gal5.jpg",
    galleryFiles: [
      "gal1.jpg",
      "gal2.jpg",
      "gal3.jpg",
      "gal4.jpg",
      "gal5.jpg",
      "gal6.jpg",
      "gal7.jpg",
      "gal8.jpg",
      "gal9.jpg",
      "gal10.jpg",
      "gal11.jpg",
      "gal12.jpg",
      "gal13.jpg",
      "gal14.jpg",
      "gal15.jpg",
    ],
  },
  {
    slug: slugify("Mindbloom Opening and Exhibition"),
    title_th: "Mindbloom Opening and Exhibition",
    title_en: "Mindbloom Opening and Exhibition",
    summary_th: "ขอบคุณที่มาสร้างความอบอุ่นให้สวนดอกไม้แห่งนี้ด้วยกัน",
    summary_en: "Thank you for helping create warmth in this flower garden together.",
    content_th: "ขอบคุณที่มาสร้างความอบอุ่นให้สวนดอกไม้แห่งนี้ด้วยกัน",
    content_en: "Thank you for helping fill this flower garden with warmth together.",
    event_date: "2025-01-26",
    sort_order: 1,
    coverFile: "act-1.png",
    galleryFiles: [
      "act-1.png",
      "act-2.png",
      "act-3.png",
      "act-4.png",
      "act-5.png",
      "act-6.png",
    ],
  },
  {
    slug: slugify("To the Unknown: Month of Love"),
    title_th: "To the unknown เดือนแห่งความรัก",
    title_en: "To the Unknown: Month of Love",
    summary_th: "MindBloom พาทุกคนไปรู้จักอีกมุมของชีวิต ณ ทัณฑสถานหญิงกลาง",
    summary_en:
      "MindBloom invited everyone to witness another side of life at the Central Women's Correctional Institution.",
    content_th: "พร้อมเปิดรับบริจาคหนังสือและจัดเวิร์กชอปดูแลใจ เพื่อส่งต่อความรักและกำลังใจ",
    content_en:
      "Featuring a book donation drive and mental wellbeing workshops to pass on love and encouragement.",
    event_date: "2025-01-26",
    sort_order: 2,
    coverFile: "un4.jpg",
    galleryFiles: [
      "un1.jpg",
      "un2.jpg",
      "un3.jpg",
      "un4.jpg",
      "un5.jpg",
      "un6.jpg",
      "un7.jpg",
      "un8.jpg",
    ],
  },
];

async function uploadImage(supabase, slug, fileName) {
  const absolutePath = path.join(imageRoot, fileName);
  const fileBuffer = await fs.readFile(absolutePath);
  const storagePath = `activities/${slug}/${fileName}`;
  const extension = path.extname(fileName).slice(1).toLowerCase() || "jpg";
  const contentType =
    extension === "png"
      ? "image/png"
      : extension === "webp"
        ? "image/webp"
        : "image/jpeg";

  const { error: uploadError } = await supabase.storage
    .from("content-images")
    .upload(storagePath, fileBuffer, {
      upsert: true,
      cacheControl: "3600",
      contentType,
    });

  if (uploadError) {
    throw new Error(`Upload failed for ${fileName}: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from("content-images").getPublicUrl(storagePath);
  return data.publicUrl;
}

async function main() {
  const envContents = await fs.readFile(envPath, "utf8");
  const env = readEnvFile(envContents);
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase URL or service role key in .env.local");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rows = [];

  for (const activity of seedActivities) {
    const uploadedUrls = new Map();

    for (const fileName of new Set([activity.coverFile, ...activity.galleryFiles])) {
      uploadedUrls.set(fileName, await uploadImage(supabase, activity.slug, fileName));
    }

    rows.push({
      slug: activity.slug,
      title_th: activity.title_th,
      title_en: activity.title_en,
      summary_th: activity.summary_th,
      summary_en: activity.summary_en,
      content_th: activity.content_th,
      content_en: activity.content_en,
      cover_image_url: uploadedUrls.get(activity.coverFile),
      gallery_image_urls: activity.galleryFiles.map((fileName) => uploadedUrls.get(fileName)),
      youtube_url: null,
      event_date: activity.event_date,
      status: "published",
      published_at: toPublishedAt(activity.event_date),
      sort_order: activity.sort_order,
    });
  }

  const { error } = await supabase
    .from("activities")
    .upsert(rows, { onConflict: "slug" });

  if (error) {
    throw new Error(`Unable to seed activities: ${error.message}`);
  }

  console.log(`Seeded ${rows.length} activities and uploaded gallery assets.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
