import { readFileSync } from "node:fs";
import { FolderSummarySchema, SessionSummarySchema } from "@gardendesk/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { reorderedFolderIds, Sidebar } from "./components/sidebar.js";

const timestamp = "2026-07-22T10:00:00.000Z";
const folder = FolderSummarySchema.parse({
  id: "00000000-0000-4000-8000-000000000001",
  name: "Project",
  createdAt: timestamp,
  revokedAt: null,
});
const globalSession = SessionSummarySchema.parse({
  id: "00000000-0000-4000-8000-000000000002",
  folderId: null,
  title: "Global chat",
  createdAt: timestamp,
  updatedAt: timestamp,
});
const folderSession = SessionSummarySchema.parse({
  id: "00000000-0000-4000-8000-000000000003",
  folderId: folder.id,
  title: "Folder chat",
  createdAt: timestamp,
  updatedAt: timestamp,
});

const sidebarRowProps = {
  activeSessionId: globalSession.id,
  disabled: false,
  dispatch: () => undefined,
  folders: [{ ...folder, expanded: true, nextCursor: null, sessions: [folderSession] }],
  globalSessions: [globalSession],
  globalNextCursor: "next",
  workingSessionIds: [folderSession.id],
  onAddFolder: () => undefined,
  onNewSession: () => undefined,
  onOpenFolder: () => undefined,
  onOpenLaws: () => undefined,
  onOpenReleases: () => undefined,
  onOpenSkills: () => undefined,
  onDeleteSession: () => undefined,
  onRevokeFolder: () => undefined,
  onReorderFolders: () => undefined,
  onSelectSession: () => undefined,
  onShowMore: () => undefined,
  onShowLess: () => undefined,
};

it("keeps Show more beside Show less after the final chat page", () => {
  const globalSessions = Array.from({ length: 6 }, (_, index) =>
    SessionSummarySchema.parse({
      ...globalSession,
      id: `${globalSession.id.slice(0, -1)}${index}`,
    }),
  );
  const folderSessions = Array.from({ length: 6 }, (_, index) =>
    SessionSummarySchema.parse({
      ...folderSession,
      id: `${folderSession.id.slice(0, -1)}${index}`,
    }),
  );
  const expanded = renderToStaticMarkup(
    createElement(Sidebar, {
      ...sidebarRowProps,
      globalSessions,
      folders: [{ ...folder, expanded: true, nextCursor: null, sessions: folderSessions }],
    }),
  );
  expect(expanded.match(/aria-label="Show less"/gu)).toHaveLength(2);
  expect(expanded.match(/class="show-more"/gu)).toHaveLength(2);
  expect(expanded.match(/class="show-more" disabled=""/gu)).toHaveLength(1);
  expect(expanded.match(/icon-chevron-up/gu)).toHaveLength(2);

  const collapsed = renderToStaticMarkup(createElement(Sidebar, sidebarRowProps));
  expect(collapsed).not.toContain('aria-label="Show less"');
});

describe("sidebar rows", () => {
  it("uses the same row controls for chats and folders, with an icon only on folders", () => {
    const markup = renderToStaticMarkup(createElement(Sidebar, sidebarRowProps));

    expect(
      markup.match(
        /class="sidebar-item-row(?: sidebar-item-row-with-start)?(?: sidebar-item-row-with-drag)?"/gu,
      ),
    ).toHaveLength(3);
    expect(markup.match(/class="sidebar-item-delete(?: sidebar-item-unmount)?"/gu)).toHaveLength(2);
    expect(markup.match(/class="sidebar-item-start"/gu)).toHaveLength(1);
    expect(markup.match(/icon-folder/gu)).toHaveLength(1);
    expect(markup.match(/icon-drag/gu)).toHaveLength(1);
    expect(markup.match(/icon-message/gu)).toHaveLength(2);
    expect(markup.match(/icon-trash/gu)).toHaveLength(1);
    expect(markup.match(/icon-unmount/gu)).toHaveLength(1);
    expect(markup).toContain("Add folder");
    expect(markup).toContain("Show more");
    expect(markup).toContain('aria-label="Open Project folder"');
    expect(markup).toContain('aria-label="Unmount Project"');
    expect(markup).toContain('class="sidebar-item-delete sidebar-item-unmount"');
    expect(markup).not.toContain("icon-chevron");
    expect(markup).toContain('class="sidebar-item-select sidebar-item-working"');
    expect(markup.match(/sidebar-item-deletable/gu) ?? []).toHaveLength(2);
    expect(markup).toContain('aria-label="Working"');
    expect(markup).not.toContain('aria-label="Delete Folder chat"');
  });

  it("keeps disabled delete buttons hidden so they do not cover row titles", () => {
    const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const hiddenSelectors = [...styles.matchAll(/([^{}]+)\{[^}]*opacity:\s*0;/gu)]
      .flatMap((match) => (match[1] ?? "").split(","))
      .map((selector) => selector.trim())
      .filter((selector) => selector.endsWith(".sidebar-item-delete"));
    const classLevel = (selector: string) => selector.match(/[.:[]/gu)?.length ?? 0;

    expect(Math.max(0, ...hiddenSelectors.map(classLevel))).toBeGreaterThan(
      classLevel("button:disabled"),
    );
  });
});

describe("folder ordering", () => {
  it("moves a dragged folder before or after its target", () => {
    expect(reorderedFolderIds(["a", "b", "c"], "c", "a", false)).toEqual(["c", "a", "b"]);
    expect(reorderedFolderIds(["a", "b", "c"], "a", "b", true)).toEqual(["b", "a", "c"]);
  });
});
