import type { DevelopmentModel, DevelopmentModelSettings } from "@gardendesk/shared";
import { useEffect, useRef, useState } from "react";
import type { DevelopmentModelApi } from "../api.js";
import { Icon } from "./icons.js";

const DISCLAIMER =
  "For development only. Production builds use only the local LLM. When you select OpenRouter, prompts, conversation history, and tool results can leave this computer. API charges can apply.";
const SEARCH_DELAY_MS = 300;

interface SearchState {
  results: DevelopmentModel[];
  loading: boolean;
  message?: string;
}

export function boundedMessage(error: unknown, fallback: string): string {
  const text = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  return text.length > 0 && text.length <= 160 ? text : fallback;
}

function useModelSearch(api: DevelopmentModelApi, query: string, apiKey: string): SearchState {
  const [state, setState] = useState<SearchState>({ results: [], loading: false });
  const latest = useRef(0);
  useEffect(() => {
    const search = query.trim();
    if (search.length === 0) {
      setState({ results: [], loading: false });
      return;
    }
    latest.current += 1;
    const request = latest.current;
    setState({ results: [], loading: true });
    const timer = setTimeout(() => {
      api
        .search(search, apiKey.length === 0 ? undefined : apiKey)
        .then((results) => {
          if (latest.current !== request) return;
          const message = results.length === 0 ? { message: "No models matched." } : {};
          setState({ results, loading: false, ...message });
        })
        .catch((error: unknown) => {
          if (latest.current !== request) return;
          setState({
            results: [],
            loading: false,
            message: boundedMessage(error, "The model search failed."),
          });
        });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [api, query, apiKey]);
  return state;
}

function ModelRow({
  model,
  action,
  disabled = false,
  onAction,
}: {
  model: DevelopmentModel;
  action: string;
  disabled?: boolean;
  onAction(): void;
}) {
  return (
    <li className="development-model-row">
      <span className="development-model-identity">
        <span className="development-model-name">{model.name}</span>
        <span className="development-model-id">{model.id}</span>
      </span>
      <button
        className="development-model-action"
        disabled={disabled}
        onClick={onAction}
        title={disabled ? "Already in favorites" : undefined}
        type="button"
      >
        {action}
      </button>
    </li>
  );
}

function SearchSection({
  search,
  saved,
  onAdd,
}: {
  search: SearchState;
  saved: DevelopmentModel[];
  onAdd(model: DevelopmentModel): void;
}) {
  const note = search.loading ? "Searching…" : search.message;
  return (
    <section className="development-model-section">
      <h3>Search results</h3>
      {note === undefined ? null : <p className="development-model-note">{note}</p>}
      <ul className="development-model-list">
        {search.results.map((model) => (
          <ModelRow
            action="Add"
            disabled={saved.some((favorite) => favorite.id === model.id)}
            key={model.id}
            model={model}
            onAction={() => onAdd(model)}
          />
        ))}
      </ul>
    </section>
  );
}

function FavoritesSection({
  favorites,
  onRemove,
}: {
  favorites: DevelopmentModel[];
  onRemove(id: string): void;
}) {
  return (
    <section className="development-model-section">
      <h3>Favorites</h3>
      {favorites.length > 0 ? null : (
        <p className="development-model-note">No favorites saved yet.</p>
      )}
      <ul className="development-model-list">
        {favorites.map((model) => (
          <ModelRow
            action="Remove"
            key={model.id}
            model={model}
            onAction={() => onRemove(model.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function DialogFields({
  settings,
  apiKey,
  query,
  onApiKey,
  onQuery,
}: {
  settings: DevelopmentModelSettings;
  apiKey: string;
  query: string;
  onApiKey(value: string): void;
  onQuery(value: string): void;
}) {
  return (
    <div className="development-model-fields">
      <div className="development-model-form-field">
        <label htmlFor="development-model-key">OpenRouter API key</label>
        <input
          autoComplete="off"
          id="development-model-key"
          onChange={(event) => onApiKey(event.target.value)}
          placeholder={
            settings.keyPresent ? `Saved key ••••${settings.keyLastFour ?? ""}` : "sk-or-…"
          }
          type="password"
          value={apiKey}
        />
      </div>
      <div className="development-model-form-field">
        <label htmlFor="development-model-search">Search models</label>
        <input
          autoComplete="off"
          id="development-model-search"
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Model name, for example gemma"
          type="search"
          value={query}
        />
      </div>
    </div>
  );
}

interface ModalProps {
  api: DevelopmentModelApi;
  settings: DevelopmentModelSettings;
  onCancel(): void;
  onSaved(settings: DevelopmentModelSettings): void;
}

export function DevelopmentModelModal({ api, settings, onCancel, onSaved }: ModalProps) {
  const [favorites, setFavorites] = useState(settings.favorites);
  const [apiKey, setApiKey] = useState("");
  const [query, setQuery] = useState("");
  const [saveError, setSaveError] = useState<string>();
  const search = useModelSearch(api, query, apiKey);
  const save = () => {
    setSaveError(undefined);
    void api
      .save(favorites, apiKey.trim().length === 0 ? undefined : apiKey.trim())
      .then(onSaved)
      .catch((error: unknown) =>
        setSaveError(boundedMessage(error, "The settings were not saved.")),
      );
  };
  return (
    <div className="confirmation-backdrop">
      <section
        aria-labelledby="development-model-title"
        aria-modal="true"
        className="confirmation-dialog development-model-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
        role="dialog"
      >
        <h2 id="development-model-title">Edit favorites</h2>
        <p className="development-model-disclaimer">
          <Icon name="error" />
          <span>{DISCLAIMER}</span>
        </p>
        <DialogFields
          apiKey={apiKey}
          onApiKey={setApiKey}
          onQuery={setQuery}
          query={query}
          settings={settings}
        />
        <div className="development-model-body">
          {query.trim().length === 0 ? null : (
            <SearchSection
              onAdd={(model) => setFavorites([...favorites, model])}
              saved={favorites}
              search={search}
            />
          )}
          <FavoritesSection
            favorites={favorites}
            onRemove={(id) => setFavorites(favorites.filter((model) => model.id !== id))}
          />
        </div>
        {saveError === undefined ? null : <p className="development-model-error">{saveError}</p>}
        <div className="confirmation-actions development-model-footer">
          <button onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="confirmation-primary" onClick={save} type="button">
            Save
          </button>
        </div>
      </section>
    </div>
  );
}
