import { SessionPageSchema, SessionSummarySchema } from "@gardendesk/shared";
import { expect, it } from "vitest";
import { desktopReducer, initialDesktopState } from "./state.js";

it("loads more main chats and fills a deleted row from the next page", () => {
  const first = SessionSummarySchema.parse({
    id: "da911f87-ff26-46d8-9a58-bad222a584ab",
    folderId: null,
    title: "First",
    createdAt: "2026-07-20T12:00:00.000Z",
    updatedAt: "2026-07-20T12:00:00.000Z",
  });
  const second = { ...first, id: "9c79d764-128d-4a75-b04c-4a3739f78d09", title: "Second" };
  const page = SessionPageSchema.parse({ items: [second], nextCursor: null });
  const initial = { ...initialDesktopState, globalSessions: [first], globalNextCursor: "next" };
  const expanded = desktopReducer(initial, { type: "global.page", page });
  expect(expanded.globalSessions).toEqual([first, second]);
  expect(expanded.globalNextCursor).toBeNull();
  const deleted = desktopReducer(initial, { type: "session.deleted", sessionId: first.id });
  const refilled = desktopReducer(deleted, { type: "global.refresh", page });
  expect(refilled.globalSessions).toEqual([second]);
});
