"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import StatePanel from "@/components/StatePanel";
import { RECENT_LINKS_KEY, emitOpenCommandPalette } from "@/lib/navigation-command";

type NavLink = { href: string; label: string };
type NavGroup = { title: string; links: NavLink[] };
const GROUP_STATE_KEY = "hk_aiedu_nav_group_state_v1";
const SIDEBAR_COLLAPSE_KEY = "hk_aiedu_sidebar_collapsed_v1";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function pickMatchedLink(pathname: string, links: NavLink[]) {
  const matches = links.filter((item) => isActive(pathname, item.href));
  if (!matches.length) return null;
  return [...matches].sort((a, b) => b.href.length - a.href.length)[0];
}

function buildDefaultGroupOpenState(pathname: string, navGroups: NavGroup[]) {
  return navGroups.reduce<Record<string, boolean>>((acc, group) => {
    acc[group.title] = group.links.some((item) => isActive(pathname, item.href));
    return acc;
  }, {});
}

export default function RoleSidebarNav({
  primaryLinks,
  navGroups
}: {
  primaryLinks: NavLink[];
  navGroups: NavGroup[];
}) {
  const pathname = usePathname();
  const [groupOpenState, setGroupOpenState] = useState<Record<string, boolean>>({});
  const [recentHrefs, setRecentHrefs] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const allLinks = useMemo(() => {
    const seen = new Set<string>();
    const merged: NavLink[] = [];
    [...primaryLinks, ...navGroups.flatMap((group) => group.links)].forEach((item) => {
      if (seen.has(item.href)) return;
      seen.add(item.href);
      merged.push(item);
    });
    return merged;
  }, [primaryLinks, navGroups]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY);
      setCollapsed(raw === "1");
    } catch {
      setCollapsed(false);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-sidebar", collapsed ? "collapsed" : "expanded");
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore storage exceptions
    }
  }, [collapsed]);

  useEffect(() => {
    const defaults = buildDefaultGroupOpenState(pathname, navGroups);
    try {
      const raw = window.localStorage.getItem(GROUP_STATE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      setGroupOpenState({ ...defaults, ...parsed });
    } catch {
      setGroupOpenState(defaults);
    }
  }, [navGroups, pathname]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_LINKS_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      const validHrefSet = new Set(allLinks.map((item) => item.href));
      const next = parsed.filter((href) => validHrefSet.has(href)).slice(0, 6);
      setRecentHrefs(next);
    } catch {
      setRecentHrefs([]);
    }
  }, [allLinks]);

  useEffect(() => {
    const matched = pickMatchedLink(pathname, allLinks);
    if (!matched) return;
    setRecentHrefs((prev) => {
      const next = [matched.href, ...prev.filter((href) => href !== matched.href)].slice(0, 6);
      try {
        window.localStorage.setItem(RECENT_LINKS_KEY, JSON.stringify(next));
      } catch {
        // ignore storage exceptions
      }
      return next;
    });
  }, [pathname, allLinks]);

  const recentLinks = useMemo(() => {
    const hrefMap = new Map(allLinks.map((item) => [item.href, item]));
    return recentHrefs.map((href) => hrefMap.get(href)).filter(Boolean) as NavLink[];
  }, [allLinks, recentHrefs]);

  const normalizedSearch = searchKeyword.trim().toLowerCase();
  const matchByKeyword = useCallback(
    (item: NavLink) => {
      if (!normalizedSearch) return true;
      return (
        item.label.toLowerCase().includes(normalizedSearch) ||
        item.href.toLowerCase().includes(normalizedSearch)
      );
    },
    [normalizedSearch]
  );

  const visiblePrimaryLinks = useMemo(
    () => primaryLinks.filter((item) => matchByKeyword(item)),
    [primaryLinks, matchByKeyword]
  );
  const visibleRecentLinks = useMemo(
    () => recentLinks.filter((item) => matchByKeyword(item)),
    [recentLinks, matchByKeyword]
  );
  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({ ...group, links: group.links.filter((item) => matchByKeyword(item)) }))
        .filter((group) => group.links.length),
    [navGroups, matchByKeyword]
  );
  const visibleLinkCount = useMemo(() => {
    const byHref = new Set<string>();
    visiblePrimaryLinks.forEach((item) => byHref.add(item.href));
    visibleRecentLinks.forEach((item) => byHref.add(item.href));
    visibleGroups.forEach((group) => group.links.forEach((item) => byHref.add(item.href)));
    return byHref.size;
  }, [visiblePrimaryLinks, visibleRecentLinks, visibleGroups]);

  function toggleGroup(title: string) {
    setGroupOpenState((prev) => {
      const next = { ...prev, [title]: !(prev[title] ?? true) };
      try {
        window.localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage exceptions
      }
      return next;
    });
  }

  function renderNavLink(item: NavLink, key?: string) {
    return (
      <Link
        key={key ?? item.href}
        href={item.href}
        className={`role-side-link${isActive(pathname, item.href) ? " active" : ""}`}
        title={collapsed ? item.label : undefined}
        aria-label={item.label}
      >
        <span className="role-side-link-glyph" aria-hidden="true">
          {item.label.slice(0, 2)}
        </span>
        <span className="role-side-link-text">{item.label}</span>
      </Link>
    );
  }

  function setAllGroupState(nextOpen: boolean) {
    const next = navGroups.reduce<Record<string, boolean>>((acc, group) => {
      acc[group.title] = nextOpen;
      return acc;
    }, {});
    setGroupOpenState(next);
    try {
      window.localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage exceptions
    }
  }

  return (
    <nav className={`role-side-nav${collapsed ? " collapsed" : ""}`}>
      <div className="role-side-control">
        <button
          type="button"
          className="role-side-collapse-toggle"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-pressed={collapsed}
        >
          {collapsed ? "展开侧栏" : "收起侧栏"}
        </button>
      </div>

      {!collapsed ? (
        <div className="role-side-search">
          <input
            className="role-side-search-input"
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder="搜索入口（如：考试、报告、题库）"
            aria-label="搜索侧边栏入口"
          />
          {searchKeyword ? (
            <button type="button" className="role-side-search-clear" onClick={() => setSearchKeyword("")}>
              清空
            </button>
          ) : null}
          <div className="role-side-search-row">
            <div className="role-side-search-meta">
              已显示 {visibleLinkCount} / {allLinks.length} 个入口
            </div>
            <button type="button" className="role-side-search-launch" onClick={emitOpenCommandPalette}>
              全局搜索⌘K
            </button>
          </div>
        </div>
      ) : null}

      {!collapsed ? (
        <div className="role-side-actions">
          <button type="button" className="role-side-action" onClick={() => setAllGroupState(true)}>
            全展开
          </button>
          <button type="button" className="role-side-action" onClick={() => setAllGroupState(false)}>
            全收起
          </button>
        </div>
      ) : null}

      <div className="role-side-section">
        <div className="role-side-section-title">主线功能（{visiblePrimaryLinks.length}）</div>
        <div className="role-side-links">
          {visiblePrimaryLinks.map((item) => renderNavLink(item))}
        </div>
      </div>

      {visibleRecentLinks.length ? (
        <div className="role-side-section">
          <div className="role-side-section-title">最近访问</div>
          <div className="role-side-links">
            {visibleRecentLinks.map((item) => renderNavLink(item, `recent-${item.href}`))}
          </div>
        </div>
      ) : null}

      {visibleGroups.map((group, index) => {
        // 搜索模式下强制展开匹配分组，避免“搜到了但看不见”。
        const isGroupExpanded = normalizedSearch ? true : (groupOpenState[group.title] ?? false);

        return (
          <div key={group.title} className="role-side-section">
            <div className="role-side-section-head">
              <div className="role-side-section-title">
                <span className="role-side-step">{index + 1}</span>
                {group.title}（{group.links.length}）
              </div>
              <button
                type="button"
                className="role-side-group-toggle"
                onClick={() => toggleGroup(group.title)}
                aria-expanded={isGroupExpanded}
              >
                {isGroupExpanded ? "收起" : "展开"}
              </button>
            </div>
            {isGroupExpanded ? (
              <div className="role-side-links">
                {group.links.map((item) => renderNavLink(item))}
              </div>
            ) : null}
          </div>
        );
      })}

      {visibleLinkCount === 0 ? (
        <StatePanel
          compact
          tone="empty"
          title="没找到匹配入口"
          description="换个关键词，或者直接打开全局搜索。"
          action={
            <button type="button" className="button secondary" onClick={emitOpenCommandPalette}>
              打开全局搜索
            </button>
          }
        />
      ) : null}
    </nav>
  );
}
