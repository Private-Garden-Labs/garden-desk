import type { AttachmentSummary } from "@gardendesk/shared";
import { t } from "../i18n/index.js";

interface AttachmentChipProps {
  attachment: AttachmentSummary;
  disabled?: boolean;
  onOpen(): void;
  onRemove?: (() => void) | undefined;
}

export function AttachmentChip({
  attachment,
  disabled = false,
  onOpen,
  onRemove,
}: AttachmentChipProps) {
  return (
    <li className="attachment-chip">
      <button
        aria-label={t("attachment.open", { name: attachment.name })}
        className="attachment-open"
        disabled={disabled}
        onClick={onOpen}
        title={attachment.name}
        type="button"
      >
        {attachment.name}
      </button>
      {onRemove === undefined ? null : (
        <button
          aria-label={t("attachment.removeName", { name: attachment.name })}
          className="attachment-remove"
          disabled={disabled}
          onClick={onRemove}
          type="button"
        >
          ×
        </button>
      )}
    </li>
  );
}
