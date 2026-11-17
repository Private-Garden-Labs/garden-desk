import type { DevelopmentModel, DevelopmentModelSettings } from "@gardendesk/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DevelopmentModelApi } from "../api.js";
import { DevelopmentModelControl } from "./development-model-control.js";
import { DevelopmentModelModal } from "./development-model-modal.js";

const FAVORITES: DevelopmentModel[] = [
  { id: "vendor/model", name: "Vendor Model", contextTokens: 128_000 },
];
const SETTINGS: DevelopmentModelSettings = {
  favorites: FAVORITES,
  keyPresent: true,
  keyLastFour: "-key",
};
const api: DevelopmentModelApi = {
  settings: async () => SETTINGS,
  search: async () => [],
  save: async () => SETTINGS,
};

function control(selected: DevelopmentModel | undefined) {
  return renderToStaticMarkup(
    <DevelopmentModelControl
      api={api}
      disabled={false}
      onSelect={() => undefined}
      selected={selected}
    />,
  );
}

describe("development model selector", () => {
  it("starts on Local and marks a cloud selection", () => {
    expect(control(undefined)).toContain("Model: Local");
    expect(control(undefined)).not.toContain("OpenRouter");
    const cloud = control(FAVORITES[0]);
    expect(cloud).toContain("OpenRouter · Development · vendor/model");
    expect(cloud).toContain("development-model-dot");
    expect(cloud).toContain("Vendor Model");
  });

  it("shows the disclaimer, the masked key, and the saved favorites", () => {
    const markup = renderToStaticMarkup(
      <DevelopmentModelModal
        api={api}
        onCancel={() => undefined}
        onSaved={() => undefined}
        settings={SETTINGS}
      />,
    );
    expect(markup).toContain("For development only.");
    expect(markup).toContain("Saved key ••••-key");
    expect(markup).toContain("Vendor Model");
    expect(markup).toContain("Remove");
    expect(markup).toContain("Save");
  });
});
