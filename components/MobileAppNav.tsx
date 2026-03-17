"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import StatePanel from "@/components/StatePanel";
import { emitOpenCommandPalette } from "@/lib/navigation-command";

type NavLink = { href: string; label: string };
type NavGroup = { title: string; links: NavLink[] };

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MobileAppNav({
  roleLabel,
  primaryLinks,
  navGroups
}: {
  roleLabel: string;
  primaryLinks: NavLink[];
  navGroups: NavGroup[];
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");

  const mergedLinks = useMemo(() => {
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
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    document.documentElement.setAttribute("data-mobile-nav", menuOpen ? "open" : "closed");
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.documentElement.setAttribute("data-mobile-nav", "closed");
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const normalizedKeyword = searchKeyword.trim().toLowerCase();
  const isMatched = (item: NavLink) => {
    if (!normalizedKeyword) return true;
    return (
      item.label.toLowerCase().includes(normalizedKeyword) ||
      item.href.toLowerCase().includes(normalizedKeyword)
    );
  };

  const visiblePrimaryLinks = primaryLinks.filter((item) => isMatched(item));
  const visibleGroups = navGroups
    .map((group) => ({ ...group, links: group.links.filter((item) => isMatched(item)) }))
    .filter((group) => group.links.length);
  const visibleLinkCount = useMemo(() => {
    const hrefSet = new Set<string>();
    visiblePrimaryLinks.forEach((item) => hrefSet.add(item.href));
    visibleGroups.forEach((group) => group.links.forEach((item) => hrefSet.add(item.href)));
    return hrefSet.size;
  }, [visiblePrimaryLinks, visibleGroups]);
  const quickTabLinks = useMemo(() => primaryLinks.slice(0, 4), [primaryLinks]);

  function renderSheetLink(item: NavLink, key?: string) {
    return (
      <Link
        key={key ?? item.href}
        href={item.href}
        className={`mobile-nav-link${isActive(pathname, item.href) ? " active" : ""}`}
        onClick={() => setMenuOpen(false)}
      >
        <span className="mobile-nav-link-glyph" aria-hidden="true">
          {item.label.slice(0, 2)}
        </span>
        <span className="mobile-nav-link-label">{item.label}</span>
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        className="mobile-nav-trigger"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(true)}
      >
        <span className="mobile-nav-trigger-icon" aria-hidden="true">
          导航
        </span>
        <span className="mobile-nav-trigger-text">{roleLabel}</span>
      </button>

      <div className={`mobile-nav-sheet${menuOpen ? " open" : ""}`} aria-hidden={!menuOpen}>
        <button
          type="button"
          className="mobile-nav-backdrop"
          aria-label="关闭导航菜单"
          onClick={() => setMenuOpen(false)}
        />
        <aside className="mobile-nav-panel" role="dialog" aria-modal="true" aria-label="移动端导航菜单">
          <div className="mobile-nav-panel-head">
            <div className="mobile-nav-title">主线导航</div>
            <button type="button" className="mobile-nav-close" onClick={() => setMenuOpen(false)}>
              关闭
            </button>
          </div>
          <div className="mobile-nav-search">
            <input
              className="mobile-nav-search-input"
              placeholder="搜索功能（例如：考试、题库、报告）"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              aria-label="搜索功能"
            />
            <div className="mobile-nav-search-meta">
              已显示 {visibleLinkCount} / {mergedLinks.length} 个入口
            </div>
            <div className="mobile-nav-search-actions">
              <button type="button" className="button ghost" onClick={emitOpenCommandPalette}>
                全局搜索⌘K
              </button>
            </div>
          </div>
          <div className="mobile-nav-sections">
            <section className="mobile-nav-section">
              <div className="mobile-nav-section-head">主线功能（{visiblePrimaryLinks.length}）</div>
              <div className="mobile-nav-links">{visiblePrimaryLinks.map((item) => renderSheetLink(item))}</div>
            </section>

            {visibleGroups.map((group) => (
              <section key={group.title} className="mobile-nav-section">
                <div className="mobile-nav-section-head">
                  {group.title}（{group.links.length}）
                </div>
                <div className="mobile-nav-links">
                  {group.links.map((item) => renderSheetLink(item, `${group.title}-${item.href}`))}
                </div>
              </section>
            ))}

            {visibleLinkCount === 0 ? (
              <StatePanel
                compact
                tone="empty"
                title="没有匹配到功能"
                description="可以换个关键词，或用全局搜索直达。"
                action={
                  <button type="button" className="button secondary" onClick={emitOpenCommandPalette}>
                    打开全局搜索
                  </button>
                }
              />
            ) : null}
          </div>
        </aside>
      </div>

      <nav className="mobile-tabbar" aria-label="快捷导航">
        {quickTabLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-tabbar-item${isActive(pathname, item.href) ? " active" : ""}`}
          >
            <span className="mobile-tabbar-item-glyph" aria-hidden="true">
              {item.label.slice(0, 2)}
            </span>
            <span className="mobile-tabbar-item-label">{item.label}</span>
          </Link>
        ))}
        <button
          type="button"
          className={`mobile-tabbar-item mobile-tabbar-item-menu${menuOpen ? " active" : ""}`}
          onClick={() => setMenuOpen(true)}
        >
          <span className="mobile-tabbar-item-glyph" aria-hidden="true">
            更多
          </span>
          <span className="mobile-tabbar-item-label">菜单</span>
        </button>
      </nav>
    </>
  );
}
