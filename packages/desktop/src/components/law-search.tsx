import { type KeyboardEvent, type RefObject, useEffect, useState } from "react";
import { t } from "../i18n/index.js";
import { Icon } from "./icons.js";

function foldCharacter(character: string): string {
  const base = character.normalize("NFD").replace(/\p{M}/gu, "");
  return base.length === character.length ? base : character;
}

function fold(text: string): string {
  return text.replace(/[^\p{ASCII}]/gu, foldCharacter).toLowerCase();
}

function findMatches(root: HTMLElement, query: string): Range[] {
  const needle = fold(query);
  const matches: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = fold(node.nodeValue ?? "");
    for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) {
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + needle.length);
      matches.push(range);
    }
  }
  return matches;
}

function highlight(name: string, ranges: Range[]): void {
  const found = new Highlight();
  for (const range of ranges) found.add(range);
  CSS.highlights.set(name, found);
}

function reveal(body: HTMLElement, range: Range): void {
  range.startContainer.parentElement?.scrollIntoView({ block: "nearest" });
  const box = body.getBoundingClientRect();
  const { bottom, top } = range.getBoundingClientRect();
  if (top < box.top || bottom > box.bottom) body.scrollBy({ top: top - box.top - box.height / 3 });
}

function useFind(body: RefObject<HTMLDivElement | null>, query: string) {
  const [matches, setMatches] = useState<Range[]>([]);
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const found = query === "" || body.current === null ? [] : findMatches(body.current, query);
    setMatches(found);
    setCurrent(0);
    highlight("law-search", found);
  }, [body, query]);
  useEffect(() => {
    const range = matches[current];
    highlight("law-search-current", range === undefined ? [] : [range]);
    if (range !== undefined && body.current !== null) reveal(body.current, range);
  }, [body, matches, current]);
  useEffect(
    () => () => {
      CSS.highlights.delete("law-search");
      CSS.highlights.delete("law-search-current");
    },
    [],
  );
  const step = (by: number) => {
    if (matches.length > 0) setCurrent((index) => (index + by + matches.length) % matches.length);
  };
  return { count: matches.length, current, step };
}

export function LawSearch({ body }: { body: RefObject<HTMLDivElement | null> }) {
  const [query, setQuery] = useState("");
  const { count, current, step } = useFind(body, query);
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") step(event.shiftKey ? -1 : 1);
    if (event.key === "Escape") setQuery("");
  };
  return (
    <search className="law-reader-search">
      <Icon name="search" />
      <input
        aria-label={t("lawReader.search")}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={keyDown}
        placeholder={t("lawReader.search")}
        spellCheck={false}
        value={query}
      />
      {query === "" ? null : (
        <output aria-live="polite">{`${count === 0 ? 0 : current + 1}/${count}`}</output>
      )}
      <button
        aria-label={t("lawReader.previous")}
        disabled={count === 0}
        onClick={() => step(-1)}
        type="button"
      >
        <Icon name="chevron-up" />
      </button>
      <button
        aria-label={t("lawReader.next")}
        disabled={count === 0}
        onClick={() => step(1)}
        type="button"
      >
        <Icon name="chevron-down" />
      </button>
    </search>
  );
}
