"use client";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  Content,
  Header,
  HeaderMenuButton,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderName,
  SideNav,
  SideNavItems,
  SideNavLink,
  SkipToContent,
  Theme,
} from "@carbon/react";
import {
  CalendarHeatMap,
  ChartColumn,
  Dashboard,
  FolderDetails,
  Logout,
  ReportData,
  Settings,
  UserAdmin,
  UserAvatar,
} from "@carbon/icons-react";

import { cn } from "@/lib/utils/format";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: Dashboard },
  { href: "/project-status", label: "Project status", icon: ChartColumn },
  { href: "/projects", label: "Projects", icon: FolderDetails },
  { href: "/weekly-updates/new", label: "Weekly Update", icon: CalendarHeatMap },
  { href: "/reports", label: "Reports", icon: ReportData },
  { href: "/admin", label: "Admin", icon: UserAdmin },
];

export function AppShellFrame({
  children,
  user,
}: {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    role: string;
  };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 48rem)");

    function syncLayout(event: MediaQueryList | MediaQueryListEvent) {
      const desktop = event.matches;
      setIsDesktop(desktop);
      setOpen(desktop);
    }

    syncLayout(media);
    media.addEventListener("change", syncLayout);

    return () => {
      media.removeEventListener("change", syncLayout);
    };
  }, []);

  return (
    <Theme theme="g10">
      <SkipToContent />
      <Header className="app-shell-header" aria-label="IMKAN Digital Portfolio Tracker">
        <HeaderMenuButton
          aria-label={open ? "Collapse navigation menu" : "Expand navigation menu"}
          className="app-shell__menu-button"
          isCollapsible
          isActive={open}
          onClick={() => setOpen((value) => !value)}
        />
        <HeaderName prefix="IMKAN">Digital Portfolio Tracker</HeaderName>
        <HeaderGlobalBar>
          <div className="app-shell-identity" aria-label={user.email}>
            <div className="app-shell-identity__avatar" aria-hidden="true">
              <UserAvatar size={20} />
            </div>
            <div className="app-shell-identity__meta">
              <strong>{user.name}</strong>
              <span>{user.role.toUpperCase()}</span>
            </div>
          </div>
          <HeaderGlobalAction aria-label="Settings" tooltipAlignment="end">
            <Settings size={20} />
          </HeaderGlobalAction>
          <HeaderGlobalAction
            aria-label="Sign out"
            tooltipAlignment="end"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <Logout size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>
      <SideNav
        expanded={open}
        isChildOfHeader
        isFixedNav={isDesktop && open}
        isPersistent={isDesktop}
        isRail={isDesktop && !open}
        className={cn(isDesktop && !open && "app-shell-side-nav--rail")}
        aria-label="Side navigation"
        onOverlayClick={() => setOpen(false)}
      >
        <SideNavItems>
          {NAV_ITEMS.filter((item) => (user.role === "admin" ? true : item.href !== "/admin")).map(
            (item) => (
              <SideNavLink
                key={item.href}
                href={item.href}
                isActive={pathname.startsWith(item.href)}
                renderIcon={item.icon}
                className={cn(pathname.startsWith(item.href) && "is-active")}
                aria-label={item.label}
                onClick={(event) => {
                  event.preventDefault();
                  window.location.href = item.href;
                }}
              >
                {item.label}
              </SideNavLink>
            ),
          )}
        </SideNavItems>
      </SideNav>
      <Content
        id="main-content"
        className={`app-content ${
          isDesktop ? (open ? "app-content--with-fixed-nav" : "app-content--with-collapsed-nav") : ""
        }`}
      >
        {children}
      </Content>
    </Theme>
  );
}
