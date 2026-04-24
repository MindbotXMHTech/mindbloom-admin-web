import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GripVertical, PencilLine, Plus, RefreshCw, Search } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  adminIconButtonClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "../../components/ui/adminButtonStyles";
import { LoadingBlock } from "../../components/ui/loading";
import {
  formatDateTime,
  getActivityPreviewText,
  statusClass,
  statusLabel,
  type ActivityRecord,
  type ActivityStatus,
} from "./activityShared";

export default function ActivityListPage() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ActivityStatus>("all");
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const loadActivities = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    setDraggedId(null);

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

    const nextActivities = (data ?? []) as ActivityRecord[];
    setActivities(nextActivities);
    setOrderedIds(nextActivities.map((activity) => activity.id));
    setLoading(false);
  };

  useEffect(() => {
    void loadActivities();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;

    const timeout = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const orderedActivities = useMemo(() => {
    const byId = new Map(activities.map((activity) => [activity.id, activity] as const));
    const ordered = orderedIds
      .map((id) => byId.get(id))
      .filter(Boolean) as ActivityRecord[];
    const remaining = activities.filter((activity) => !orderedIds.includes(activity.id));
    return [...ordered, ...remaining];
  }, [activities, orderedIds]);

  const visibleActivities = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orderedActivities.filter((activity) => {
      const matchesSearch =
        term.length === 0 ||
        [
          activity.title_th,
          activity.title_en,
          activity.slug,
          activity.summary_th ?? "",
          activity.summary_en ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);

      const matchesStatus =
        statusFilter === "all" ? true : activity.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orderedActivities, search, statusFilter]);

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
      supabase.from("activities").update({ sort_order: index }).eq("id", id),
    );

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      setError(failed.error.message);
      setSavingOrder(false);
      return;
    }

    await loadActivities();
    setNotice("Order saved successfully.");
    setSavingOrder(false);
  };

  const getDisplayTitle = (activity: ActivityRecord) => activity.title_th || activity.title_en;

  return (
    <section className="grid content-start gap-4">
      <section className="self-start rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="flex w-full flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              Activity management
            </div>
            <h1 className="text-[clamp(30px,3vw,44px)] font-semibold tracking-tight text-[#2f2a24]">
              กิจกรรม
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-[#7b6d5f]">
              One page for activity list, separate page for create and edit.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 lg:self-start">
            {[
              { label: "All", value: activities.length },
              {
                label: "Published",
                value: activities.filter((activity) => activity.status === "published").length,
              },
              {
                label: "Draft",
                value: activities.filter((activity) => activity.status === "draft").length,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="min-w-0 rounded-2xl border border-[#e3d4c6] bg-white/75 px-4 py-3"
              >
                <div className="text-xs font-medium text-[#7b6d5f]">{stat.label}</div>
                <strong className="mt-1 block text-2xl font-semibold tracking-tight text-[#2f2a24]">
                  {stat.value}
                </strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="self-start rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-4 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="flex w-full flex-wrap items-end justify-between gap-4">
          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_160px]">
            <label className="grid gap-2 text-sm text-[#7b6d5f]">
              <span>Search</span>
              <div className="flex h-11 items-center gap-2 rounded-2xl border border-[#e3d4c6] bg-white px-3">
                <Search size={16} className="shrink-0 text-[#9d7b68]" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title or page link"
                  className="w-full bg-transparent text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                />
              </div>
            </label>

            <label className="grid gap-2 text-sm text-[#7b6d5f]">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | ActivityStatus)
                }
                className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-3 text-sm text-[#2f2a24] outline-none"
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={adminSecondaryButtonClass}
              onClick={loadActivities}
            >
              <RefreshCw size={16} strokeWidth={2} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate("/activities/create")}
              className={adminPrimaryButtonClass}
            >
              <Plus size={16} strokeWidth={2} />
              New activity
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

      <section className="self-start rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              Activity list
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#2f2a24]">
              {visibleActivities.length} items
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <article
                key={`activity-loading-row-${index}`}
                className="grid gap-3 rounded-[20px] border border-[#e3d4c6] bg-white/80 p-4 shadow-[0_10px_24px_rgba(65,43,27,0.04)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 grid gap-2">
                    <LoadingBlock className="h-5 w-2/3 rounded-full" />
                    <LoadingBlock className="h-4 w-1/4 rounded-full" />
                    <div className="flex flex-wrap gap-2 pt-1">
                      <LoadingBlock className="h-4 w-24 rounded-full" />
                      <LoadingBlock className="h-4 w-16 rounded-full" />
                    </div>
                    <LoadingBlock className="h-4 w-full rounded-full" />
                    <LoadingBlock className="h-4 w-5/6 rounded-full" />
                  </div>
                  <div className="flex items-center gap-2">
                    <LoadingBlock className="h-7 w-20 rounded-full" />
                    <LoadingBlock className="h-10 w-10 rounded-2xl" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : visibleActivities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e3d4c6] bg-white/70 p-5">
            <h3 className="text-lg font-semibold text-[#2f2a24]">No activities yet</h3>
            <p className="mt-1 text-sm leading-6 text-[#7b6d5f]">
              Create your first activity to start managing public content.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleActivities.map((activity) => (
              <article
                key={activity.id}
                draggable
                onDragStart={() => setDraggedId(activity.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedId) {
                    moveItem(draggedId, activity.id);
                  }
                  setDraggedId(null);
                }}
                onDragEnd={() => setDraggedId(null)}
                className="rounded-[20px] border border-[#e3d4c6] bg-white/80 p-4 shadow-[0_10px_24px_rgba(65,43,27,0.04)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 shrink-0 self-center items-center justify-center rounded-full border border-[#e3d4c6] bg-white text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
                      title="Drag to reorder"
                      aria-label="Drag to reorder"
                    >
                      <GripVertical size={16} strokeWidth={2} />
                    </button>

                    <div className="h-20 w-20 shrink-0 self-center overflow-hidden rounded-[18px] border border-[#e3d4c6] bg-[#f6efe6]">
                      {activity.cover_image_url ? (
                        <img
                          src={activity.cover_image_url}
                          alt={getDisplayTitle(activity)}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>

                    <div className="grid min-w-0 flex-1 content-center gap-1.5 py-1">
                      <strong className="block text-[15px] leading-6 font-semibold text-[#2f2a24]">
                        {getDisplayTitle(activity)}
                      </strong>
                      <div className="text-sm leading-6 text-[#7b6d5f]">{activity.slug}</div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm leading-6 text-[#7b6d5f]">
                        <span>Updated {formatDateTime(activity.updated_at)}</span>
                        <span>Sort {activity.sort_order}</span>
                      </div>
                      <p className="line-clamp-2 text-sm leading-6 text-[#7b6d5f]">
                        {getActivityPreviewText(
                          activity.summary_en,
                          activity.summary_th,
                          activity.content_en,
                          activity.content_th,
                          "th",
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start">
                    <span className={statusClass(activity.status)}>
                      {statusLabel(activity.status)}
                    </span>
                    <Link
                      className={adminIconButtonClass}
                      to={`/activities/edit/${activity.id}`}
                      aria-label={`Edit ${getDisplayTitle(activity)}`}
                      title="Edit activity"
                    >
                      <PencilLine size={15} strokeWidth={2} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && visibleActivities.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#7b6d5f]">
              Drag activities to reorder them, then save the new order.
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
