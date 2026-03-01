"use client";

import { Fragment, useState } from "react";
import { pushAppToast } from "@/components/AppToastHub";

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

function skipSpaces(input: string, index: number) {
  let cursor = index;
  while (cursor < input.length && /\s/.test(input[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function readBraceBlock(input: string, startIndex: number) {
  const start = skipSpaces(input, startIndex);
  if (start >= input.length || input[start] !== "{") return null;
  let depth = 0;
  let cursor = start;
  while (cursor < input.length) {
    const ch = input[cursor];
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          value: input.slice(start + 1, cursor),
          endIndex: cursor + 1
        };
      }
    }
    cursor += 1;
  }
  return null;
}

function parseLatexStructure(input: string, mode: "html" | "plain"): string {
  let output = "";
  let cursor = 0;

  while (cursor < input.length) {
    if (input.startsWith("\\frac", cursor) || input.startsWith("\\dfrac", cursor) || input.startsWith("\\tfrac", cursor)) {
      const commandLength = input.startsWith("\\dfrac", cursor) || input.startsWith("\\tfrac", cursor) ? 6 : 5;
      const numerator = readBraceBlock(input, cursor + commandLength);
      if (!numerator) {
        output += mode === "html" ? escapeHtml(input[cursor]) : input[cursor];
        cursor += 1;
        continue;
      }
      const denominator = readBraceBlock(input, numerator.endIndex);
      if (!denominator) {
        output += mode === "html" ? escapeHtml(input[cursor]) : input[cursor];
        cursor += 1;
        continue;
      }
      const top = parseLatexStructure(numerator.value, mode);
      const bottom = parseLatexStructure(denominator.value, mode);
      output +=
        mode === "html"
          ? `<span class="math-frac"><span class="math-frac-top">${top}</span><span class="math-frac-bottom">${bottom}</span></span>`
          : `(${top})/(${bottom})`;
      cursor = denominator.endIndex;
      continue;
    }

    if (input.startsWith("\\sqrt", cursor)) {
      let nextCursor = cursor + "\\sqrt".length;
      let indexText = "";
      nextCursor = skipSpaces(input, nextCursor);
      if (input[nextCursor] === "[") {
        const end = input.indexOf("]", nextCursor + 1);
        if (end !== -1) {
          indexText = input.slice(nextCursor + 1, end).trim();
          nextCursor = end + 1;
        }
      }
      const body = readBraceBlock(input, nextCursor);
      if (!body) {
        output += mode === "html" ? escapeHtml(input[cursor]) : input[cursor];
        cursor += 1;
        continue;
      }
      const renderedBody = parseLatexStructure(body.value, mode);
      if (mode === "html") {
        const renderedIndex = indexText ? `<sup class="math-root-index">${escapeHtml(indexText)}</sup>` : "";
        output += `<span class="math-root">${renderedIndex}√<span class="math-root-body">${renderedBody}</span></span>`;
      } else {
        output += indexText ? `root(${indexText},${renderedBody})` : `sqrt(${renderedBody})`;
      }
      cursor = body.endIndex;
      continue;
    }

    const char = input[cursor];
    output += mode === "html" ? escapeHtml(char) : char;
    cursor += 1;
  }

  return output;
}

function applySymbolSubstitutions(input: string) {
  let output = input;
  LATEX_SYMBOLS.forEach(([pattern, replacement]) => {
    output = output.replace(pattern, replacement);
  });
  return output;
}

function formatMathSupSub(input: string, mode: "html" | "plain") {
  let output = input;
  for (let i = 0; i < 8; i += 1) {
    const previous = output;
    if (mode === "html") {
      output = output.replace(/([A-Za-z0-9)\]α-ωΑ-ΩπθΔΣ∑∫]+)\^\{([^{}]+)\}/g, `$1<sup>$2</sup>`);
      output = output.replace(/([A-Za-z0-9)\]α-ωΑ-ΩπθΔΣ∑∫]+)\^([A-Za-z0-9+\-]+)/g, `$1<sup>$2</sup>`);
      output = output.replace(/([A-Za-z0-9)\]α-ωΑ-ΩπθΔΣ∑∫]+)_\{([^{}]+)\}/g, `$1<sub>$2</sub>`);
      output = output.replace(/([A-Za-z0-9)\]α-ωΑ-ΩπθΔΣ∑∫]+)_([A-Za-z0-9+\-]+)/g, `$1<sub>$2</sub>`);
    } else {
      output = output.replace(/([A-Za-z0-9)\]α-ωΑ-ΩπθΔΣ∑∫]+)\^\{([^{}]+)\}/g, "$1^($2)");
      output = output.replace(/([A-Za-z0-9)\]α-ωΑ-ΩπθΔΣ∑∫]+)\^([A-Za-z0-9+\-]+)/g, "$1^$2");
      output = output.replace(/([A-Za-z0-9)\]α-ωΑ-ΩπθΔΣ∑∫]+)_\{([^{}]+)\}/g, "$1_($2)");
      output = output.replace(/([A-Za-z0-9)\]α-ωΑ-ΩπθΔΣ∑∫]+)_([A-Za-z0-9+\-]+)/g, "$1_$2");
    }
    if (output === previous) {
      break;
    }
  }
  return output;
}

function formatMathToHtml(raw: string) {
  const parsed = parseLatexStructure(normalizeMathExpression(raw), "html");
  const symbolNormalized = applySymbolSubstitutions(parsed);
  return formatMathSupSub(symbolNormalized, "html");
}

function formatMathToPlain(raw: string) {
  const parsed = parseLatexStructure(normalizeMathExpression(raw), "plain");
  const symbolNormalized = applySymbolSubstitutions(parsed);
  const superscriptNormalized = formatMathSupSub(symbolNormalized, "plain");
  return superscriptNormalized.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
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
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const content = String(text ?? "");
  const segments = splitMathDelimitedSegments(content);
  const classes = ["math-text", className].filter(Boolean).join(" ");
  const plainText = formatTextToPlain(content, autoDetect);
  const hasContent = Boolean(content.trim());
  async function handleCopy(value: string, label: string) {
    try {
      await copyToClipboard(value);
      pushAppToast(`已复制${label}`);
      setCopyMenuOpen(false);
    } catch {
      pushAppToast("复制失败，请手动复制", "error");
    }
  }
  const copyActions = showCopyActions && hasContent ? (
    <span className={`math-copy-actions ${copyMenuOpen ? "open" : ""}`}>
      <button
        type="button"
        className="math-copy-btn math-copy-trigger"
        onClick={() => setCopyMenuOpen((prev) => !prev)}
      >
        复制
      </button>
      <span className="math-copy-menu">
      <button
        type="button"
        className="math-copy-btn"
        onClick={() => {
            void handleCopy(content, "LaTeX");
        }}
      >
        复制 LaTeX
      </button>
      <button
        type="button"
        className="math-copy-btn"
        onClick={() => {
            void handleCopy(plainText || content, "纯文本");
        }}
      >
        复制纯文本
      </button>
      </span>
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
