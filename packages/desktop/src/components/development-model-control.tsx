import type { DevelopmentModel, DevelopmentModelSettings } from "@gardendesk/shared";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { DevelopmentModelApi } from "../api.js";
import { DevelopmentModelModal } from "./development-model-modal.js";
import { Icon } from "./icons.js";

const LOCAL_LABEL = "Local";
const NO_SETTINGS: DevelopmentModelSettings = { favorites: [], keyPresent: false };

interface ControlProps {
  api: DevelopmentModelApi;
  disabled: boolean;
  selected: DevelopmentModel | undefined;
  onSelect(model: DevelopmentModel | undefined): void;
}

interface MenuProps {
  favorites: DevelopmentModel[];
  selected: DevelopmentModel | undefined;
  onChoose(model: DevelopmentModel | undefined): void;
  onEdit(): void;
  onClose(): void;
}

function option(selected: boolean, label: string) {
  return (
    <>
      <span aria-hidden="true" className="effort-option-check">
        {selected ? <Icon name="check" /> : null}
      </span>
      <span className="development-model-option-label">{label}</span>
    </>
  );
}

function ModelMenu({ favorites, selected, onChoose, onEdit, onClose }: MenuProps) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <div
      aria-label="Model"
      className="effort-menu development-model-menu"
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") onClose();
      }}
      role="menu"
    >
      <button
        aria-checked={selected === undefined}
        className="effort-option"
        onClick={() => onChoose(undefined)}
        ref={selected === undefined ? first : undefined}
        role="menuitemradio"
        type="button"
      >
        {option(selected === undefined, LOCAL_LABEL)}
      </button>
      {favorites.map((model) => (
        <button
          aria-checked={model.id === selected?.id}
          className="effort-option"
          key={model.id}
          onClick={() => onChoose(model)}
          ref={model.id === selected?.id ? first : undefined}
          role="menuitemradio"
          type="button"
        >
          {option(model.id === selected?.id, model.name)}
        </button>
      ))}
      <button
        className="effort-option development-model-menu-edit"
        onClick={onEdit}
        role="menuitem"
        type="button"
      >
        {option(false, "Edit favorites…")}
      </button>
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: one control keeps the selection and its modal together.
export function DevelopmentModelControl({ api, disabled, selected, onSelect }: ControlProps) {
  const [settings, setSettings] = useState(NO_SETTINGS);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const field = useRef<HTMLDivElement>(null);
  const control = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    void api.settings().then(setSettings, () => setSettings(NO_SETTINGS));
  }, [api]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!field.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  const close = () => {
    setOpen(false);
    control.current?.focus();
  };
  const saved = (next: DevelopmentModelSettings) => {
    setSettings(next);
    setEditing(false);
    if (selected !== undefined && !next.favorites.some((model) => model.id === selected.id))
      onSelect(undefined);
  };
  return (
    <div className="effort-field development-model-field" ref={field}>
      {open && !disabled ? (
        <ModelMenu
          favorites={settings.favorites}
          onChoose={(model) => {
            onSelect(model);
            close();
          }}
          onClose={close}
          onEdit={() => {
            setOpen(false);
            setEditing(true);
          }}
          selected={selected}
        />
      ) : null}
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Model: ${selected?.name ?? LOCAL_LABEL}`}
        className="effort-control"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        ref={control}
        title="Which model answers this task"
        type="button"
      >
        <span className="effort-label">Model</span>
        <span className="effort-value">{selected?.name ?? LOCAL_LABEL}</span>
        <span aria-hidden="true" className="effort-caret" />
      </button>
      {selected === undefined ? null : (
        <span className="development-model-badge">OpenRouter · Development</span>
      )}
      {editing ? (
        <DevelopmentModelModal
          api={api}
          onCancel={() => setEditing(false)}
          onSaved={saved}
          settings={settings}
        />
      ) : null}
    </div>
  );
}
