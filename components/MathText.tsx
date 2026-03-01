"use client";

import { Fragment } from "react";

type MathTextProps = {
  text?: string | null;
  as?: "div" | "span" | "p";
  className?: string;
  autoDetect?: boolean;
  showCopyActions?: boolean;
};

type MathSegment = {
  kind: "text" | "math";
  content: string;
  display: boolean;
};

const LATEX_SYMBOLS: Array<[RegExp, string]> = [
  [/\\times/g, "×"],
  [/\\div/g, "÷"],
  [/\\cdot/g, "·"],
  [/\\pm/g, "±"],
  [/\\leq/g, "≤"],
  [/\\geq/g, "≥"],
  [/\\neq/g, "≠"],
  [/\\approx/g, "≈"],
  [/\\infty/g, "∞"],
  [/\\pi/g, "π"],
  [/\\alpha/g, "α"],
  [/\\beta/g, "β"],
  [/\\gamma/g, "γ"],
  [/\\theta/g, "θ"],
  [/\\lambda/g, "λ"],
  [/\\mu/g, "μ"],
  [/\\sigma/g, "σ"],
  [/\\Delta/g, "Δ"],
  [/\\sum/g, "∑"],
  [/\\int/g, "∫"],
  [/\\to/g, "→"],
  [/\\rightarrow/g, "→"],
  [/\\left/g, ""],
  [/\\right/g, ""]
];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeMathExpression(value: string) {
  return value.trim().replace(/\\,/g, " ").replace(/\\;/g, " ").replace(/\\!/g, "");
}

function formatMathToHtml(raw: string) {
  let html = escapeHtml(normalizeMathExpression(raw));
  LATEX_SYMBOLS.forEach(([pattern, replacement]) => {
    html = html.replace(pattern, replacement);
  });

  for (let i = 0; i < 8; i += 1) {
    const previous = html;
    html = html.replace(
      /\\frac\{([^{}]+)\}\{([^{}]+)\}/g,
      `<span class="math-frac"><span class="math-frac-top">$1</span><span class="math-frac-bottom">$2</span></span>`
    );
    html = html.replace(/\\sqrt\{([^{}]+)\}/g, `<span class="math-root">√<span class="math-root-body">$1</span></span>`);
    html = html.replace(/([A-Za-z0-9)\]α-ωΑ-ΩπθΔΣ∑∫]+)\^\{([^{}]+)\}/g, `$1<sup>$2</sup>`);
    html = html.replace(/([A-Za-z0-9)\]α-ωΑ-ΩπθΔΣ∑∫]+)\^([A-Za-z0-9+\-]+)/g, `$1<sup>$2</sup>`);
    html = html.replace(/([A-Za-z0-9)\]α-ωΑ-ΩπθΔΣ∑∫]+)_\{([^{}]+)\}/g, `$1<sub>$2</sub>`);
    html = html.replace(/([A-Za-z0-9)\]α-ωΑ-ΩπθΔΣ∑∫]+)_([A-Za-z0-9+\-]+)/g, `$1<sub>$2</sub>`);
    if (html === previous) {
      break;
    }
  }

  return html;
}

function formatMathToPlain(raw: string) {
  let text = normalizeMathExpression(raw);
  for (let i = 0; i < 8; i += 1) {
    const previous = text;
    text = text.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)");
    text = text.replace(/\\sqrt\{([^{}]+)\}/g, "sqrt($1)");
    text = text.replace(/([A-Za-z0-9)\]α-ωΑ-ΩπθΔΣ∑∫]+)\^\{([^{}]+)\}/g, "$1^($2)");
    text = text.replace(/([A-Za-z0-9)\]α-ωΑ-ΩπθΔΣ∑∫]+)\^([A-Za-z0-9+\-]+)/g, "$1^$2");
    text = text.replace(/([A-Za-z0-9)\]α-ωΑ-ΩπθΔΣ∑∫]+)_\{([^{}]+)\}/g, "$1_($2)");
    text = text.replace(/([A-Za-z0-9)\]α-ωΑ-ΩπθΔΣ∑∫]+)_([A-Za-z0-9+\-]+)/g, "$1_$2");
    if (text === previous) {
      break;
    }
  }
  LATEX_SYMBOLS.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  return text.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}

function splitMathDelimitedSegments(input: string): MathSegment[] {
  const segments: MathSegment[] = [];
  const matcher = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
  let cursor = 0;
  let match: RegExpExecArray | null = matcher.exec(input);
  while (match) {
    if (match.index > cursor) {
      segments.push({
        kind: "text",
        content: input.slice(cursor, match.index),
        display: false
      });
    }
    const displayContent = match[1];
    const inlineContent = match[2];
    segments.push({
      kind: "math",
      content: displayContent ?? inlineContent ?? "",
      display: Boolean(displayContent)
    });
    cursor = match.index + match[0].length;
    match = matcher.exec(input);
  }

  if (cursor < input.length) {
    segments.push({
      kind: "text",
      content: input.slice(cursor),
      display: false
    });
  }
  return segments.length
    ? segments
    : [
        {
          kind: "text",
          content: input,
          display: false
        }
      ];
}

function isInlineMathCandidate(value: string) {
  const text = value.trim();
  if (!text) return false;
  if (/^\\[a-zA-Z]+/.test(text)) return true;
  if (text.includes("^") || text.includes("_")) return true;
  if (!/[A-Za-z0-9]/.test(text)) return false;
  return /[=+\-*/<>]/.test(text);
}

function splitInlineAutoMathSegments(input: string): MathSegment[] {
  const segments: MathSegment[] = [];
  const pattern =
    /\\[a-zA-Z]+(?:\{[^{}]*\})*|(?:[A-Za-z0-9().]+(?:\s*[+\-*/=<>]\s*[A-Za-z0-9().]+)+)|(?:[A-Za-z0-9()]+(?:\^\{?[A-Za-z0-9+\-]+\}?|_\{?[A-Za-z0-9+\-]+\}?)+)/g;
  let cursor = 0;
  let match: RegExpExecArray | null = pattern.exec(input);
  while (match) {
    const value = match[0];
    const isMath = isInlineMathCandidate(value);
    if (match.index > cursor) {
      segments.push({
        kind: "text",
        content: input.slice(cursor, match.index),
        display: false
      });
    }
    segments.push({
      kind: isMath ? "math" : "text",
      content: value,
      display: false
    });
    cursor = match.index + value.length;
    match = pattern.exec(input);
  }

  if (cursor < input.length) {
    segments.push({
      kind: "text",
      content: input.slice(cursor),
      display: false
    });
  }

  return segments.length
    ? segments
    : [
        {
          kind: "text",
          content: input,
          display: false
        }
      ];
}

function renderSegments(segments: MathSegment[], autoDetect: boolean) {
  const nodes: React.ReactNode[] = [];
  segments.forEach((segment, index) => {
    if (segment.kind === "math") {
      nodes.push(
        <span
          key={`math-${index}`}
          className={segment.display ? "math-display" : "math-inline"}
          dangerouslySetInnerHTML={{ __html: formatMathToHtml(segment.content) }}
        />
      );
      return;
    }

    if (!autoDetect) {
      nodes.push(<Fragment key={`text-${index}`}>{segment.content}</Fragment>);
      return;
    }

    const autoSegments = splitInlineAutoMathSegments(segment.content);
    autoSegments.forEach((autoSegment, autoIndex) => {
      if (autoSegment.kind === "math") {
        nodes.push(
          <span
            key={`auto-math-${index}-${autoIndex}`}
            className="math-inline"
            dangerouslySetInnerHTML={{ __html: formatMathToHtml(autoSegment.content) }}
          />
        );
      } else {
        nodes.push(<Fragment key={`auto-text-${index}-${autoIndex}`}>{autoSegment.content}</Fragment>);
      }
    });
  });
  return nodes;
}

function formatTextToPlain(input: string, autoDetect: boolean) {
  const segments = splitMathDelimitedSegments(input);
  return segments
    .map((segment) => {
      if (segment.kind === "math") {
        return formatMathToPlain(segment.content);
      }
      if (!autoDetect) {
        return segment.content;
      }
      return splitInlineAutoMathSegments(segment.content)
        .map((item) => (item.kind === "math" ? formatMathToPlain(item.content) : item.content))
        .join("");
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

async function copyToClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  if (typeof document === "undefined") return;
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function MathText({
  text,
  as = "span",
  className,
  autoDetect = true,
  showCopyActions = false
}: MathTextProps) {
  const content = String(text ?? "");
  const segments = splitMathDelimitedSegments(content);
  const classes = ["math-text", className].filter(Boolean).join(" ");
  const plainText = formatTextToPlain(content, autoDetect);
  const hasContent = Boolean(content.trim());
  const copyActions = showCopyActions && hasContent ? (
    <span className="math-copy-actions">
      <button
        type="button"
        className="math-copy-btn"
        onClick={() => {
          void copyToClipboard(content);
        }}
      >
        复制 LaTeX
      </button>
      <button
        type="button"
        className="math-copy-btn"
        onClick={() => {
          void copyToClipboard(plainText || content);
        }}
      >
        复制纯文本
      </button>
    </span>
  ) : null;
  if (as === "div") {
    return (
      <div className={classes}>
        {renderSegments(segments, autoDetect)}
        {copyActions}
      </div>
    );
  }
  if (as === "p") {
    return (
      <p className={classes}>
        {renderSegments(segments, autoDetect)}
        {copyActions}
      </p>
    );
  }
  return (
    <span className={classes}>
      {renderSegments(segments, autoDetect)}
      {copyActions}
    </span>
  );
}
