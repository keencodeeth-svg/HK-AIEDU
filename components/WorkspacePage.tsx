import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime } from "@/lib/client-request";

export type WorkspaceNoticeItem = {
  id: string;
  tone: "loading" | "empty" | "info" | "error" | "success";
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
};

type WorkspacePageProps = {
  title: string;
  subtitle: string;
  lastLoadedAt?: string | null;
  chips?: ReactNode[];
  actions?: ReactNode;
  notices?: WorkspaceNoticeItem[];
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function WorkspaceLoadingState({ title, description }: { title: string; description: string }) {
  return <StatePanel tone="loading" title={title} description={description} />;
}

export function WorkspaceAuthState({
  title,
  description,
  href = "/login",
  actionLabel = "前往登录"
}: {
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <StatePanel
      tone="info"
      title={title}
      description={description}
      action={
        <Link className="button secondary" href={href}>
          {actionLabel}
        </Link>
      }
    />
  );
}

export function WorkspaceErrorState({
  title,
  description,
  onRetry,
  retryLabel = "重试"
}: {
  title: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <StatePanel
      tone="error"
      title={title}
      description={description}
      action={
        onRetry ? (
          <button className="button secondary" type="button" onClick={onRetry}>
            {retryLabel}
          </button>
        ) : undefined
      }
    />
  );
}

export function WorkspaceEmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return <StatePanel tone="empty" title={title} description={description} action={action} />;
}

export function WorkspaceNoticeStack({ items }: { items?: WorkspaceNoticeItem[] }) {
  const visibleItems = (items ?? []).filter(Boolean);
  if (!visibleItems.length) return null;

  return (
    <div className="grid" style={{ gap: 10 }}>
      {visibleItems.map((item) => (
        <StatePanel
          key={item.id}
          compact={item.compact ?? true}
          tone={item.tone}
          title={item.title}
          description={item.description}
          action={item.action}
        >
          {item.children}
        </StatePanel>
      ))}
    </div>
  );
}

export function buildStaleDataNotice(error: string, action?: ReactNode): WorkspaceNoticeItem {
  return {
    id: "stale-data",
    tone: "error",
    title: "已展示最近一次成功数据",
    description: `最新刷新失败：${error}`,
    action
  };
}

export function buildSuccessNotice(message: string): WorkspaceNoticeItem {
  return {
    id: "success-message",
    tone: "success",
    title: "最近一次操作已完成",
    description: message
  };
}

export default function WorkspacePage({
  title,
  subtitle,
  lastLoadedAt,
  chips,
  actions,
  notices,
  children,
  className = "grid",
  style
}: WorkspacePageProps) {
  return (
    <div className={className} style={{ gap: 18, ...style }}>
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          <div className="section-sub">{subtitle}</div>
        </div>
        <div className="cta-row no-margin" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          {(chips ?? []).map((chip, index) => (
            <span key={`${title}-chip-${index}`} style={{ display: "contents" }}>
              {chip}
            </span>
          ))}
          {actions}
        </div>
      </div>

      <WorkspaceNoticeStack items={notices} />
      {children}
    </div>
  );
}
