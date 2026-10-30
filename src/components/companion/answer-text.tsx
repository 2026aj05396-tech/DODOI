import Link from "next/link";
import type { ReactNode } from "react";

import type { CompanionSetup } from "@/lib/types/ai";

type SkillLink = Pick<CompanionSetup["skills"][number], "name" | "slug">;

// An AI answer as plain text with a little structure (AIC-06, AI_INTEGRATION §12): paragraphs,
// numbered and bulleted lines, **bold**, and exact dodoi skill names as links. It is built as React
// elements and never as HTML, so nothing the model writes can inject markup.

const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;
const BULLET = /^\s*[*•-]\s+(.*)$/;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function linkSkills(text: string, skills: SkillLink[], keyPrefix: string): ReactNode[] {
  if (skills.length === 0 || text === "") return [text];
  // Longest names first, so "Pottery Wheel" is not cut short by "Pottery".
  const names = [...skills].sort((a, b) => b.name.length - a.name.length);
  const pattern = new RegExp(`\\b(${names.map((s) => escapeRegExp(s.name)).join("|")})\\b`, "g");
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const skill = names.find((s) => s.name === match[0]);
    if (!skill) continue;
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <Link
        key={`${keyPrefix}-${match.index}`}
        href={`/s/${skill.slug}`}
        className="font-bold text-link underline underline-offset-2"
      >
        {match[0]}
      </Link>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function inline(text: string, skills: SkillLink[], keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  text.split(/(\*\*[^*]+\*\*)/g).forEach((segment, index) => {
    const key = `${keyPrefix}-${index}`;
    if (segment.startsWith("**") && segment.endsWith("**") && segment.length > 4) {
      nodes.push(<strong key={key}>{linkSkills(segment.slice(2, -2), skills, key)}</strong>);
    } else {
      nodes.push(...linkSkills(segment, skills, key));
    }
  });
  return nodes;
}

export function AnswerText({ text, skills }: { text: string; skills: SkillLink[] }) {
  const blocks: ReactNode[] = [];
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    const numbered = NUMBERED.exec(line);
    const bullet = BULLET.exec(line);
    if (numbered || bullet) {
      const pattern = numbered ? NUMBERED : BULLET;
      const items: ReactNode[] = [];
      const start = numbered ? Number(numbered[1]) : undefined;
      while (index < lines.length) {
        const match = pattern.exec(lines[index] ?? "");
        if (!match) break;
        const content = numbered ? (match[2] ?? "") : (match[1] ?? "");
        items.push(<li key={index}>{inline(content, skills, `l${index}`)}</li>);
        index += 1;
      }
      blocks.push(
        numbered ? (
          <ol key={`b${index}`} start={start} className="list-decimal space-y-1.5 pl-5">
            {items}
          </ol>
        ) : (
          <ul key={`b${index}`} className="list-disc space-y-1.5 pl-5">
            {items}
          </ul>
        ),
      );
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? "";
      if (current.trim() === "" || NUMBERED.test(current) || BULLET.test(current)) break;
      paragraph.push(current);
      index += 1;
    }
    blocks.push(<p key={`b${index}`}>{inline(paragraph.join(" "), skills, `p${index}`)}</p>);
  }
  return <div className="flex flex-col gap-2.5">{blocks}</div>;
}
