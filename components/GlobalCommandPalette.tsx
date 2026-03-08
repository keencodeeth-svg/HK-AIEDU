"use client";

import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import StatePanel from "@/components/StatePanel";
import { COMMAND_PALETTE_OPEN_EVENT, RECENT_LINKS_KEY } from "@/lib/navigation-command";

type NavLink = { href: string; label: string };
type NavGroup = { title: string; links: NavLink[] };
type SearchItem = NavLink & {
  group: string;
  groupType: "primary" | "group" | "recent";
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isSameDestination(pathname: string, href: string) {
  return pathname === href;
}

function mergeLinks(primaryLinks: NavLink[], navGroups: NavGroup[]) {
  const merged: SearchItem[] = [];
  const seen = new Set<string>();

  primaryLinks.forEach((item) => {
    if (seen.has(item.href)) return;
    seen.add(item.href);
    merged.push({ ...item, group: "核心功能", groupType: "primary" });
  });

  navGroups.forEach((group) => {
    group.links.forEach((item) => {
      if (seen.has(item.href)) return;
      seen.add(item.href);
      merged.push({ ...item, group: group.title, groupType: "group" });
    });
  });

  return merged;
}

function rankItem(item: SearchItem, query: string, recentHrefs: string[]) {
  const normalized = query.trim().toLowerCase();
  const label = item.label.toLowerCase();
  const href = item.href.toLowerCase();
  const group = item.group.toLowerCase();
  if (!normalized) return 0;
  if (!label.includes(normalized) && !href.includes(normalized) && !group.includes(normalized)) return -1;

  let score = 0;
  if (label === normalized) score += 120;
  if (label.startsWith(normalized)) score += 80;
  if (label.includes(normalized)) score += 48;
  if (group.includes(normalized)) score += 22;
  if (href.includes(normalized)) score += 14;
  const recentIndex = recentHrefs.indexOf(item.href);
  if (recentIndex >= 0) {
    score += Math.max(0, 24 - recentIndex * 4);
  }
  return score;
}

export default function GlobalCommandPalette({
  roleLabel,
  primaryLinks,
  navGroups
}: {
  roleLabel: string;
  primaryLinks: NavLink[];
  navGroups: NavGroup[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentHrefs, setRecentHrefs] = useState<string[]>([]);

  const mergedLinks = useMemo(() => mergeLinks(primaryLinks, navGroups), [primaryLinks, navGroups]);
  const currentPageItem = useMemo(
    () => mergedLinks.find((item) => isSameDestination(pathname, item.href)) ?? null,
    [mergedLinks, pathname]
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_LINKS_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      setRecentHrefs(parsed);
    } catch {
      setRecentHrefs([]);
    }
  }, []);

  useEffect(() => {
    const active = mergedLinks.find((item) => isActive(pathname, item.href));
    if (!active) return;

    setRecentHrefs((prev) => {
      const next = [active.href, ...prev.filter((href) => href !== active.href)].slice(0, 8);
      try {
        window.localStorage.setItem(RECENT_LINKS_KEY, JSON.stringify(next));
      } catch {
        // ignore storage exceptions
      }
      return next;
    });
  }, [pathname, mergedLinks]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };

    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen as EventListener);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen as EventListener);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      document.body.style.overflow = "";
      window.clearTimeout(timer);
    };
  }, [open]);

  const recentLinks = useMemo(() => {
    const hrefMap = new Map(mergedLinks.map((item) => [item.href, item]));
    return recentHrefs
      .map((href) => hrefMap.get(href))
      .filter(Boolean)
      .map((item) => ({ ...item!, groupType: "recent" as const, group: "最近访问" }))
      .filter((item) => !isSameDestination(pathname, item.href))
      .slice(0, 6);
  }, [mergedLinks, pathname, recentHrefs]);

  const featuredLinks = useMemo(() => {
    const deduped = new Set<string>();
    return [...primaryLinks, ...navGroups.flatMap((group) => group.links)]
      .filter((item) => {
        if (deduped.has(item.href)) return false;
        deduped.add(item.href);
        return !isSameDestination(pathname, item.href);
      })
      .slice(0, 8)
      .map(
        (item) =>
          mergedLinks.find((candidate) => candidate.href === item.href) ?? {
            ...item,
            group: "常用入口",
            groupType: "primary" as const
          }
      );
  }, [mergedLinks, navGroups, pathname, primaryLinks]);

  const visibleResults = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      const deduped = new Set<string>();
      return [...recentLinks, ...featuredLinks].filter((item) => {
        if (deduped.has(item.href)) return false;
        deduped.add(item.href);
        return true;
      });
    }

    return mergedLinks
      .map((item) => ({ item, score: rankItem(item, normalized, recentHrefs) }))
      .filter((entry) => entry.score >= 0 && !isSameDestination(pathname, entry.item.href))
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label, "zh-CN"))
      .slice(0, 12)
      .map((entry) => entry.item);
  }, [featuredLinks, keyword, mergedLinks, pathname, recentHrefs, recentLinks]);

  const currentPageMatchesKeyword = useMemo(() => {
    if (!currentPageItem || !keyword.trim()) return false;
    return rankItem(currentPageItem, keyword.trim().toLowerCase(), recentHrefs) >= 0;
  }, [currentPageItem, keyword, recentHrefs]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [keyword, open]);

  function closePalette() {
    setOpen(false);
    setKeyword("");
    setSelectedIndex(0);
  }

  function navigateTo(item: SearchItem) {
    closePalette();
    router.push(item.href);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!visibleResults.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % visibleResults.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + visibleResults.length) % visibleResults.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      navigateTo(visibleResults[selectedIndex] ?? visibleResults[0]);
    }
  }

  return (
    <>
      <button type="button" className="command-palette-trigger" onClick={() => setOpen(true)}>
        <span className="command-palette-trigger-label">快速跳转</span>
        <span className="command-palette-trigger-shortcut">⌘K / Ctrl+K</span>
      </button>

      <div className={`command-palette-shell${open ? " open" : ""}`} aria-hidden={!open}>
        <button type="button" className="command-palette-backdrop" aria-label="关闭全局搜索" onClick={closePalette} />
        <section className="command-palette-panel" role="dialog" aria-modal="true" aria-label="全局搜索与快速跳转">
          <div className="command-palette-header">
            <div>
              <div className="command-palette-title">全局搜索与快速跳转</div>
              <div className="command-palette-subtitle">{roleLabel} · 搜索页面、工具和最近访问入口</div>
            </div>
            <button type="button" className="command-palette-close" onClick={closePalette}>
              Esc
            </button>
          </div>

          <div className="command-palette-searchbar">
            <input
              ref={inputRef}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={handleInputKeyDown}
              className="command-palette-input"
              placeholder="搜索功能、页面或关键词，例如：考试、错题、报告"
              aria-label="全局搜索"
            />
            <div className="command-palette-hint">支持键盘上下选择，回车直达</div>
          </div>

          {!keyword.trim() ? (
            <div className="command-palette-summary">
              <span className="pill">常用入口 {featuredLinks.length}</span>
              <span className="pill">最近访问 {recentLinks.length}</span>
              <span className="pill">全部功能 {mergedLinks.length}</span>
            </div>
          ) : (
            <div className="command-palette-summary">
              <span className="pill">搜索结果 {visibleResults.length}</span>
              <span className="pill">关键词：{keyword.trim()}</span>
            </div>
          )}

          {visibleResults.length ? (
            <div className="command-palette-results" role="listbox" aria-label="搜索结果">
              {visibleResults.map((item, index) => (
                <button
                  key={`${item.groupType}-${item.href}`}
                  type="button"
                  role="option"
                  aria-selected={index === selectedIndex}
                  className={`command-palette-result${index === selectedIndex ? " active" : ""}`}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => navigateTo(item)}
                >
                  <div className="command-palette-result-main">
                    <div className="command-palette-result-title">{item.label}</div>
                    <div className="command-palette-result-meta">{item.href}</div>
                  </div>
                  <div className="command-palette-result-side">
                    <span className="pill">{item.group}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <StatePanel
              compact
              tone="empty"
              title={currentPageMatchesKeyword ? "你已经在这个页面" : "没有找到匹配功能"}
              description={
                currentPageMatchesKeyword
                  ? "当前关键词命中的入口就是你正在访问的页面，试试更具体的关键词继续跳转。"
                  : "换个关键词试试，或者清空后查看最近访问与常用入口。"
              }
              action={
                keyword.trim() ? (
                  <button type="button" className="button secondary" onClick={() => setKeyword("")}>
                    清空关键词
                  </button>
                ) : null
              }
            />
          )}
        </section>
      </div>
    </>
  );
}
