"use client";

import { useMemo } from "react";
import Image from "next/image";

type ReaderItem = {
  title: string;
  description?: string;
  sourceType: "file" | "link" | "text";
  fileName?: string;
  mimeType?: string;
  contentBase64?: string;
  linkUrl?: string;
  textContent?: string;
};

type LibraryReaderProps = {
  item: ReaderItem;
  onTextSelection?: () => void;
};

function decodeBase64Utf8(value: string) {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    try {
      return atob(value);
    } catch {
      return "";
    }
  }
}

function resolveMimeType(item: ReaderItem) {
  if (item.mimeType?.trim()) return item.mimeType.toLowerCase();
  const target = (item.fileName || item.linkUrl || "").toLowerCase();
  if (target.endsWith(".pdf")) return "application/pdf";
  if (target.endsWith(".png")) return "image/png";
  if (target.endsWith(".jpg") || target.endsWith(".jpeg")) return "image/jpeg";
  if (target.endsWith(".gif")) return "image/gif";
  if (target.endsWith(".webp")) return "image/webp";
  if (target.endsWith(".mp4")) return "video/mp4";
  if (target.endsWith(".mp3")) return "audio/mpeg";
  if (target.endsWith(".txt")) return "text/plain";
  if (target.endsWith(".md")) return "text/markdown";
  if (target.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

function isTextLike(mimeType: string, fileName?: string, linkUrl?: string) {
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    mimeType.includes("yaml") ||
    mimeType.includes("markdown") ||
    mimeType.includes("csv")
  ) {
    return true;
  }
  const target = (fileName || linkUrl || "").toLowerCase();
  return /\.(txt|md|markdown|json|csv|xml|yml|yaml)(\?|#|$)/.test(target);
}

function buildLinkPreviewUrl(linkUrl?: string) {
  if (!linkUrl) return "";
  const lower = linkUrl.toLowerCase();
  if (/\.(doc|docx|ppt|pptx)(\?|#|$)/.test(lower)) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(linkUrl)}`;
  }
  return linkUrl;
}

export default function LibraryReader({ item, onTextSelection }: LibraryReaderProps) {
  const mimeType = resolveMimeType(item);
  const dataUrl = useMemo(() => {
    if (!item.contentBase64) return "";
    return `data:${mimeType};base64,${item.contentBase64}`;
  }, [item.contentBase64, mimeType]);

  const inlineText = useMemo(() => {
    if (item.sourceType !== "file" || !item.contentBase64) return "";
    if (!isTextLike(mimeType, item.fileName, item.linkUrl)) return "";
    if (item.contentBase64.length > 2_000_000) {
      return "文件过大，建议下载后查看。";
    }
    return decodeBase64Utf8(item.contentBase64).slice(0, 100_000);
  }, [item.contentBase64, item.fileName, item.linkUrl, item.sourceType, mimeType]);

  const linkPreviewUrl = useMemo(() => buildLinkPreviewUrl(item.linkUrl), [item.linkUrl]);

  const isPdf = mimeType.includes("pdf");
  const isImage = mimeType.startsWith("image/");
  const isVideo = mimeType.startsWith("video/");
  const isAudio = mimeType.startsWith("audio/");

  return (
    <div className="grid" style={{ gap: 10 }}>
      {item.description ? <p>{item.description}</p> : null}

      {item.sourceType === "text" ? (
        <div className="card" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }} onMouseUp={onTextSelection}>
          {item.textContent || "暂无文本内容"}
        </div>
      ) : null}

      {item.sourceType === "link" && item.linkUrl ? (
        <div className="grid" style={{ gap: 10 }}>
          <div className="cta-row">
            <a className="button secondary" href={item.linkUrl} target="_blank" rel="noreferrer">
              打开原链接
            </a>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
            已启用网页内预览。若目标站点禁用 iframe，请使用“打开原链接”。
          </div>
          <iframe
            title="link-preview"
            src={linkPreviewUrl}
            style={{ width: "100%", minHeight: 600, border: "1px solid var(--stroke)", borderRadius: 12 }}
          />
        </div>
      ) : null}

      {item.sourceType === "file" && item.contentBase64 ? (
        <div className="grid" style={{ gap: 10 }}>
          <div className="cta-row">
            <a className="button secondary" href={dataUrl} download={item.fileName || item.title}>
              下载文件
            </a>
          </div>
          {isPdf ? (
            <iframe
              title="pdf-preview"
              src={dataUrl}
              style={{ width: "100%", minHeight: 600, border: "1px solid var(--stroke)", borderRadius: 12 }}
            />
          ) : null}
          {isImage ? (
            <Image
              alt={item.title}
              src={dataUrl}
              width={1600}
              height={900}
              unoptimized
              style={{
                width: "100%",
                height: "auto",
                maxHeight: 700,
                objectFit: "contain",
                borderRadius: 12,
                border: "1px solid var(--stroke)"
              }}
            />
          ) : null}
          {isVideo ? (
            <video controls src={dataUrl} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--stroke)" }} />
          ) : null}
          {isAudio ? <audio controls src={dataUrl} style={{ width: "100%" }} /> : null}
          {!isPdf && !isImage && !isVideo && !isAudio && inlineText ? (
            <div className="card" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }} onMouseUp={onTextSelection}>
              {inlineText}
            </div>
          ) : null}
          {!isPdf && !isImage && !isVideo && !isAudio && !inlineText ? (
            <div style={{ fontSize: 13, color: "var(--ink-1)" }}>
              当前文件类型暂不支持网页内渲染，可点击“下载文件”查看。
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
