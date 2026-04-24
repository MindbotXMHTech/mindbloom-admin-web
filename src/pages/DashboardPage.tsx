import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatDate, statusClass, statusLabel, type BlogPost } from "./blog/blogShared";
import { useAuth } from "../auth/AuthProvider";
import { LoadingBlock } from "../components/ui/loading";

type OverviewCounts = {
  totalArticles: number;
  publishedArticles: number;
  draftArticles: number;
  archivedArticles: number;
  activities: number;
  psychologistProfiles: number;
};

const quickActions = [
  { title: "Open articles", description: "Review and update blog content.", to: "/blog" },
  { title: "Create article", description: "Start a new blog post from scratch.", to: "/blog/create" },
  {
    title: "Manage activities",
    description: "Update the events and gallery content shown publicly.",
    to: "/activities",
  },
  {
    title: "Manage psychologists",
    description: "Set up therapist profiles and availability.",
    to: "/psychologists",
  },
] as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [counts, setCounts] = useState<OverviewCounts>({
    totalArticles: 0,
    publishedArticles: 0,
    draftArticles: 0,
    archivedArticles: 0,
    activities: 0,
    psychologistProfiles: 0,
  });
  const [recentPosts, setRecentPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      setLoading(true);
      setError("");

      const [
        { data: postsData, error: postsError },
        { count: activityCount, error: activityError },
        { count: psychologistCount, error: psychologistError },
        { data: adminData, error: adminError },
      ] = await Promise.all([
        supabase
          .from("blog_posts")
          .select("id,status,slug,title_th,title_en,updated_at")
          .order("updated_at", { ascending: false })
          .order("sort_order", { ascending: true }),
        supabase.from("activities").select("id", { count: "exact", head: true }),
        supabase.from("psychologists").select("id", { count: "exact", head: true }),
        user?.id
          ? supabase
              .from("admin_users")
              .select("display_name,email,needs_password_setup")
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (!active) return;

      if (postsError) {
        setError(postsError.message);
      } else {
        const posts = (postsData ?? []) as BlogPost[];
        setRecentPosts(posts);
        setCounts({
          totalArticles: posts.length,
          publishedArticles: posts.filter((post) => post.status === "published").length,
          draftArticles: posts.filter((post) => post.status === "draft").length,
          archivedArticles: posts.filter((post) => post.status === "archived").length,
          activities: activityCount ?? 0,
          psychologistProfiles: psychologistCount ?? 0,
        });
      }

      if (activityError) {
        setError((current) => current || activityError.message);
      }

      if (psychologistError) {
        setError((current) => current || psychologistError.message);
      }

      if (adminError) {
        setError((current) => current || adminError.message);
      } else {
        const adminRow = adminData as { display_name?: string | null; email?: string | null } | null;
        setDisplayName(
          adminRow?.display_name?.trim() ||
            adminRow?.email?.split("@")[0] ||
            user?.email?.split("@")[0] ||
            "",
        );
        setNeedsPasswordSetup(
          Boolean(
            (adminData as { needs_password_setup?: boolean } | null)?.needs_password_setup,
          ),
        );
      }

      setLoading(false);
    };

    void loadOverview();

    return () => {
      active = false;
    };
  }, [user]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <section className="grid gap-4">
      <section className="overflow-hidden rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="grid gap-2">
          <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
            Overview
          </div>
          <h2 className="text-[clamp(30px,3vw,44px)] font-semibold tracking-tight text-[#2f2a24]">
            {greeting}
            {displayName ? `, ${displayName}` : user?.email ? `, ${user.email.split("@")[0]}` : ""}
          </h2>
          <p className="max-w-2xl text-[15px] leading-7 text-[#7b6d5f]">
            Track articles, activities, and psychologist content from one place.
          </p>
        </div>
      </section>

      {needsPasswordSetup ? (
        <section className="rounded-[24px] border border-[#d9c7b8] bg-[rgba(255,247,238,0.95)] px-5 py-4 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <strong className="text-[15px] font-semibold text-[#2f2a24]">
                Finish your account setup
              </strong>
              <p className="text-sm leading-6 text-[#7b6d5f]">
                Please set a new password in{" "}
                <span className="font-medium text-[#2f2a24]">Admin management</span> before regular use.
              </p>
            </div>
            <Link
              to="/admins"
              className="inline-flex h-10 items-center justify-center rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
            >
              Go to account settings
            </Link>
          </div>
        </section>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] px-4 py-3 text-sm text-[#a94135] shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          {error}
        </p>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }, (_, index) => (
              <article
                key={`overview-loading-card-${index}`}
                className="grid gap-3 rounded-2xl border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-4 shadow-[0_14px_36px_rgba(65,43,27,0.06)]"
              >
                <LoadingBlock className="h-4 w-24 rounded-full" />
                <LoadingBlock className="h-8 w-16 rounded-2xl" />
                <LoadingBlock className="h-4 w-full rounded-full" />
                <LoadingBlock className="h-4 w-4/5 rounded-full" />
              </article>
            ))
          : [
              {
                label: "Total articles",
                value: counts.totalArticles,
                description: "All blog posts currently in the system.",
              },
              {
                label: "Published",
                value: counts.publishedArticles,
                description: "Visible on the public website right now.",
              },
              {
                label: "Drafts",
                value: counts.draftArticles,
                description: "Saved but hidden from visitors.",
              },
              {
                label: "Activities",
                value: counts.activities,
                description: "Event entries available for the public site.",
              },
              {
                label: "Psychologists",
                value: counts.psychologistProfiles,
                description: "Profiles ready for the therapist section.",
              },
            ].map((item) => (
              <article
                key={item.label}
                className="grid gap-2 rounded-2xl border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-4 shadow-[0_14px_36px_rgba(65,43,27,0.06)]"
              >
                <span className="text-sm text-[#7b6d5f]">{item.label}</span>
                <strong className="text-[28px] font-semibold tracking-tight text-[#2f2a24]">
                  {item.value}
                </strong>
                <p className="text-sm leading-6 text-[#7b6d5f]">{item.description}</p>
              </article>
            ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <article className="rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
                Quick actions
              </div>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-[#2f2a24]">Jump in</h3>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="grid gap-1 rounded-2xl border border-[#e3d4c6] bg-white/80 p-4 transition-transform duration-150 hover:-translate-y-0.5 hover:border-[#9d7b6848] hover:bg-white"
              >
                <strong className="text-[15px] font-semibold text-[#2f2a24]">{action.title}</strong>
                <span className="text-sm leading-6 text-[#7b6d5f]">{action.description}</span>
              </Link>
            ))}
          </div>
        </article>

        <article className="grid gap-4 rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <div>
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              Recent updates
            </div>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-[#2f2a24]">
              Latest articles
            </h3>
          </div>

          <div className="grid gap-3">
            {loading ? (
              Array.from({ length: 3 }, (_, index) => (
                <div
                  key={`overview-loading-post-${index}`}
                  className="grid gap-3 rounded-2xl border border-[#e3d4c6] bg-white/80 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 grid gap-2">
                      <LoadingBlock className="h-5 w-2/3 rounded-full" />
                      <LoadingBlock className="h-4 w-1/3 rounded-full" />
                    </div>
                    <div className="grid justify-items-end gap-2">
                      <LoadingBlock className="h-6 w-20 rounded-full" />
                      <LoadingBlock className="h-4 w-24 rounded-full" />
                    </div>
                  </div>
                </div>
              ))
            ) : recentPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e3d4c6] bg-white/70 p-5">
                <h4 className="text-lg font-semibold text-[#2f2a24]">No articles yet</h4>
                <p className="mt-1 text-sm leading-6 text-[#7b6d5f]">
                  Create your first article to fill this overview.
                </p>
              </div>
            ) : (
              recentPosts.slice(0, 3).map((post) => (
                <div
                  key={post.id}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-[#e3d4c6] bg-white/80 p-4"
                >
                  <div className="min-w-0">
                    <strong className="block truncate text-[15px] font-semibold text-[#2f2a24]">
                      {post.title_th || post.title_en}
                    </strong>
                    <div className="mt-1 truncate text-sm text-[#7b6d5f]">{post.slug}</div>
                  </div>
                  <div className="grid justify-items-end gap-2 text-right text-sm text-[#7b6d5f]">
                    <span className={statusClass(post.status)}>
                      {statusLabel(post.status)}
                    </span>
                    <span>Updated {formatDate(post.updated_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </section>
  );
}
