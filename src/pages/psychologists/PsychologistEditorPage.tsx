import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, ImageUp, Save, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { resolvePsychologistPhotoUrl } from "../../assets/images/psychologists";
import {
  emptyPsychologistForm,
  formatLicenseNumber,
  normalizeWhitespace,
  normalizeLicenseNumber,
  psychologistToForm,
  slugify,
  psychologistTopicOptions,
  type PsychologistFormState,
  type PsychologistRecord,
  type PsychologistTopicKey,
} from "./psychologistShared";
import { formatDate } from "../blog/blogShared";
import { LoadingBlock } from "../../components/ui/loading";

const PLACEHOLDER_PHOTO =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 1000'><rect width='800' height='1000' rx='48' fill='%23F6F1EA'/><circle cx='400' cy='330' r='120' fill='%23D8C7B8'/><path d='M220 860c42-122 130-182 180-182s138 60 180 182' fill='%23D8C7B8'/><path d='M320 320c0 44 36 80 80 80s80-36 80-80-36-80-80-80-80 36-80 80z' fill='%23F1E4D8'/></svg>";

export default function PsychologistEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [psychologists, setPsychologists] = useState<PsychologistRecord[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<PsychologistRecord | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [form, setForm] = useState<PsychologistFormState>(() => emptyPsychologistForm());
  const [previewLanguage, setPreviewLanguage] = useState<"th" | "en">("th");

  const loadPsychologists = async () => {
    const { data, error: queryError } = await supabase
      .from("psychologists")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setPsychologists([]);
      setLoading(false);
      return;
    }

    setPsychologists((data ?? []) as PsychologistRecord[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadPsychologists();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;

    const timeout = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const selectedPsychologist = useMemo(
    () => psychologists.find((row) => row.id === id) ?? null,
    [id, psychologists],
  );

  useEffect(() => {
    if (!isNew && selectedPsychologist) {
      setForm(psychologistToForm(selectedPsychologist));
      setSlugTouched(true);
      setPhotoFile(null);
      setPreviewLanguage("th");
      return;
    }

    if (isNew) {
      const nextSortOrder =
        psychologists.length === 0 ? 0 : Math.max(...psychologists.map((row) => row.sort_order)) + 1;
      setForm(emptyPsychologistForm(nextSortOrder));
      setSlugTouched(false);
      setPhotoFile(null);
      setPreviewLanguage("th");
    }
  }, [isNew, psychologists, selectedPsychologist]);

  useEffect(() => {
    if (photoFile) {
      const localPreviewUrl = URL.createObjectURL(photoFile);
      setPhotoPreviewUrl(localPreviewUrl);
      return () => URL.revokeObjectURL(localPreviewUrl);
    }

    setPhotoPreviewUrl(resolvePsychologistPhotoUrl(form.photo_url) || PLACEHOLDER_PHOTO);
    return undefined;
  }, [photoFile, form.photo_url]);

  const handleFieldChange = (
    field: keyof PsychologistFormState,
    value: string | boolean | number,
  ) => {
    setForm((current) => {
      const next = { ...current, [field]: value } as PsychologistFormState;

      if (!slugTouched && (field === "name_en" || field === "name_th") && !current.slug) {
        next.slug = slugify(String(value));
      }

      return next;
    });
  };

  const toggleTopic = (topic: PsychologistTopicKey) => {
    setForm((current) => ({
      ...current,
      topics: current.topics.includes(topic)
        ? current.topics.filter((item) => item !== topic)
        : [...current.topics, topic],
    }));
  };

  const previewName =
    previewLanguage === "th"
      ? normalizeWhitespace(form.name_th) || "Untitled"
      : normalizeWhitespace(form.name_en) || "Untitled";
  const previewNickname =
    previewLanguage === "th" ? normalizeWhitespace(form.nickname_th) || "-" : normalizeWhitespace(form.nickname_en) || "-";
  const previewApproach =
    previewLanguage === "th" ? normalizeWhitespace(form.approach_th) || "-" : normalizeWhitespace(form.approach_en) || "-";
  const previewValue =
    previewLanguage === "th" ? normalizeWhitespace(form.value_th) || "-" : normalizeWhitespace(form.value_en) || "-";
  const previewQuote =
    previewLanguage === "th" ? normalizeWhitespace(form.quote_th) || "-" : normalizeWhitespace(form.quote_en) || "-";
  const previewFocusTags = form.topics
    .map((topic) => psychologistTopicOptions.find((option) => option.key === topic))
    .filter(Boolean) as Array<(typeof psychologistTopicOptions)[number]>;

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    let photoUrl = form.photo_url.trim();

    if (photoFile) {
      const ext = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeSlug = form.slug.trim() || slugify(previewName);
      const filePath = `psychologists/${safeSlug}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("content-images")
        .upload(filePath, photoFile, {
          cacheControl: "3600",
          upsert: true,
          contentType: photoFile.type || undefined,
        });

      if (uploadError) {
        setError(uploadError.message);
        setSaving(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("content-images").getPublicUrl(filePath);
      photoUrl = publicUrlData.publicUrl;
    }

    if (!photoUrl) {
      setError("Please choose a photo from your device.");
      setSaving(false);
      return;
    }

    const licenseNumber = normalizeLicenseNumber(form.license_no);

    const missingFields = [
      !form.name_th.trim() ? "Thai name" : "",
      !form.name_en.trim() ? "English name" : "",
      !form.nickname_th.trim() ? "Thai nickname" : "",
      !form.nickname_en.trim() ? "English nickname" : "",
      !licenseNumber ? "license number" : "",
      !form.approach_th.trim() ? "Thai approach" : "",
      !form.approach_en.trim() ? "English approach" : "",
      !form.value_th.trim() ? "Thai value" : "",
      !form.value_en.trim() ? "English value" : "",
      !form.quote_th.trim() ? "Thai quote" : "",
      !form.quote_en.trim() ? "English quote" : "",
    ].filter(Boolean);

    if (missingFields.length > 0) {
      setError(`Please fill in: ${missingFields.join(", ")}.`);
      setSaving(false);
      return;
    }

    const payload = {
      slug: form.slug.trim() || slugify(previewName),
      name_th: normalizeWhitespace(form.name_th),
      name_en: normalizeWhitespace(form.name_en),
      nickname_th: normalizeWhitespace(form.nickname_th),
      nickname_en: normalizeWhitespace(form.nickname_en),
      license_no: formatLicenseNumber(licenseNumber),
      photo_url: photoUrl,
      approach_th: normalizeWhitespace(form.approach_th),
      approach_en: normalizeWhitespace(form.approach_en),
      value_th: normalizeWhitespace(form.value_th),
      value_en: normalizeWhitespace(form.value_en),
      quote_th: normalizeWhitespace(form.quote_th),
      quote_en: normalizeWhitespace(form.quote_en),
      topics: form.topics,
      active: form.active,
      sort_order: Number(form.sort_order) || 0,
    };

    const mutation = form.id
      ? supabase.from("psychologists").update(payload).eq("id", form.id)
      : supabase.from("psychologists").insert(payload);

    const { data, error: saveError } = await mutation.select().maybeSingle();

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    await loadPsychologists();
    setSaving(false);
    setNotice("Psychologist saved successfully.");

    if (data) {
      const saved = data as PsychologistRecord;
      setForm(psychologistToForm(saved));
      setSlugTouched(true);
      setPhotoFile(null);
      navigate(`/psychologists/edit/${saved.id}`, { replace: true });
      return;
    }

    if (!form.id) {
      setForm(emptyPsychologistForm(Number(form.sort_order) + 1));
      setSlugTouched(false);
      setPhotoFile(null);
      navigate("/psychologists/create", { replace: true });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    setError("");
    setNotice("");

    const { error: deleteError } = await supabase
      .from("psychologists")
      .delete()
      .eq("id", deleteTarget.id);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    setDeleteTarget(null);
    await loadPsychologists();
    setSaving(false);
    navigate("/psychologists", { replace: true });
  };

  if (!isNew && loading) {
    return (
      <section className="grid gap-4">
        <section className="grid gap-3 rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <LoadingBlock className="h-4 w-40 rounded-full" />
          <LoadingBlock className="h-10 w-64 rounded-full" />
          <LoadingBlock className="h-4 w-full max-w-2xl rounded-full" />
        </section>
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <article className="grid gap-4 rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }, (_, index) => (
                <LoadingBlock key={`psychologist-editor-field-${index}`} className="h-11 rounded-2xl" />
              ))}
            </div>
            <LoadingBlock className="h-28 rounded-[22px]" />
            <LoadingBlock className="h-28 rounded-[22px]" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }, (_, index) => (
                <LoadingBlock key={`psychologist-editor-chip-${index}`} className="h-8 w-24 rounded-full" />
              ))}
            </div>
          </article>
          <article className="grid gap-4 rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
            <LoadingBlock className="h-72 rounded-[24px]" />
            <LoadingBlock className="h-4 w-1/2 rounded-full" />
            <LoadingBlock className="h-4 w-full rounded-full" />
            <LoadingBlock className="h-4 w-4/5 rounded-full" />
          </article>
        </section>
      </section>
    );
  }

  const title = isNew ? "Create psychologist" : "Edit psychologist";

  return (
    <section className="grid gap-4">
      <section className="rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              Psychologist / {isNew ? "Create profile" : "Edit profile"}
            </div>
            <h1 className="text-[clamp(30px,3vw,44px)] font-semibold tracking-tight text-[#2f2a24]">
              {title}
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-[#7b6d5f]">
              Manage the therapist cards shown on the public psychologist page.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
              to="/psychologists"
            >
              <ArrowLeft size={16} strokeWidth={2} />
              Back to list
            </Link>
            {!isNew ? (
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[#a941352e] bg-white px-4 text-sm font-medium text-[#a94135] transition-colors hover:bg-[rgba(169,65,53,0.08)]"
                onClick={() => setDeleteTarget(selectedPsychologist)}
                disabled={!selectedPsychologist}
              >
                <Trash2 size={16} strokeWidth={2} />
                Delete profile
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] px-4 py-3 text-sm text-[#a94135] shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="rounded-2xl border border-[#b9d7b1] bg-[rgba(237,247,233,0.98)] px-4 py-3 text-sm text-[#35613a] shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          {notice}
        </p>
      ) : null}

      {!isNew && !selectedPsychologist ? (
        <section className="rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <h2 className="text-2xl font-semibold tracking-tight text-[#2f2a24]">
            Psychologist not found
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#7b6d5f]">
            Go back to the psychologist list and choose another item.
          </p>
        </section>
      ) : (
        <section className="rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <form className="grid gap-3" onSubmit={handleSave}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
              <div className="grid gap-4">
                <div className="grid gap-3 rounded-[24px] border border-[#e3d4c6] bg-white/75 p-4">
                  <div className="grid gap-1 text-sm text-[#7b6d5f]">
                    <span>Names</span>
                    <div className="grid gap-3">
                      <label className="grid gap-1 text-sm text-[#7b6d5f]">
                        <span>Thai name</span>
                        <input
                          type="text"
                          value={form.name_th}
                          onChange={(event) => handleFieldChange("name_th", event.target.value)}
                          placeholder="ชื่อภาษาไทย"
                          className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                        />
                      </label>
                      <label className="grid gap-1 text-sm text-[#7b6d5f]">
                        <span>English name</span>
                        <input
                          type="text"
                          value={form.name_en}
                          onChange={(event) => handleFieldChange("name_en", event.target.value)}
                          placeholder="English name"
                          className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1 text-sm text-[#7b6d5f]">
                      <span>Thai nickname</span>
                      <input
                        type="text"
                        value={form.nickname_th}
                        onChange={(event) => handleFieldChange("nickname_th", event.target.value)}
                        placeholder="ชื่อเล่นภาษาไทย"
                        className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                      />
                    </label>
                    <label className="grid gap-1 text-sm text-[#7b6d5f]">
                      <span>English nickname</span>
                      <input
                        type="text"
                        value={form.nickname_en}
                        onChange={(event) => handleFieldChange("nickname_en", event.target.value)}
                        placeholder="English nickname"
                        className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                      />
                    </label>
                  </div>

                  <label className="grid gap-1 text-sm text-[#7b6d5f]">
                      <span>License number (เฉพาะตัวเลข)</span>
                      <input
                        type="text"
                        value={normalizeLicenseNumber(form.license_no)}
                        onChange={(event) =>
                          handleFieldChange("license_no", normalizeLicenseNumber(event.target.value))
                        }
                        placeholder="1234"
                        className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                      />
                    </label>

                  <label className="grid gap-1 text-sm text-[#7b6d5f]">
                    <span>Photo</span>
                    <div className="grid gap-2 rounded-2xl border border-dashed border-[#d8c5b6] bg-white/70 p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]">
                          <ImageUp size={16} strokeWidth={2} />
                          Choose from device
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              setPhotoFile(file);
                            }}
                            className="hidden"
                          />
                        </label>
                        <p className="text-sm text-[#7b6d5f]">
                          {photoFile
                            ? `Selected: ${photoFile.name}`
                            : form.photo_url
                              ? `Current image is set.`
                              : "No photo selected yet."}
                        </p>
                      </div>
                      <p className="text-xs leading-5 text-[#7b6d5f]">
                        Pick a photo from your device. We will upload it for you.
                      </p>
                    </div>
                  </label>

                  <label className="grid gap-1 text-sm text-[#7b6d5f]">
                    <span>Thai approach</span>
                    <textarea
                      rows={4}
                      value={form.approach_th}
                      onChange={(event) => handleFieldChange("approach_th", event.target.value)}
                      placeholder="แนวทางการบำบัดภาษาไทย"
                      className="rounded-2xl border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                    />
                  </label>

                  <label className="grid gap-1 text-sm text-[#7b6d5f]">
                    <span>English approach</span>
                    <textarea
                      rows={4}
                      value={form.approach_en}
                      onChange={(event) => handleFieldChange("approach_en", event.target.value)}
                      placeholder="Therapeutic approach in English"
                      className="rounded-2xl border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                    />
                  </label>

                  <label className="grid gap-1 text-sm text-[#7b6d5f]">
                    <span>Thai value</span>
                    <textarea
                      rows={3}
                      value={form.value_th}
                      onChange={(event) => handleFieldChange("value_th", event.target.value)}
                      placeholder="คุณค่าที่ให้ความสำคัญภาษาไทย"
                      className="rounded-2xl border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                    />
                  </label>

                  <label className="grid gap-1 text-sm text-[#7b6d5f]">
                    <span>English value</span>
                    <textarea
                      rows={3}
                      value={form.value_en}
                      onChange={(event) => handleFieldChange("value_en", event.target.value)}
                      placeholder="Core value in English"
                      className="rounded-2xl border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                    />
                  </label>

                  <label className="grid gap-1 text-sm text-[#7b6d5f]">
                    <span>Thai quote</span>
                    <textarea
                      rows={3}
                      value={form.quote_th}
                      onChange={(event) => handleFieldChange("quote_th", event.target.value)}
                      placeholder="คำคมภาษาไทย"
                      className="rounded-2xl border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                    />
                  </label>

                  <label className="grid gap-1 text-sm text-[#7b6d5f]">
                    <span>English quote</span>
                    <textarea
                      rows={3}
                      value={form.quote_en}
                      onChange={(event) => handleFieldChange("quote_en", event.target.value)}
                      placeholder="Quote in English"
                      className="rounded-2xl border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-4 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
                  <div className="mb-2.5 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
                        Preview / {previewLanguage === "th" ? "Thai" : "English"}
                      </div>
                      <h3 className="mt-1 text-2xl font-semibold tracking-tight text-[#2f2a24]">
                        {previewName}
                      </h3>
                      <p className="mt-1 text-sm text-[#7b6d5f]">{previewNickname}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex rounded-full border border-[#e3d4c6] bg-white p-1 text-sm">
                        {(["th", "en"] as const).map((language) => (
                          <button
                            key={language}
                            type="button"
                            onClick={() => setPreviewLanguage(language)}
                            className={[
                              "rounded-full px-3 py-1.5 transition-colors",
                              previewLanguage === language
                                ? "bg-[#6f4f40] text-white"
                                : "text-[#7b6d5f] hover:bg-[#f7efe6]",
                            ].join(" ")}
                          >
                            {language.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <span
                        className={[
                          "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium",
                          form.active
                            ? "bg-[rgba(185,215,177,0.3)] text-[#35613a]"
                            : "bg-[rgba(231,228,222,0.9)] text-[#7b6d5f]",
                        ].join(" ")}
                      >
                        {form.active ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[22px] border border-[#e3d4c6] bg-[#faf7f3]">
                    <img
                      src={photoPreviewUrl || PLACEHOLDER_PHOTO}
                      alt={previewName}
                      className="mx-auto block h-auto max-h-[420px] w-full max-w-[380px] object-contain p-4"
                    />
                  </div>

                  <div className="mt-3 grid gap-3 text-sm leading-7 text-[#2f2a24]">
                    {[
                      {
                        label:
                          previewLanguage === "th" ? "ใบประกอบโรคศิลปะ" : "Professional License",
                        value: formatLicenseNumber(form.license_no, previewLanguage) || "-",
                      },
                      {
                        label:
                          previewLanguage === "th" ? "แนวทางการบำบัด" : "Therapeutic Approach",
                        value: previewApproach,
                      },
                      {
                        label: previewLanguage === "th" ? "คุณค่าที่ให้ความสำคัญ" : "Core Value",
                        value: previewValue,
                      },
                    ].map((row) => (
                      <section
                        key={row.label}
                        className="grid gap-2 rounded-2xl border border-[#e3d4c6] bg-white/55 p-3"
                      >
                        <span className="text-sm font-medium tracking-wide text-[#7b6d5f] uppercase">
                          {row.label}
                        </span>
                        <span className="text-[#2f2a24]">{row.value}</span>
                      </section>
                    ))}
                    <section className="grid gap-2 rounded-2xl border border-[#e3d4c6] bg-white/55 p-3">
                      <span className="text-sm font-medium tracking-wide text-[#7b6d5f] uppercase">
                        {previewLanguage === "th" ? "ประเด็นที่สนใจ" : "Areas of Focus"}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {previewFocusTags.length === 0 ? (
                          <span className="text-sm text-[#7b6d5f]">No topics selected.</span>
                        ) : (
                          previewFocusTags.map((topic) => (
                            <span
                              key={topic.key}
                              className="rounded-full bg-[#c6d5c4] px-3 py-1 text-[14px] text-white"
                            >
                              {topic.label[previewLanguage]}
                            </span>
                          ))
                        )}
                      </div>
                    </section>
                    <section className="grid gap-1 rounded-2xl border border-[#e3d4c6] bg-white/55 p-3">
                      <span className="text-sm font-medium tracking-wide text-[#7b6d5f] uppercase leading-none">
                        {previewLanguage === "th" ? "คำคม" : "Quote"}
                      </span>
                      <span className="rounded-xl bg-white/70 px-3 py-2 text-center text-[#2f2a24]">
                        {previewQuote ? `“${previewQuote}”` : "-"}
                      </span>
                    </section>
                    <p className="text-sm text-[#7b6d5f]">
                      Sort order: {form.sort_order}
                      {selectedPsychologist ? ` · Last updated ${formatDate(selectedPsychologist.updated_at)}` : ""}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 rounded-[24px] border border-[#e3d4c6] bg-white/75 p-4">
                  <div className="grid gap-1">
                    <span className="text-sm text-[#7b6d5f]">Topics</span>
                    <div className="flex flex-wrap gap-2">
                      {psychologistTopicOptions.map((topic) => (
                        <button
                          key={topic.key}
                          type="button"
                          onClick={() => toggleTopic(topic.key)}
                          className={[
                            "rounded-full border px-3 py-1.5 text-sm transition-colors",
                            form.topics.includes(topic.key)
                              ? "border-[#6f4f40] bg-[#6f4f40] text-white"
                              : "border-[#e3d4c6] bg-white text-[#7b6d5f] hover:bg-[#f7efe6] hover:text-[#2f2a24]",
                          ].join(" ")}
                        >
                          {topic.label.th}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2.5 md:grid-cols-[140px_minmax(0,1fr)]">
                    <label className="grid gap-1 text-sm text-[#7b6d5f]">
                      <span>Status</span>
                      <select
                        value={form.active ? "active" : "inactive"}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            active: event.target.value === "active",
                          }))
                        }
                        className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-3 text-sm text-[#2f2a24] outline-none"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-[#6f4f40] px-4 text-sm font-medium text-white transition-colors hover:bg-[#5d4337]"
                    disabled={saving}
                  >
                    <Save size={16} strokeWidth={2} />
                    {saving ? "Saving..." : "Save profile"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </section>
      )}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(37,27,19,0.36)] p-5 backdrop-blur-sm">
          <div className="w-full max-w-[460px] rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.96)] p-6 shadow-[0_20px_50px_rgba(65,43,27,0.18)]">
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              Confirm delete
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#2f2a24]">
              {deleteTarget.name_en}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#7b6d5f]">
              This will permanently delete the psychologist from Supabase.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
                onClick={() => setDeleteTarget(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#a941352e] bg-[#a94135] px-4 text-sm font-medium text-white transition-colors hover:bg-[#8f382d]"
                onClick={handleDelete}
                disabled={saving}
              >
                {saving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
