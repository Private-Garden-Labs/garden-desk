import { t } from "../i18n/index.js";

export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string | undefined;
  onDismiss(): void;
}) {
  if (message === undefined) return null;
  return (
    <div className="error-banner" role="alert">
      <span>{message}</span>
      <button aria-label={t("error.dismiss")} onClick={onDismiss} type="button">
        ×
      </button>
    </div>
  );
}
