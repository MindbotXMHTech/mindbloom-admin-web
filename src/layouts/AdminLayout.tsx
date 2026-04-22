import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { BookText, LayoutDashboard, LogOut, Settings2, UsersRound } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import logoMindbloom from "../assets/svgs/logo-mindbloom.svg";

const PASSWORD_FLASH_KEY = "mindbloom-admin-password-flash";
const PASSWORD_FLASH_EVENT = "mindbloom-admin-flash";

const navItems = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/blog", label: "บทความ", icon: BookText },
  { to: "/psychologists", label: "นักจิตวิทยา", icon: UsersRound },
  { to: "/admins", label: "Admin", icon: Settings2 },
] as const;

export default function AdminLayout() {
  const { signOut } = useAuth();
  const [flash, setFlash] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    const readFlash = () => {
      const storedFlash = window.sessionStorage.getItem(PASSWORD_FLASH_KEY);
      if (!storedFlash) return;

      try {
        const parsed = JSON.parse(storedFlash) as {
          type: "success" | "error";
          message: string;
        };
        if (parsed.message) {
          setFlash(parsed);
        }
      } catch {
        // ignore malformed flash data
      } finally {
        window.sessionStorage.removeItem(PASSWORD_FLASH_KEY);
      }
    };

    readFlash();

    const handleFlash = (event: Event) => {
      const customEvent = event as CustomEvent<{
        type: "success" | "error";
        message: string;
      }>;

      if (customEvent.detail?.message) {
        setFlash(customEvent.detail);
      } else {
        readFlash();
      }
    };

    window.addEventListener(PASSWORD_FLASH_EVENT, handleFlash as EventListener);

    return () => {
      window.removeEventListener(PASSWORD_FLASH_EVENT, handleFlash as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!flash) return undefined;

    const timeout = window.setTimeout(() => {
      setFlash(null);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [flash]);

  return (
    <div className="min-h-screen grid grid-cols-[88px_minmax(0,1fr)] gap-4 p-4 max-md:grid-cols-1">
      {flash ? (
        <div
          className={[
            "fixed right-4 top-4 z-50 w-[min(420px,calc(100vw-2rem))] rounded-2xl border px-4 py-3 shadow-[0_20px_50px_rgba(65,43,27,0.18)] backdrop-blur-md",
            flash.type === "success"
              ? "border-[#b9d7b1] bg-[rgba(237,247,233,0.98)] text-[#35613a]"
              : "border-[#e3b6af] bg-[rgba(255,238,235,0.98)] text-[#8e3a32]",
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <strong className="text-sm font-semibold">
                {flash.type === "success" ? "Saved" : "Save failed"}
              </strong>
              <span className="text-sm leading-6">{flash.message}</span>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full p-1 transition-colors hover:bg-black/5"
              aria-label="Close notification"
              onClick={() => setFlash(null)}
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
      <aside className="sticky top-4 flex h-[calc(100vh-2rem)] flex-col items-center justify-between overflow-auto rounded-[30px] border border-[#e3d4c6d1] bg-[rgba(255,253,249,0.86)] px-2 py-3 shadow-[0_20px_50px_rgba(65,43,27,0.08)] backdrop-blur-[16px] max-md:static max-md:h-auto max-md:w-full max-md:items-stretch max-md:justify-start">
        <img className="mb-0 mt-[2px] block w-14 object-contain" src={logoMindbloom} alt="MindBloom" />

        <nav
          className="grid w-full flex-1 place-items-center max-md:my-0 max-md:max-w-none max-md:px-0 max-md:py-0"
          aria-label="Admin sections"
        >
          <div className="grid gap-2 rounded-[28px] bg-[rgba(255,255,255,0.48)] px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] max-md:w-full max-md:grid-cols-4 max-md:place-items-stretch max-md:rounded-[22px]">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                aria-label={item.label}
                title={item.label}
                className={({ isActive }) =>
                  [
                    "flex h-[50px] w-[50px] items-center justify-center rounded-[18px] border border-transparent transition-all duration-150 max-md:h-12 max-md:w-auto",
                    isActive
                      ? "border-[#9d7b682e] bg-[rgba(157,123,104,0.12)]"
                      : "hover:-translate-y-px hover:border-[#9d7b682e] hover:bg-[rgba(157,123,104,0.08)]",
                  ].join(" ")
                }
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-transparent text-[#6f4f40] max-md:h-auto max-md:w-auto"
                  aria-hidden="true"
                >
                  <item.icon size={18} strokeWidth={2} />
                </span>
                <span className="ml-2 hidden text-[13px] font-medium text-[#2f2a24] max-md:inline">
                  {item.label}
                </span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="mt-2 grid w-full justify-items-center gap-0 max-md:mt-3 max-md:grid-cols-1">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#a941352e] bg-[rgba(255,255,255,0.82)] text-[#a94135] transition-colors hover:bg-[rgba(169,65,53,0.08)]"
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <main className="min-w-0 grid gap-4">
        <Outlet />
      </main>
    </div>
  );
}
