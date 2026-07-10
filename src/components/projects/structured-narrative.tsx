"use client";

import type { ReactNode } from "react";

const SECTION_LABELS = new Map(
  [
    "current status",
    "recent updates",
    "implementation milestones",
    "current focus",
    "key risk",
    "current action owner",
  ].map((label) => [label, label.replace(/\b\w/g, (match) => match.toUpperCase())]),
);

export function StructuredNarrative({
  text,
  fallback,
}: {
  text?: string | null;
  fallback: string;
}) {
  const source = text?.trim() || fallback;
  const lines = source.replace(/\r/g, "").split("\n");
  const content: ReactNode[] = [];

  lines.forEach((line, index) => {
    const normalized = line.trim().replace(/:$/, "").toLowerCase();
    const label = SECTION_LABELS.get(normalized);

    if (label) {
      content.push(
        <strong className="app-structured-narrative__heading" key={`heading-${index}`}>
          {label}:
        </strong>,
      );
    } else {
      content.push(<span key={`line-${index}`}>{line}</span>);
    }

    if (index < lines.length - 1) {
      content.push(<br key={`break-${index}`} />);
    }
  });

  return <>{content}</>;
}
