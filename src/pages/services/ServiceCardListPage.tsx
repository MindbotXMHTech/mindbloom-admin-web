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
import consult1Icon from "../../assets/svgs/consult1.svg";
import consult2Icon from "../../assets/svgs/consult2.svg";
import consult3Icon from "../../assets/svgs/consult3.svg";
import ServicesSubnav from "./ServicesSubnav";
import {
  formatDateTime,
  type ServiceCardRecord,
} from "./serviceCardShared";

export default function ServiceCardListPage() {
  const navigate = useNavigate();
  const [cards, setCards] = useState<ServiceCardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const loadCards = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    setDraggedId(null);

    const { data, error: queryError } = await supabase
      .from("service_cards")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setCards([]);
      setLoading(false);
      return;
    }

    const nextCards = (data ?? []) as ServiceCardRecord[];
    setCards(nextCards);
    setOrderedIds(nextCards.map((card) => card.id));
    setLoading(false);
  };

  useEffect(() => {
    void loadCards();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;

    const timeout = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const orderedCards = useMemo(() => {
    const byId = new Map(cards.map((card) => [card.id, card] as const));
    const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as ServiceCardRecord[];
    const remaining = cards.filter((card) => !orderedIds.includes(card.id));
    return [...ordered, ...remaining];
  }, [cards, orderedIds]);

  const visibleCards = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orderedCards.filter((card) => {
      const matchesSearch =
        term.length === 0 ||
        [
          card.title_primary_th,
          card.title_primary_en,
          card.title_secondary_th,
          card.title_secondary_en,
          card.slug,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);

      const matchesActive =
        activeFilter === "all" ? true : activeFilter === "active" ? card.active : !card.active;

      return matchesSearch && matchesActive;
    });
  }, [activeFilter, orderedCards, search]);

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
      supabase.from("service_cards").update({ sort_order: index }).eq("id", id),
    );

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      setError(failed.error.message);
      setSavingOrder(false);
      return;
    }

    await loadCards();
    setNotice("Order saved successfully.");
    setSavingOrder(false);
  };

  const iconMap: Record<string, string> = {
    consult1: consult1Icon,
    consult2: consult2Icon,
    consult3: consult3Icon,
  };

  return (
    <section className="grid content-start gap-4">
      <section className="self-start rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              Services management
            </div>
            <h1 className="text-[clamp(30px,3vw,44px)] font-semibold tracking-tight text-[#2f2a24]">
              Service cards
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-[#7b6d5f]">
              Manage the long service cards shown on the public services page.
            </p>
          </div>
          <ServicesSubnav />
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
                  placeholder="Search by title or slug"
                  className="w-full bg-transparent text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                />
              </div>
            </label>

            <label className="grid gap-2 text-sm text-[#7b6d5f]">
              <span>Status</span>
              <select
                value={activeFilter}
                onChange={(event) =>
                  setActiveFilter(event.target.value as "all" | "active" | "inactive")
                }
                className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-3 text-sm text-[#2f2a24] outline-none"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className={adminSecondaryButtonClass} onClick={loadCards}>
              <RefreshCw size={16} strokeWidth={2} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate("/services/cards/create")}
              className={adminPrimaryButtonClass}
            >
              <Plus size={16} strokeWidth={2} />
              New service card
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
              Service card list
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#2f2a24]">
              {visibleCards.length} items
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <article
                key={`service-card-loading-${index}`}
                className="grid gap-3 rounded-[20px] border border-[#e3d4c6] bg-white/80 p-4 shadow-[0_10px_24px_rgba(65,43,27,0.04)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 grid gap-2">
                    <LoadingBlock className="h-5 w-2/3 rounded-full" />
                    <LoadingBlock className="h-4 w-1/4 rounded-full" />
                    <LoadingBlock className="h-4 w-full rounded-full" />
                    <LoadingBlock className="h-4 w-5/6 rounded-full" />
                  </div>
                  <div className="flex items-center gap-2">
                    <LoadingBlock className="h-7 w-20 rounded-full" />
                    <LoadingBlock className="h-10 w-10 rounded-full" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : visibleCards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e3d4c6] bg-white/70 p-5">
            <h3 className="text-lg font-semibold text-[#2f2a24]">No service cards yet</h3>
            <p className="mt-1 text-sm leading-6 text-[#7b6d5f]">
              Create your first service card to manage the public services page.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleCards.map((card) => (
              <article
                key={card.id}
                draggable
                onDragStart={() => setDraggedId(card.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedId) {
                    moveItem(draggedId, card.id);
                  }
                  setDraggedId(null);
                }}
                onDragEnd={() => setDraggedId(null)}
                className="rounded-[20px] border border-[#e3d4c6] bg-white/80 p-4 shadow-[0_10px_24px_rgba(65,43,27,0.04)]"
              >
                <div className="grid grid-cols-[40px_52px_minmax(0,1fr)_auto] items-start gap-4">
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 shrink-0 self-center items-center justify-center rounded-full border border-[#e3d4c6] bg-white text-[#7b6d5f]"
                    title="Drag to reorder"
                    aria-label="Drag to reorder"
                  >
                    <GripVertical size={16} strokeWidth={2} />
                  </button>

                  <div className="grid h-[52px] w-[52px] shrink-0 self-center place-items-center rounded-[18px] border border-[#eadbce] bg-[rgba(244,237,230,0.7)] p-2">
                    {card.icon_image_url || iconMap[card.icon_key] ? (
                      <img
                        src={card.icon_image_url || iconMap[card.icon_key]}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-[11px] font-medium leading-4 text-[#7b6d5f]">Icon</span>
                    )}
                  </div>

                  <div className="grid min-w-0 content-center gap-2 py-1">
                    <div className="grid min-w-0 gap-1">
                      <strong className="block text-[15px] leading-6 font-semibold text-[#2f2a24]">
                        {card.title_primary_th || card.title_primary_en}
                      </strong>
                      {card.title_secondary_th || card.title_secondary_en ? (
                        <div className="text-sm leading-6 text-[#7b6d5f]">
                          {card.title_secondary_th || card.title_secondary_en}
                        </div>
                      ) : null}
                    </div>

                    <div className="text-xs leading-5 text-[#9c8c7e]">
                      Updated {formatDateTime(card.updated_at)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start">
                    <span
                      className={[
                        "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium",
                        card.active
                          ? "bg-[rgba(185,215,177,0.3)] text-[#35613a]"
                          : "bg-[rgba(231,228,222,0.9)] text-[#7b6d5f]",
                      ].join(" ")}
                    >
                      {card.active ? "Active" : "Inactive"}
                    </span>
                    <Link
                      className={adminIconButtonClass}
                      to={`/services/cards/edit/${card.id}`}
                      aria-label={`Edit ${card.title_primary_en}`}
                      title="Edit service card"
                    >
                      <PencilLine size={15} strokeWidth={2} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && visibleCards.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#7b6d5f]">
              Drag service cards to reorder them, then save the new order.
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
