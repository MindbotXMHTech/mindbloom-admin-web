import { NavLink } from "react-router-dom";

const items = [
  { to: "/services/cards", label: "Service cards" },
  { to: "/services/workshop-categories", label: "Workshop categories" },
  { to: "/services/workshop-programs", label: "Workshop programs" },
] as const;

export default function ServicesSubnav() {
  return (
    <nav
      className="inline-flex w-fit flex-wrap items-center gap-6 self-start"
      aria-label="Services content sections"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            [
              "inline-flex h-9 items-center px-0.5 pb-1 text-sm font-medium leading-none transition-colors",
              isActive
                ? "text-[#2f2a24] shadow-[inset_0_-2px_0_0_#6f4f40]"
                : "text-[#a89689] hover:text-[#5f5247]",
            ].join(" ")
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
