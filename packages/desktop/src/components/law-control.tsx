import { type Jurisdiction, LAW_DISCLAIMER } from "@gardendesk/shared";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { LawsController } from "../laws.js";
import { Icon } from "./icons.js";

interface LawMenuProps {
  laws: LawsController;
  onChoose(id: Jurisdiction): void;
  onClose(): void;
}

function LawMenu({ laws, onChoose, onClose }: LawMenuProps) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <div className="effort-menu law-menu">
      <div
        aria-label="Law"
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Escape") onClose();
        }}
        role="listbox"
      >
        {laws.enabled.map((law) => (
          <button
            aria-selected={law.id === laws.selected}
            className="effort-option"
            key={law.id}
            onClick={() => onChoose(law.id)}
            ref={law.id === laws.selected ? first : undefined}
            role="option"
            type="button"
          >
            <span aria-hidden="true" className="effort-option-check">
              {law.id === laws.selected ? <Icon name="check" /> : null}
            </span>
            {law.name}
          </button>
        ))}
      </div>
      <p className="law-menu-note">{LAW_DISCLAIMER}</p>
    </div>
  );
}

export function LawControl({ disabled, laws }: { disabled: boolean; laws: LawsController }) {
  const [open, setOpen] = useState(false);
  const field = useRef<HTMLDivElement>(null);
  const control = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!field.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  const selected = laws.enabled.find((law) => law.id === laws.selected);
  if (selected === undefined) return null;
  const close = () => {
    setOpen(false);
    control.current?.focus();
  };
  return (
    <div className="effort-field" ref={field}>
      {open && !disabled ? (
        <LawMenu
          laws={laws}
          onChoose={(id) => {
            laws.choose(id);
            close();
          }}
          onClose={close}
        />
      ) : null}
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Law: ${selected.name}`}
        className="effort-control"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        ref={control}
        title={LAW_DISCLAIMER}
        type="button"
      >
        <Icon name="read" />
        <span className="effort-label">Law</span>
        <span className="effort-value">{selected.name}</span>
        <span aria-hidden="true" className="effort-caret" />
      </button>
    </div>
  );
}
