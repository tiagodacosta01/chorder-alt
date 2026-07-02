"use client";

import clsx from "clsx";
import { ListMusic, Music, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const t = useTranslations("Messages");
  const pathname = usePathname();
  const pathParts = pathname.split("/");
  const currentPage = pathParts[1];
  const isEditPage = pathname.includes("/edit") || pathname.endsWith("/new");

  // Página de lista: /songs ou /services (sem slug)
  const isListPage = pathParts.length === 2;

  if (isEditPage) return null;

  const items = (
    <>
      <NavItem
        href="/services"
        icon={<ListMusic size={24} />}
        label={t("services")}
        active={currentPage === "services"}
      />
      <NavItem
        href="/songs"
        icon={<Music size={24} />}
        label={t("songs")}
        active={currentPage === "songs"}
      />
      <NavItem
        href="/admin"
        icon={<Settings size={24} />}
        label={t("admin")}
        active={currentPage === "admin"}
      />
    </>
  );

  return (
    <>
      {/* Sidebar — sempre visível em sm+ nas listas, só em lg+ nas views */}
      <nav className={clsx(
        "flex-col fixed left-0 top-0 h-full w-20 bg-zinc-50 border-r border-border",
        isListPage ? "hidden sm:flex" : "hidden lg:flex"
      )}>
        <div className="flex flex-col items-center pt-12 lg:pt-16 gap-6">
          {items}
        </div>
      </nav>

      {/* Bottom nav — só nas páginas de lista e só no mobile */}
      {isListPage && (
        <nav className="sm:hidden fixed bottom-0 left-0 w-full z-40 bg-white/80 backdrop-blur-lg shadow-md border-t border-gray-100">
          <div className="flex justify-around py-3">
            {items}
          </div>
        </nav>
      )}
    </>
  );
}

type NavItemProps = {
  href: string;
  icon: JSX.Element;
  label: string;
  active: boolean;
};

function NavItem({ href, icon, label, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center text-sm ${
        active ? "text-secondary font-semibold" : "text-muted-foreground"
      }`}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </Link>
  );
}
