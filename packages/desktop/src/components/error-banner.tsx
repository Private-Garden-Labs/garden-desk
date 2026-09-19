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
      <button aria-label="Dismiss error" onClick={onDismiss} type="button">
        ×
      </button>
    </div>
  );
}
