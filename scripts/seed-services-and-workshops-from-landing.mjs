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

const serviceCards = [
  {
    slug: "individual-psychotherapy-counselling",
    icon_key: "consult1",
    title_primary_th: "จิตบำบัด ให้คำปรึกษารายบุคคล",
    title_primary_en: "Individual Psychotherapy / Counselling",
    title_secondary_th: "(Individual Psychotherapy/ Counselling)",
    title_secondary_en: "One-on-one psychological support",
    details_th: [
      "การพูดคุยแบบตัวต่อตัวกับนักจิตวิทยา",
      "เพื่อทำความเข้าใจความคิด อารมณ์ และพฤติกรรมของตนเองอย่างลึกซึ้ง",
      "พร้อมเรียนรู้วิธีดูแลใจและรับมือกับปัญหาในชีวิตได้อย่างเหมาะสม",
    ],
    details_en: [
      "One-on-one conversations with a psychologist",
      "to better understand your thoughts, emotions, and behaviors in depth",
      "while learning healthier ways to care for yourself and cope with life challenges",
    ],
    info_heading_th: "ให้บริการโดย",
    info_heading_en: "Provided by",
    info_lines_th: [
      "นักจิตวิทยาคลินิก",
      "ผู้ได้รับการรับรองเป็นผู้ประกอบโรคศิลปะ",
      "สาขาจิตวิทยาคลินิก",
    ],
    info_lines_en: [
      "Clinical psychologists",
      "licensed health professionals",
      "in clinical psychology",
    ],
    note_lines_th: [
      "มีประสบการณ์ในการให้คำปรึกษา",
      "และบำบัดทางจิตวิทยา",
    ],
    note_lines_en: [
      "Experienced in counselling",
      "and psychological therapy",
    ],
    duration_th: ["60 นาที"],
    duration_en: ["60 mins"],
    price_lines: ["2,000"],
    extra_th: "เพิ่มเวลา 30 นาที/1,000 บาท",
    extra_en: "Add 30 mins / 1,000 THB",
    sort_order: 0,
  },
  {
    slug: "couple-family-therapy",
    icon_key: "consult2",
    title_primary_th: "การบำบัดคู่/ครอบครัว",
    title_primary_en: "Couple / Family Therapy",
    title_secondary_th: "(Couple/Family Therapy)",
    title_secondary_en: "Relationship-focused sessions",
    details_th: [
      "การบำบัด/ให้คำปรึกษาที่ช่วยให้คนในความสัมพันธ์เข้าใจกันมากขึ้น สื่อสารดีขึ้น และจัดการความขัดแย้งอย่างสร้างสรรค์ เพื่อความสัมพันธ์ที่มั่นคงและอบอุ่นขึ้น",
    ],
    details_en: [
      "Therapy and counselling that help people in relationships understand one another better, communicate more effectively, and navigate conflict constructively for a more secure and caring relationship.",
    ],
    info_heading_th: "ให้บริการโดย",
    info_heading_en: "Provided by",
    info_lines_th: [
      "นักจิตวิทยาคลินิก",
      "ผู้ได้รับการรับรองเป็นผู้ประกอบโรคศิลปะ",
      "สาขาจิตวิทยาคลินิก",
    ],
    info_lines_en: [
      "Clinical psychologists",
      "licensed health professionals",
      "in clinical psychology",
    ],
    note_lines_th: [
      "มีประสบการณ์ในการให้คำปรึกษา",
      "แบบคู่ ครอบครัว",
      "เพื่อทางออกร่วมกันในความสัมพันธ์",
    ],
    note_lines_en: [
      "Experienced in counselling",
      "for couples and families",
      "to support shared solutions in relationships",
    ],
    duration_th: ["90 นาที"],
    duration_en: ["90 mins"],
    price_lines: ["3,500"],
    extra_th: "เพิ่มเวลา 30 นาที/1,166 บาท",
    extra_en: "Add 30 mins / 1,166 THB",
    sort_order: 1,
  },
  {
    slug: "psychological-assessment",
    icon_key: "consult3",
    title_primary_th: "การตรวจประเมินทางจิตวิทยา",
    title_primary_en: "Psychological Assessment",
    title_secondary_th: "(Psychological Assessment)",
    title_secondary_en: "Structured psychological evaluation",
    details_th: [
      "กระบวนการใช้แบบทดสอบและการสัมภาษณ์เพื่อทำความเข้าใจสภาพจิตใจ บุคลิกภาพ และการทำงานของความคิดอย่างเป็นระบบ เพื่อนำไปวางแผนการดูแลหรือพัฒนาต่อไป (ติดต่อมายด์บลูมเพื่อสอบถามค่าบริการ)",
    ],
    details_en: [
      "A structured process using tests and interviews to understand mental health, personality, and cognitive functioning in order to guide future care or development planning. Please contact MindBloom for pricing details.",
    ],
    info_heading_th: "เงื่อนไข",
    info_heading_en: "Conditions",
    info_lines_th: [
      "ประเมินโดยนักจิตวิทยาคลินิก",
      "ผู้ได้รับการรับรองเป็นผู้ประกอบโรคศิลปะ",
      "สาขาจิตวิทยาคลินิก",
    ],
    info_lines_en: [
      "Assessed by clinical psychologists",
      "who are licensed health professionals",
      "in clinical psychology",
    ],
    note_lines_th: [
      "โดยต้องได้รับเอกสารส่งตัว/",
      "ใบแพทย์สั่งประเมินเท่านั้น",
      "แจ้งผลประเมินแก่ต้นสังกัด/หน่วยงานส่งตัว",
    ],
    note_lines_en: [
      "Requires referral documents",
      "or a physician's order for assessment",
      "Results can be reported to the referring organization",
    ],
    duration_th: ["60-120 นาที"],
    duration_en: ["60-120 mins"],
    price_lines: ["3,250 -", "4,550"],
    extra_th: "",
    extra_en: "",
    sort_order: 2,
  },
];

const workshopCategories = [
  {
    slug: "preventive-and-awareness",
    title_th: "Preventive & Awareness",
    title_en: "Preventive & Awareness",
    subtitle_th: "สร้างความตระหนักรู้ และป้องกันก่อนจะสาย",
    subtitle_en: "Build awareness and support prevention early",
    sort_order: 0,
  },
  {
    slug: "team-and-leadership",
    title_th: "Team & Leadership",
    title_en: "Team & Leadership",
    subtitle_th: "เสริมพลังทีม และพัฒนาภาวะผู้นำที่ใส่ใจ",
    subtitle_en: "Strengthen teams and nurture caring leadership",
    sort_order: 1,
  },
  {
    slug: "self-awareness-and-personal-growth",
    title_th: "Self-Awareness & Personal Growth",
    title_en: "Self-Awareness & Personal Growth",
    subtitle_th: "ค้นพบตัวเอง พร้อมเติบโตจากข้างใน",
    subtitle_en: "Discover yourself and grow from within",
    sort_order: 2,
  },
];

const workshopPrograms = [
  {
    slug: "psychological-first-aid",
    category_slug: "preventive-and-awareness",
    title_th: "Psychological First Aid (PFA)",
    title_en: "Psychological First Aid (PFA)",
    summary_th:
      "เรียนรู้หลักการให้ความช่วยเหลือเบื้องต้นทางจิตใจในภาวะวิกฤติ เพื่อเสริมทักษะการดูแลใจตนเองและผู้อื่นในช่วงวิกฤตทางใจ",
    summary_en:
      "Learn the principles of psychological first aid in times of crisis, with practical ways to care for yourself and others during emotionally difficult moments.",
    content_th:
      "เรียนรู้หลักการ PFA ที่นำไปใช้ได้จริง ช่วยป้องกันปัญหาสุขภาพจิต รักษาศักยภาพบุคลากร และสร้างบรรยากาศปลอดภัยทางใจในองค์กร พร้อมทักษะรับมือความเครียดอย่างเหมาะสม โดยนักจิตวิทยาคลินิกผู้เชี่ยวชาญด้านสุขภาพจิต",
    content_en:
      "This workshop offers practical PFA skills that help prevent mental health difficulties, sustain team capacity, and build psychologically safe workplaces, guided by clinical psychologists with mental health expertise.",
    gallery_files: ["ws1.png", "ws2.png", "ws3.png", "ws4.png", "ws5.png", "ws6.png"],
    gallery_style: "square",
    show_cta: false,
    sort_order: 0,
  },
  {
    slug: "stress-management",
    category_slug: "preventive-and-awareness",
    title_th: "Stress Management",
    title_en: "Stress Management",
    summary_th:
      "เรียนรู้และฝึกทักษะการจัดการความเครียดและอารมณ์แง่ลบที่รบกวนศักยภาพในการทำงานและการใช้ชีวิต โดยออกแบบและดำเนินกิจกรรมโดยนักจิตวิทยาคลินิก",
    summary_en:
      "Learn and practice skills for managing stress and difficult emotions that affect work performance and daily life, through activities designed and facilitated by clinical psychologists.",
    content_th:
      "เวิร์กชอปนี้มุ่งเสริมสร้างความยืดหยุ่นทางจิตใจ (Resilience) และสุขภาวะที่ยั่งยืน ผ่านทักษะการจัดการความเครียดตามหลักจิตวิทยา ไม่เพียงช่วยบรรเทาความเครียดในระยะสั้น แต่ยังช่วยเสริมสร้างศักยภาพภายใน เพื่อให้ผู้เข้าร่วมสามารถรับมือกับแรงกดดันและความท้าทายได้อย่างมีประสิทธิภาพ ทั้งในบริบทของการทำงานและชีวิตประจำวัน",
    content_en:
      "This workshop strengthens resilience and sustainable wellbeing through evidence-based stress management skills. It supports not only short-term relief, but also long-term inner capacity for handling pressure and challenges effectively at work and in life.",
    gallery_files: ["ws13.png", "ws14.png", "ws15.png"],
    gallery_style: "landscape",
    show_cta: true,
    sort_order: 1,
  },
  {
    slug: "creative-work-for-team-communication",
    category_slug: "team-and-leadership",
    title_th: "Creative work for team communication",
    title_en: "Creative work for team communication",
    summary_th:
      "มุ่งเน้นการทำความเข้าใจ ทั้งความเหมือนและความแตกต่างของแต่ละบุคคล เพื่อส่งเสริมการสื่อสารที่ตั้งอยู่บนความเข้าใจและความเห็นอกเห็นใจกัน",
    summary_en:
      "Focused on understanding both similarities and differences between people in order to encourage communication grounded in empathy and mutual understanding.",
    content_th:
      "กระบวนการที่ออกแบบอย่างสร้างสรรค์นี้ช่วยพัฒนาการสื่อสารเชิงบวกในทีม โดยกระตุ้นทั้งมิติของความคิดและอารมณ์ ภายใต้การดูแลของนักจิตวิทยาคลินิก เพื่อเสริมสร้างความเข้าใจระหว่างกัน ลดความขัดแย้ง และสร้างพลังบวกในการทำงานร่วมกันอย่างมีประสิทธิภาพและกลมกลืน",
    content_en:
      "This creatively designed process supports more positive team communication by engaging both thinking and emotional awareness, under the guidance of clinical psychologists, to reduce conflict and strengthen collaborative energy.",
    gallery_files: ["ws7.png", "ws8.png", "ws9.png"],
    gallery_style: "landscape",
    show_cta: false,
    sort_order: 0,
  },
  {
    slug: "communication-skill",
    category_slug: "team-and-leadership",
    title_th: "Communication skill",
    title_en: "Communication skill",
    summary_th: "เวิร์กช็อปเพื่อพัฒนาทักษะการสื่อสารอย่างมีประสิทธิภาพ",
    summary_en: "A workshop for building effective communication skills",
    content_th:
      "ผู้เข้าร่วมจะได้ฝึกทักษะการฟังและการสื่อสารอย่างชัดเจน พร้อมทั้งเรียนรู้การสื่อสารด้วยความเข้าใจ เห็นอกเห็นใจ และความคิดสร้างสรรค์ เวิร์กช็อปนี้ช่วยป้องกันความขัดแย้ง เสริมสร้างการทำงานร่วมกัน และสนับสนุนการทำงานเป็นทีมอย่างราบรื่น ภายใต้บรรยากาศที่ปลอดภัยทางจิตใจ (Psychological Safety) ในองค์กร",
    content_en:
      "Participants practice listening and communicating clearly while learning to communicate with empathy, understanding, and creativity. The workshop helps prevent conflict, strengthen collaboration, and support smoother teamwork within a psychologically safe environment.",
    gallery_files: ["ws10.png", "ws11.png", "ws12.png"],
    gallery_style: "landscape",
    show_cta: true,
    sort_order: 1,
  },
  {
    slug: "art-of-me-self-awareness-discovery",
    category_slug: "self-awareness-and-personal-growth",
    title_th: "Art of me : self-awareness discovery",
    title_en: "Art of me : self-awareness discovery",
    summary_th: "กระบวนการที่ผสานจิตวิทยาและศิลปะ โดยมีนักจิตวิทยาคลินิกเป็นผู้นำทาง",
    summary_en: "A process that blends psychology and art, guided by clinical psychologists.",
    content_th:
      "เป็นเวิร์กช็อปที่จะชวนผู้เข้าร่วมให้ได้สำรวจโลกภายในของตนเอง พัฒนาความตระหนักรู้ทางอารมณ์ และค้นพบมิติที่ลึกซึ้งของการยอมรับตนเอง และกระบวนการที่อ่อนโยนนี้จะช่วยส่งเสริมสุขภาวะทางอารมณ์และการเติบโตจากภายใน ทำให้บุคคลสามารถใช้ชีวิตและเชื่อมโยงกับผู้อื่นได้อย่างสมดุลและเป็นธรรมชาติยิ่งขึ้น",
    content_en:
      "This workshop invites participants to explore their inner world, deepen emotional awareness, and discover more profound dimensions of self-acceptance. The gentle process supports emotional wellbeing and inner growth, helping people live and connect with others in a more balanced and natural way.",
    gallery_files: ["ws19.png", "ws20.png", "ws21.png"],
    gallery_style: "landscape",
    show_cta: false,
    sort_order: 0,
  },
  {
    slug: "mindful-flower-arrangements-and-self-exploration",
    category_slug: "self-awareness-and-personal-growth",
    title_th: "Mindful flower arrangements & Self exploration",
    title_en: "Mindful flower arrangements & Self exploration",
    summary_th: "ค้นพบตนเองผ่านการจัดดอกไม้ภายใต้กระบวนการทางจิตวิทยา",
    summary_en: "Discover yourself through flower arrangement within a psychological process",
    content_th:
      "ดอกไม้ไม่ได้เป็นเพียงความงดงาม แต่ยังเป็นสื่อกลางที่เชื่อมโยงสู่โลกภายใน ชวนให้ผู้เข้าร่วมได้สำรวจและทำความเข้าใจตนเองอย่างอ่อนโยน ผ่านกระบวนการจัดดอกไม้ที่ผสานทั้งความตั้งใจและความเป็นธรรมชาติ ซึ่งกิจกรรมนี้จะช่วยส่งเสริมความสมดุลทางอารมณ์ ลดความตึงเครียด และเปิดพื้นที่ให้เกิดการเรียนรู้และสะท้อนความเข้าใจตนเองอย่างลึกซึ้ง",
    content_en:
      "Flowers are not only beautiful. They can also become a bridge to the inner world, inviting participants to explore and understand themselves gently through a process that combines intention and natural flow. This activity supports emotional balance, reduces tension, and creates room for deep reflection and learning.",
    gallery_files: ["ws16.png", "ws17.png", "ws18.png"],
    gallery_style: "landscape",
    show_cta: true,
    sort_order: 1,
  },
];

async function uploadImage(supabase, slug, fileName) {
  const absolutePath = path.join(imageRoot, fileName);
  const fileBuffer = await fs.readFile(absolutePath);
  const storagePath = `workshop-programs/${slug}/${fileName}`;
  const extension = path.extname(fileName).slice(1).toLowerCase() || "png";
  const contentType =
    extension === "jpg" || extension === "jpeg"
      ? "image/jpeg"
      : extension === "webp"
        ? "image/webp"
        : "image/png";

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

  const serviceRows = serviceCards.map((card) => ({
    slug: card.slug,
    icon_key: card.icon_key,
    title_primary_th: card.title_primary_th,
    title_primary_en: card.title_primary_en,
    title_secondary_th: card.title_secondary_th,
    title_secondary_en: card.title_secondary_en,
    details_th: card.details_th.join("\n"),
    details_en: card.details_en.join("\n"),
    info_heading_th: card.info_heading_th,
    info_heading_en: card.info_heading_en,
    info_lines_th: card.info_lines_th.join("\n"),
    info_lines_en: card.info_lines_en.join("\n"),
    note_lines_th: card.note_lines_th.join("\n"),
    note_lines_en: card.note_lines_en.join("\n"),
    duration_th: card.duration_th.join("\n"),
    duration_en: card.duration_en.join("\n"),
    price_lines: card.price_lines,
    extra_th: card.extra_th,
    extra_en: card.extra_en,
    sort_order: card.sort_order,
    active: true,
  }));

  const { error: serviceError } = await supabase
    .from("service_cards")
    .upsert(serviceRows, { onConflict: "slug" });

  if (serviceError) {
    throw new Error(`Unable to seed service cards: ${serviceError.message}`);
  }

  const categoryRows = workshopCategories.map((category) => ({
    slug: category.slug,
    title_th: category.title_th,
    title_en: category.title_en,
    subtitle_th: category.subtitle_th,
    subtitle_en: category.subtitle_en,
    sort_order: category.sort_order,
    active: true,
  }));

  const { error: categoryError } = await supabase
    .from("workshop_categories")
    .upsert(categoryRows, { onConflict: "slug" });

  if (categoryError) {
    throw new Error(`Unable to seed workshop categories: ${categoryError.message}`);
  }

  const { data: categoryRecords, error: categoryLookupError } = await supabase
    .from("workshop_categories")
    .select("id,slug");

  if (categoryLookupError) {
    throw new Error(`Unable to read workshop categories: ${categoryLookupError.message}`);
  }

  const categoryIdBySlug = new Map(
    (categoryRecords ?? []).map((record) => [record.slug, record.id]),
  );

  const programRows = [];

  for (const program of workshopPrograms) {
    const categoryId = categoryIdBySlug.get(program.category_slug);

    if (!categoryId) {
      throw new Error(`Missing category for workshop program ${program.slug}`);
    }

    const uploadedUrls = [];
    for (const fileName of program.gallery_files) {
      uploadedUrls.push(await uploadImage(supabase, program.slug, fileName));
    }

    programRows.push({
      category_id: categoryId,
      slug: program.slug,
      title_th: program.title_th,
      title_en: program.title_en,
      summary_th: program.summary_th,
      summary_en: program.summary_en,
      content_th: program.content_th,
      content_en: program.content_en,
      gallery_image_urls: uploadedUrls,
      gallery_style: program.gallery_style,
      show_cta: program.show_cta,
      sort_order: program.sort_order,
      active: true,
    });
  }

  const { error: programError } = await supabase
    .from("workshop_programs")
    .upsert(programRows, { onConflict: "slug" });

  if (programError) {
    throw new Error(`Unable to seed workshop programs: ${programError.message}`);
  }

  console.log(
    `Seeded ${serviceRows.length} service cards, ${categoryRows.length} workshop categories, and ${programRows.length} workshop programs.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
