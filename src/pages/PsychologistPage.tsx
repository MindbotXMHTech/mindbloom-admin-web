import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GripVertical, PencilLine, Plus, RefreshCw, Search } from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminIconButtonClass,
} from "../components/ui/adminButtonStyles";
import { resolvePsychologistPhotoUrl } from "../assets/images/psychologists";
import {
  formatPsychologistName,
  formatLicenseNumber,
  psychologistTopicOptions,
  type PsychologistRecord,
} from "./psychologists/psychologistShared";
import { LoadingBlock } from "../components/ui/loading";

export default function PsychologistPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [notice, setNotice] = useState("");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [psychologists, setPsychologists] = useState<PsychologistRecord[]>([]);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const loadPsychologists = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    setDraggedId(null);

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

    const nextPsychologists = (data ?? []) as PsychologistRecord[];
    setPsychologists(nextPsychologists);
    setOrderedIds(nextPsychologists.map((row) => row.id));
    setLoading(false);
  };

  useEffect(() => {
    void loadPsychologists();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;

    const timeout = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const orderedPsychologists = useMemo(() => {
    const byId = new Map(psychologists.map((row) => [row.id, row] as const));
    const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as PsychologistRecord[];
    const remaining = psychologists.filter((row) => !orderedIds.includes(row.id));
    return [...ordered, ...remaining];
  }, [orderedIds, psychologists]);

  const filtered = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return orderedPsychologists.filter((row) => {
      const matchesSearch =
        !query ||
        row.name_th.toLowerCase().includes(query) ||
        row.name_en.toLowerCase().includes(query) ||
        row.nickname_th.toLowerCase().includes(query) ||
        row.nickname_en.toLowerCase().includes(query) ||
        row.license_no.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && row.active) ||
        (statusFilter === "inactive" && !row.active);

      return matchesSearch && matchesStatus;
    });
  }, [orderedPsychologists, searchText, statusFilter]);

  const activeCount = psychologists.filter((row) => row.active).length;
  const inactiveCount = psychologists.filter((row) => !row.active).length;

  const moveItem = (fromId: string, toId: string) => {
    if (fromId === toId) return;

    setOrderedIds((current) => {
      const next = current.filter((id) => id !== fromId);
      const targetIndex = next.indexOf(toId);

      if (targetIndex === -1) {
        return [...next, fromId];
      }

      next.splice(targetIndex, 0, fromId);
      return next;
    });
  };

  const handleSaveOrder = async () => {
    setSavingOrder(true);
    setError("");
    setNotice("");

    const updates = orderedIds.map((id, index) =>
      supabase.from("psychologists").update({ sort_order: index }).eq("id", id),
    );

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      setError(failed.error.message);
      setSavingOrder(false);
      return;
    }

    await loadPsychologists();
    setNotice("Order saved successfully.");
    setSavingOrder(false);
  };

  return (
    <section className="grid gap-4">
      <section className="rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              Psychologist management
            </div>
            <h1 className="text-[clamp(30px,3vw,44px)] font-semibold tracking-tight text-[#2f2a24]">
              นักจิตวิทยา
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-[#7b6d5f]">
              Manage the therapist profiles shown on the public psychologist page.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={adminSecondaryButtonClass}
              onClick={loadPsychologists}
            >
              <RefreshCw size={16} strokeWidth={2} />
              Refresh
            </button>
            <button
              type="button"
              className={adminPrimaryButtonClass}
              onClick={() => navigate("/psychologists/create")}
            >
              <Plus size={16} strokeWidth={2} />
              New profile
            </button>
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

      <section className="grid gap-3 md:grid-cols-3">
        <article className="grid gap-2 rounded-2xl border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-4 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <span className="text-sm text-[#7b6d5f]">All profiles</span>
          <strong className="text-[28px] font-semibold tracking-tight text-[#2f2a24]">
            {psychologists.length}
          </strong>
          <p className="text-sm leading-6 text-[#7b6d5f]">Current psychologists in the system.</p>
        </article>
        <article className="grid gap-2 rounded-2xl border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-4 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <span className="text-sm text-[#7b6d5f]">Active</span>
          <strong className="text-[28px] font-semibold tracking-tight text-[#2f2a24]">
            {activeCount}
          </strong>
          <p className="text-sm leading-6 text-[#7b6d5f]">Visible on the public page.</p>
        </article>
        <article className="grid gap-2 rounded-2xl border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-4 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <span className="text-sm text-[#7b6d5f]">Inactive</span>
          <strong className="text-[28px] font-semibold tracking-tight text-[#2f2a24]">
            {inactiveCount}
          </strong>
          <p className="text-sm leading-6 text-[#7b6d5f]">Hidden from the public page.</p>
        </article>
      </section>

      <section className="rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-full border border-[#e3d4c6] bg-white px-4 py-2 text-sm text-[#7b6d5f]">
            <Search size={16} strokeWidth={2} />
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search by name or license"
              className="w-full bg-transparent text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-11 rounded-full border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {loading ? (
          <div className="mt-4 grid gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <article
                key={`psychologist-loading-row-${index}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e3d4c6] bg-white/80 p-4"
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <LoadingBlock className="h-10 w-10 rounded-full" />
                  <LoadingBlock className="h-16 w-16 rounded-2xl" />
                  <div className="min-w-0 flex-1 grid gap-2">
                    <LoadingBlock className="h-5 w-40 rounded-full" />
                    <LoadingBlock className="h-4 w-56 max-w-full rounded-full" />
                    <div className="flex flex-wrap gap-2 pt-1">
                      <LoadingBlock className="h-7 w-20 rounded-full" />
                      <LoadingBlock className="h-7 w-20 rounded-full" />
                      <LoadingBlock className="h-7 w-14 rounded-full" />
                    </div>
                  </div>
                </div>
                <LoadingBlock className="h-10 w-10 rounded-2xl" />
              </article>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[#e3d4c6] bg-white/70 p-5">
            <p className="text-sm leading-6 text-[#7b6d5f]">No psychologist profiles found.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {filtered.map((row) => (
              <article
                key={row.id}
                draggable
                onDragStart={() => setDraggedId(row.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedId) {
                    moveItem(draggedId, row.id);
                  }
                  setDraggedId(null);
                }}
                onDragEnd={() => setDraggedId(null)}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e3d4c6] bg-white/80 p-4"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e3d4c6] bg-white text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
                    title="Drag to reorder"
                    aria-label="Drag to reorder"
                  >
                    <GripVertical size={16} strokeWidth={2} />
                  </button>
                  <img
                    src={resolvePsychologistPhotoUrl(row.photo_url)}
                    alt={formatPsychologistName(row)}
                    className="h-16 w-16 rounded-2xl border border-[#e3d4c6] object-cover object-top"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="truncate text-[15px] font-semibold text-[#2f2a24]">
                        {formatPsychologistName(row)}
                      </strong>
                      <span
                        className={[
                          "inline-flex h-7 items-center rounded-full px-3 text-xs font-medium",
                          row.active
                            ? "bg-[rgba(185,215,177,0.3)] text-[#35613a]"
                            : "bg-[rgba(231,228,222,0.9)] text-[#7b6d5f]",
                        ].join(" ")}
                      >
                        {row.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#7b6d5f]">
                      <span>{row.nickname_en || row.nickname_th}</span>
                      <span>{formatLicenseNumber(row.license_no) || row.license_no}</span>
                      <span>Updated {new Date(row.updated_at).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {row.topics.slice(0, 3).map((topic) => {
                        const topicLabel =
                          psychologistTopicOptions.find((option) => option.key === topic)?.label
                            .th ?? topic;
                        return (
                          <span
                            key={topic}
                            className="rounded-full bg-[#c6d5c4] px-3 py-1 text-[13px] text-white"
                          >
                            {topicLabel}
                          </span>
                        );
                      })}
                      {row.topics.length > 3 ? (
                        <span className="inline-flex h-7 items-center rounded-full border border-[#e3d4c6] bg-white px-3 text-xs font-medium text-[#7b6d5f]">
                          +{row.topics.length - 3}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <Link
                  to={`/psychologists/edit/${row.id}`}
                  className={adminIconButtonClass}
                >
                  <PencilLine size={16} strokeWidth={2} />
                </Link>
              </article>
            ))}
          </div>
        )}

        {!loading && filtered.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#7b6d5f]">
              Drag profiles to reorder them, then save the new order.
            </p>
            <button
              type="button"
              className={adminPrimaryButtonClass}
              onClick={handleSaveOrder}
              disabled={savingOrder}
            >
              <RefreshCw size={16} strokeWidth={2} />
              {savingOrder ? "Saving..." : "Save order"}
            </button>
          </div>
        ) : null}
      </section>
    </section>
  );
}
