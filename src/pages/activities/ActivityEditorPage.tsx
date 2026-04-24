import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, GripVertical, ImageUp, Save, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { LoadingBlock } from "../../components/ui/loading";
import {
  activityToForm,
  emptyActivityForm,
  formatDateTime,
  formatEventDate,
  getActivityPreviewText,
  normalizeInlineText,
  slugify,
  statusClass,
  statusLabel,
  type ActivityFormState,
  type ActivityRecord,
} from "./activityShared";

type GalleryItem =
  | {
      id: string;
      kind: "existing";
      url: string;
      label: string;
    }
  | {
      id: string;
      kind: "upload";
      file: File;
      previewUrl: string;
      label: string;
    };

function createExistingGalleryItems(urls: string[]): GalleryItem[] {
  return urls.map((url, index) => ({
    id: `existing-${index}-${url}`,
    kind: "existing",
    url,
    label: url.split("/").pop() || `image-${index + 1}`,
  }));
}

export default function ActivityEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [form, setForm] = useState<ActivityFormState>(() => emptyActivityForm());
  const [slugTouched, setSlugTouched] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ActivityRecord | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [draggedGalleryId, setDraggedGalleryId] = useState<string | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<"th" | "en">("th");
  const uploadPreviewUrlsRef = useRef<string[]>([]);
  const hasManualChangesRef = useRef(false);
  const initializedModeRef = useRef<string | null>(null);

  const clearUploadPreviews = () => {
    uploadPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    uploadPreviewUrlsRef.current = [];
  };

  const removeTrackedPreview = (previewUrl: string) => {
    URL.revokeObjectURL(previewUrl);
    uploadPreviewUrlsRef.current = uploadPreviewUrlsRef.current.filter((url) => url !== previewUrl);
  };

  useEffect(() => () => clearUploadPreviews(), []);

  useEffect(() => {
    initializedModeRef.current = null;
  }, [id, isNew]);

  const loadActivities = async () => {
    const { data, error: queryError } = await supabase
      .from("activities")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setActivities([]);
      setLoading(false);
      return;
    }

    setActivities((data ?? []) as ActivityRecord[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadActivities();
  }, []);

  useEffect(() => {
    if (!saveNotice) return undefined;

    const timeout = window.setTimeout(() => {
      setSaveNotice(null);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [saveNotice]);

  const selectedActivity = useMemo(
    () => activities.find((activity) => activity.id === id) ?? null,
    [activities, id],
  );

  useEffect(() => {
    if (!isNew && selectedActivity && initializedModeRef.current !== `edit:${selectedActivity.id}`) {
      setForm(activityToForm(selectedActivity));
      setSlugTouched(true);
      setCoverFile(null);
      clearUploadPreviews();
      setGalleryItems(createExistingGalleryItems(selectedActivity.gallery_image_urls));
      setDraggedGalleryId(null);
      setActiveLanguage("th");
      hasManualChangesRef.current = false;
      initializedModeRef.current = `edit:${selectedActivity.id}`;
      return;
    }

    if (isNew && !hasManualChangesRef.current && initializedModeRef.current !== "create") {
      const nextSortOrder =
        activities.length === 0
          ? 0
          : Math.max(...activities.map((activity) => activity.sort_order)) + 1;

      setForm(emptyActivityForm(nextSortOrder));
      setSlugTouched(false);
      setCoverFile(null);
      clearUploadPreviews();
      setGalleryItems([]);
      setDraggedGalleryId(null);
      setActiveLanguage("th");
      hasManualChangesRef.current = false;
      initializedModeRef.current = "create";
    }
  }, [activities, isNew, selectedActivity]);

  useEffect(() => {
    if (coverFile) {
      const localPreviewUrl = URL.createObjectURL(coverFile);
      setCoverPreviewUrl(localPreviewUrl);

      return () => {
        URL.revokeObjectURL(localPreviewUrl);
      };
    }

    setCoverPreviewUrl(form.cover_image_url);
    return undefined;
  }, [coverFile, form.cover_image_url]);

  const handleFieldChange = (field: keyof ActivityFormState, value: string) => {
    hasManualChangesRef.current = true;

    setForm((current) => {
      const next = { ...current, [field]: value };

      if (!slugTouched && (field === "title_en" || field === "title_th") && !current.slug) {
        next.slug = slugify(value);
      }

      return next;
    });
  };

  const moveGalleryItemById = (fromId: string, toId: string) => {
    if (fromId === toId) return;

    hasManualChangesRef.current = true;

    setGalleryItems((current) => {
      const fromIndex = current.findIndex((item) => item.id === fromId);
      const toIndex = current.findIndex((item) => item.id === toId);

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const removeGalleryItem = (index: number) => {
    hasManualChangesRef.current = true;

    setGalleryItems((current) => {
      const target = current[index];

      if (target?.kind === "upload") {
        removeTrackedPreview(target.previewUrl);
      }

      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const appendGalleryFiles = (files: File[]) => {
    if (files.length === 0) return;

    hasManualChangesRef.current = true;

    const nextItems = files.map((file, index) => {
      const previewUrl = URL.createObjectURL(file);
      uploadPreviewUrlsRef.current.push(previewUrl);

      return {
        id: `${crypto.randomUUID()}-${index}`,
        kind: "upload" as const,
        file,
        previewUrl,
        label: file.name,
      };
    });

    setGalleryItems((current) => [...current, ...nextItems]);
  };

  const previewTitle =
    activeLanguage === "th"
      ? form.title_th.trim() || form.title_en.trim() || "Untitled"
      : form.title_en.trim() || form.title_th.trim() || "Untitled";
  const previewSummary =
    activeLanguage === "th"
      ? normalizeInlineText(form.summary_th) || normalizeInlineText(form.summary_en)
      : normalizeInlineText(form.summary_en) || normalizeInlineText(form.summary_th);
  const previewContent =
    activeLanguage === "th"
      ? form.content_th.trim() || form.content_en.trim()
      : form.content_en.trim() || form.content_th.trim();
  const coverImageLabel = coverFile
    ? `Selected: ${coverFile.name}`
    : form.cover_image_url
      ? `Current image: ${form.cover_image_url.split("/").pop() || "uploaded image"}`
      : "No cover image selected yet.";
  const galleryCount = galleryItems.length;
  const statusDescription =
    form.status === "published"
      ? "This activity is visible on the website."
      : form.status === "archived"
        ? "This activity is hidden from the website."
        : "This activity is saved but not visible yet.";

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaveNotice(null);

    let coverImageUrl = form.cover_image_url.trim();

    if (coverFile) {
      const ext = coverFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeSlug = form.slug.trim() || slugify(previewTitle);
      const filePath = `activities/${safeSlug}/cover-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("content-images")
        .upload(filePath, coverFile, {
          cacheControl: "3600",
          upsert: true,
          contentType: coverFile.type || undefined,
        });

      if (uploadError) {
        setSaveNotice({ type: "error", message: uploadError.message });
        setSaving(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("content-images")
        .getPublicUrl(filePath);
      coverImageUrl = publicUrlData.publicUrl;
    }

    if (!coverImageUrl) {
      setSaveNotice({
        type: "error",
        message: "Please choose a cover image from your device.",
      });
      setSaving(false);
      return;
    }

    const missingFields = [
      !form.slug.trim() ? "page link" : "",
      !form.title_th.trim() ? "Thai title" : "",
      !form.title_en.trim() ? "English title" : "",
      !form.content_th.trim() ? "Thai content" : "",
      !form.content_en.trim() ? "English content" : "",
    ].filter(Boolean);

    if (missingFields.length > 0) {
      setSaveNotice({
        type: "error",
        message: `Please fill in: ${missingFields.join(", ")}.`,
      });
      setSaving(false);
      return;
    }

    const galleryImageUrls: string[] = [];

    try {
      const safeSlug = form.slug.trim() || slugify(previewTitle);

      for (let index = 0; index < galleryItems.length; index += 1) {
        const item = galleryItems[index];

        if (item.kind === "existing") {
          galleryImageUrls.push(item.url);
          continue;
        }

        const ext = item.file.name.split(".").pop()?.toLowerCase() || "jpg";
        const filePath = `activities/${safeSlug}/gallery-${Date.now()}-${index}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("content-images")
          .upload(filePath, item.file, {
            cacheControl: "3600",
            upsert: true,
            contentType: item.file.type || undefined,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from("content-images")
          .getPublicUrl(filePath);

        galleryImageUrls.push(publicUrlData.publicUrl);
      }
    } catch (uploadError) {
      setSaveNotice({
        type: "error",
        message:
          uploadError instanceof Error
            ? uploadError.message
            : "Unable to upload gallery images.",
      });
      setSaving(false);
      return;
    }

    const publishedAt =
      form.status === "published"
        ? selectedActivity?.published_at ?? new Date().toISOString()
        : null;

    const payload = {
      slug: form.slug.trim(),
      title_th: form.title_th.trim(),
      title_en: form.title_en.trim(),
      summary_th: normalizeInlineText(form.summary_th) || null,
      summary_en: normalizeInlineText(form.summary_en) || null,
      content_th: form.content_th.trim(),
      content_en: form.content_en.trim(),
      cover_image_url: coverImageUrl,
      gallery_image_urls: galleryImageUrls,
      youtube_url: form.youtube_url.trim() || null,
      event_date: form.event_date || null,
      status: form.status,
      published_at: publishedAt,
      sort_order: Number(form.sort_order) || 0,
    };

    const mutation = form.id
      ? supabase.from("activities").update(payload).eq("id", form.id)
      : supabase.from("activities").insert(payload);

    const { data, error: saveError } = await mutation.select().maybeSingle();

    if (saveError) {
      setSaveNotice({ type: "error", message: saveError.message });
      setSaving(false);
      return;
    }

    await loadActivities();
    setSaving(false);
    setSaveNotice({
      type: "success",
      message: "Activity saved successfully.",
    });

    if (data) {
      const savedActivity = data as ActivityRecord;
      setForm(activityToForm(savedActivity));
      setSlugTouched(true);
      setCoverFile(null);
      clearUploadPreviews();
      setGalleryItems(createExistingGalleryItems(savedActivity.gallery_image_urls));
      hasManualChangesRef.current = false;
      initializedModeRef.current = `edit:${savedActivity.id}`;
      navigate(`/activities/edit/${savedActivity.id}`, { replace: true });
      return;
    }

    if (!form.id) {
      setForm(emptyActivityForm(Number(form.sort_order) + 1));
      setSlugTouched(false);
      setCoverFile(null);
      clearUploadPreviews();
      setGalleryItems([]);
      hasManualChangesRef.current = false;
      initializedModeRef.current = "create";
      navigate("/activities/create", { replace: true });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    setError("");
    setSaveNotice(null);

    const { error: deleteError } = await supabase
      .from("activities")
      .delete()
      .eq("id", deleteTarget.id);

    if (deleteError) {
      setSaveNotice({ type: "error", message: deleteError.message });
      setSaving(false);
      return;
    }

    setDeleteTarget(null);
    await loadActivities();
    setSaving(false);
    navigate("/activities", { replace: true });
  };

  if (!isNew && loading) {
    return (
      <section className="grid content-start gap-4">
        <section className="grid self-start gap-3 rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <LoadingBlock className="h-4 w-32 rounded-full" />
          <LoadingBlock className="h-10 w-52 rounded-full" />
          <LoadingBlock className="h-4 w-full max-w-2xl rounded-full" />
        </section>
        <section className="grid content-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] xl:items-start">
          <article className="grid self-start gap-4 rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
            {Array.from({ length: 9 }, (_, index) => (
              <LoadingBlock
                key={`activity-editor-field-${index}`}
                className={index >= 5 ? "h-36 rounded-[22px]" : "h-11 rounded-2xl"}
              />
            ))}
          </article>
          <article className="grid self-start gap-4 rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
            <LoadingBlock className="h-56 rounded-[22px]" />
            <LoadingBlock className="h-4 w-2/3 rounded-full" />
            <LoadingBlock className="h-4 w-full rounded-full" />
            <LoadingBlock className="h-4 w-5/6 rounded-full" />
          </article>
        </section>
      </section>
    );
  }

  const title = isNew ? "Create activity" : "Edit activity";

  return (
    <>
      <section className="grid content-start gap-4">
        <section className="self-start rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid gap-2">
              <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
                Activities / {isNew ? "Create activity" : "Edit activity"}
              </div>
              <h1 className="text-[clamp(30px,3vw,44px)] font-semibold tracking-tight text-[#2f2a24]">
                {title}
              </h1>
              <p className="max-w-2xl text-[15px] leading-7 text-[#7b6d5f]">
                Use this page to create, update, or delete one public activity entry.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
                to="/activities"
              >
                <ArrowLeft size={16} strokeWidth={2} />
                Back to list
              </Link>
              {!isNew ? (
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-[#e6c7c3] bg-white px-4 text-sm font-medium text-[#a94135] transition-colors hover:bg-[#fff3f1]"
                  onClick={() => setDeleteTarget(selectedActivity)}
                  disabled={saving || !selectedActivity}
                >
                  <Trash2 size={16} strokeWidth={2} />
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {saveNotice ? (
          <p
            className={[
              "rounded-2xl border px-4 py-3 text-sm shadow-[0_14px_36px_rgba(65,43,27,0.06)]",
              saveNotice.type === "success"
                ? "border-[#b9d7b1] bg-[rgba(237,247,233,0.95)] text-[#35613a]"
                : "border-[#e3b6af] bg-[rgba(255,238,235,0.95)] text-[#8e3a32]",
            ].join(" ")}
          >
            {saveNotice.message}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-2xl border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] px-4 py-3 text-sm text-[#a94135] shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
            {error}
          </p>
        ) : null}

        <section className="grid content-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] xl:items-start">
          <form
            onSubmit={handleSave}
            className="grid self-start gap-4 rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Thai title</span>
                <input
                  type="text"
                  value={form.title_th}
                  onChange={(event) => handleFieldChange("title_th", event.target.value)}
                  placeholder="ชื่อกิจกรรมภาษาไทย"
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">English title</span>
                <input
                  type="text"
                  value={form.title_en}
                  onChange={(event) => handleFieldChange("title_en", event.target.value)}
                  placeholder="English activity title"
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Page link</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    handleFieldChange("slug", slugify(event.target.value));
                  }}
                  placeholder="mindbloom-gallery"
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Event date</span>
                <input
                  type="date"
                  value={form.event_date}
                  onChange={(event) => handleFieldChange("event_date", event.target.value)}
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Status</span>
                <select
                  value={form.status}
                  onChange={(event) => handleFieldChange("status", event.target.value)}
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Thai teaser text</span>
                <textarea
                  value={form.summary_th}
                  onChange={(event) => handleFieldChange("summary_th", event.target.value)}
                  rows={3}
                  placeholder="ข้อความสั้นสำหรับหน้ารวมกิจกรรม"
                  className="rounded-[22px] border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-6 text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                />
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-medium text-[#7b6d5f]">English teaser text</span>
                <textarea
                  value={form.summary_en}
                  onChange={(event) => handleFieldChange("summary_en", event.target.value)}
                  rows={3}
                  placeholder="Short copy for the activities overview page"
                  className="rounded-[22px] border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-6 text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                />
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-medium text-[#7b6d5f]">YouTube URL</span>
                <input
                  type="url"
                  value={form.youtube_url}
                  onChange={(event) => handleFieldChange("youtube_url", event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#7b6d5f]">Thai content</span>
              <textarea
                value={form.content_th}
                onChange={(event) => handleFieldChange("content_th", event.target.value)}
                rows={8}
                placeholder="รายละเอียดกิจกรรมภาษาไทย"
                className="rounded-[22px] border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#7b6d5f]">English content</span>
              <textarea
                value={form.content_en}
                onChange={(event) => handleFieldChange("content_en", event.target.value)}
                rows={8}
                placeholder="English activity detail"
                className="rounded-[22px] border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
              />
            </label>

            <section className="grid gap-4 rounded-[22px] border border-[#e3d4c6] bg-white/70 p-4">
              <div className="grid gap-1">
                <h2 className="text-lg font-semibold text-[#2f2a24]">Media</h2>
                <p className="text-sm leading-6 text-[#7b6d5f]">
                  Upload a cover image and build the gallery used on the activity detail page.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <span className="text-sm font-medium text-[#7b6d5f]">Cover image</span>
                  <label className="grid cursor-pointer gap-3 rounded-[22px] border border-dashed border-[#d9c7b8] bg-[#fffaf4] p-4 transition-colors hover:border-[#c7ae9b]">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6f4f40] shadow-[0_6px_18px_rgba(65,43,27,0.08)]">
                      <ImageUp size={18} strokeWidth={2} />
                    </span>
                    <div className="grid gap-1">
                      <strong className="text-sm font-semibold text-[#2f2a24]">
                        Upload cover image
                      </strong>
                      <span className="text-sm leading-6 text-[#7b6d5f]">
                        JPG, PNG, or WebP for the main card and detail header.
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setCoverFile(file);
                      }}
                    />
                  </label>
                  <p className="text-xs leading-5 text-[#7b6d5f]">{coverImageLabel}</p>
                </div>

                <div className="grid gap-2">
                  <span className="text-sm font-medium text-[#7b6d5f]">Gallery uploads</span>
                  <label className="grid cursor-pointer gap-3 rounded-[22px] border border-dashed border-[#d9c7b8] bg-[#fffaf4] p-4 transition-colors hover:border-[#c7ae9b]">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6f4f40] shadow-[0_6px_18px_rgba(65,43,27,0.08)]">
                      <ImageUp size={18} strokeWidth={2} />
                    </span>
                    <div className="grid gap-1">
                      <strong className="text-sm font-semibold text-[#2f2a24]">
                        Upload gallery images
                      </strong>
                      <span className="text-sm leading-6 text-[#7b6d5f]">
                        Files are added to the gallery on save.
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        const nextFiles = Array.from(event.target.files ?? []);
                        if (nextFiles.length === 0) return;
                        appendGalleryFiles(nextFiles);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <p className="text-xs leading-5 text-[#7b6d5f]">
                    Add files, then drag them into the same left-to-right order used on the public page.
                  </p>
                </div>
              </div>

              {galleryItems.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[#e3d4c6] bg-white/80 p-4 text-sm leading-6 text-[#7b6d5f]">
                  No gallery images yet. Upload one or more images, then arrange them in the order
                  visitors should see.
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-[#7b6d5f]">Gallery order</span>
                    <span className="text-xs text-[#7b6d5f]">
                      Drag thumbnails to preview the real 3-column gallery order.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                    {galleryItems.map((item, index) => {
                      const imageUrl = item.kind === "existing" ? item.url : item.previewUrl;

                      return (
                        <article
                          key={item.id}
                          draggable
                          onDragStart={() => setDraggedGalleryId(item.id)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            if (draggedGalleryId) {
                              moveGalleryItemById(draggedGalleryId, item.id);
                            }
                            setDraggedGalleryId(null);
                          }}
                          onDragEnd={() => setDraggedGalleryId(null)}
                          className={[
                            "group grid gap-2 rounded-[20px] border bg-white p-2 shadow-[0_10px_24px_rgba(65,43,27,0.04)] transition-colors",
                            draggedGalleryId === item.id
                              ? "border-[#c7ae9b] bg-[#fff8f1]"
                              : "border-[#e3d4c6]",
                          ].join(" ")}
                        >
                          <div className="relative overflow-hidden rounded-[18px] bg-[#f6efe6]">
                            <img
                              src={imageUrl}
                              alt=""
                              className="aspect-square h-full w-full object-cover"
                            />
                            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2">
                              <span className="inline-flex h-7 items-center rounded-full bg-[rgba(47,42,36,0.76)] px-2.5 text-xs font-medium text-white">
                                {`#${index + 1}`}
                              </span>
                              <span className="inline-flex h-7 items-center rounded-full bg-[rgba(255,253,249,0.92)] px-2.5 text-xs font-medium text-[#7b6d5f]">
                                {item.kind === "existing" ? "Saved" : "New"}
                              </span>
                            </div>
                          </div>

                          <div className="grid gap-2 px-1 pb-1">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e3d4c6] bg-white text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
                                title="Drag to reorder"
                                aria-label="Drag to reorder"
                              >
                                <GripVertical size={14} strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e6c7c3] text-[#a94135] transition-colors hover:bg-[#fff3f1]"
                                onClick={() => removeGalleryItem(index)}
                                aria-label="Remove gallery image"
                              >
                                <X size={14} strokeWidth={2} />
                              </button>
                            </div>

                            <strong className="truncate text-sm font-semibold text-[#2f2a24]">
                              {item.label}
                            </strong>
                            <p className="text-xs leading-5 text-[#7b6d5f]">
                              {item.kind === "existing"
                                ? "Already stored in Supabase."
                                : "Will upload when you save this activity."}
                            </p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm leading-6 text-[#7b6d5f]">{statusDescription}</div>
              <button
                type="submit"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#6f4f40] px-5 text-sm font-medium text-white transition-colors hover:bg-[#5d4337] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
              >
                <Save size={16} strokeWidth={2} />
                {saving ? "Saving..." : "Save activity"}
              </button>
            </div>
          </form>

          <aside className="grid self-start gap-4 rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
                  Live preview
                </div>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#2f2a24]">
                  {previewTitle}
                </h2>
              </div>
              <div className="flex rounded-full border border-[#e3d4c6] bg-white p-1 text-sm">
                {(["th", "en"] as const).map((language) => (
                  <button
                    key={language}
                    type="button"
                    onClick={() => setActiveLanguage(language)}
                    className={[
                      "rounded-full px-3 py-1.5 transition-colors",
                      activeLanguage === language
                        ? "bg-[#6f4f40] text-white"
                        : "text-[#7b6d5f] hover:bg-[#f7efe6]",
                    ].join(" ")}
                  >
                    {language.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-[#e3d4c6] bg-white">
              {coverPreviewUrl ? (
                <img
                  src={coverPreviewUrl}
                  alt={previewTitle}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="grid aspect-[4/3] place-items-center bg-[#f6efe6] px-6 text-center text-sm leading-6 text-[#7b6d5f]">
                  Upload a cover image to see the activity card preview.
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={statusClass(form.status)}>{statusLabel(form.status)}</span>
              {form.event_date ? (
                <span className="badge neutral">Date {formatEventDate(form.event_date)}</span>
              ) : null}
              <span className="badge neutral">Gallery {galleryCount}</span>
            </div>

            <div className="grid gap-3 rounded-[22px] border border-[#e3d4c6] bg-white/80 p-4">
              <div className="grid gap-1">
                <strong className="text-[15px] font-semibold text-[#2f2a24]">
                  {previewTitle}
                </strong>
                <span className="text-sm text-[#7b6d5f]">
                  /activity/{form.slug.trim() || "your-slug"}
                </span>
              </div>

              <p className="text-sm leading-6 text-[#7b6d5f]">
                {previewSummary ||
                  getActivityPreviewText(
                    form.summary_en,
                    form.summary_th,
                    form.content_en,
                    form.content_th,
                    activeLanguage,
                  )}
              </p>

              <p className="whitespace-pre-line text-sm leading-7 text-[#7b6d5f]">
                {previewContent || "Activity detail copy will appear here."}
              </p>

              {galleryItems.length > 0 ? (
                <div className="grid gap-2 border-t border-[#efe2d6] pt-3">
                  <div className="text-sm font-medium text-[#2f2a24]">Gallery preview order</div>
                  <div className="grid grid-cols-3 gap-2">
                    {galleryItems.slice(0, 6).map((item, index) => (
                      <div
                        key={item.id}
                        className="relative overflow-hidden rounded-2xl border border-[#e3d4c6] bg-[#f6efe6]"
                      >
                        <img
                          src={item.kind === "existing" ? item.url : item.previewUrl}
                          alt=""
                          className="aspect-square h-full w-full object-cover"
                        />
                        <span className="absolute left-2 top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[rgba(47,42,36,0.76)] px-1.5 text-[11px] font-medium text-white">
                          {index + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-1 border-t border-[#efe2d6] pt-3 text-sm text-[#7b6d5f]">
                <span>Updated {selectedActivity ? formatDateTime(selectedActivity.updated_at) : "-"}</span>
                <span>
                  Published{" "}
                  {selectedActivity?.published_at ? formatDateTime(selectedActivity.published_at) : "-"}
                </span>
                <span>YouTube {form.youtube_url.trim() || "-"}</span>
              </div>
            </div>
          </aside>
        </section>
      </section>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(47,42,36,0.42)] p-4">
          <div className="w-full max-w-md rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.98)] p-6 shadow-[0_24px_60px_rgba(65,43,27,0.18)]">
            <div className="grid gap-2">
              <div className="text-xs font-medium tracking-[0.18em] text-[#a94135] uppercase">
                Delete activity
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-[#2f2a24]">
                Remove {deleteTarget.title_th || deleteTarget.title_en}?
              </h2>
              <p className="text-sm leading-6 text-[#7b6d5f]">
                This will permanently delete the activity record from Supabase. Uploaded images in
                storage are not removed automatically.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="inline-flex h-11 items-center rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
                onClick={() => setDeleteTarget(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center rounded-full bg-[#a94135] px-4 text-sm font-medium text-white transition-colors hover:bg-[#96392f] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void handleDelete()}
                disabled={saving}
              >
                {saving ? "Deleting..." : "Delete activity"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
