import type { DevelopmentModel, DevelopmentModelSettings } from "@gardendesk/shared";
import { useEffect, useRef, useState } from "react";
import type { DevelopmentModelApi } from "../api.js";

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

function SearchResults({
  search,
  saved,
  onAdd,
}: {
  search: SearchState;
  saved: DevelopmentModel[];
  onAdd(model: DevelopmentModel): void;
}) {
  if (search.loading) return <p className="development-model-note">Searching…</p>;
  if (search.message !== undefined)
    return <p className="development-model-note">{search.message}</p>;
  return (
    <ul className="development-model-results">
      {search.results.map((model) => (
        <li className="development-model-row" key={model.id}>
          <span>
            <strong>{model.name}</strong>
            <code>{model.id}</code>
          </span>
          <button
            disabled={saved.some((favorite) => favorite.id === model.id)}
            onClick={() => onAdd(model)}
            type="button"
          >
            Add
          </button>
        </li>
      ))}
    </ul>
  );
}

function Favorites({
  favorites,
  onRemove,
}: {
  favorites: DevelopmentModel[];
  onRemove(id: string): void;
}) {
  if (favorites.length === 0)
    return <p className="development-model-note">No favorites saved yet.</p>;
  return (
    <ul className="development-model-favorites">
      {favorites.map((model) => (
        <li className="development-model-row" key={model.id}>
          <span>
            <strong>{model.name}</strong>
            <code>{model.id}</code>
          </span>
          <button onClick={() => onRemove(model.id)} type="button">
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

interface ModalProps {
  api: DevelopmentModelApi;
  settings: DevelopmentModelSettings;
  onCancel(): void;
  onSaved(settings: DevelopmentModelSettings): void;
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: one dialog keeps the favorites edit state together.
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
        <p className="development-model-disclaimer">{DISCLAIMER}</p>
        <label htmlFor="development-model-key">OpenRouter API key</label>
        <input
          autoComplete="off"
          id="development-model-key"
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={
            settings.keyPresent ? `Saved key ••••${settings.keyLastFour ?? ""}` : "sk-or-…"
          }
          type="password"
          value={apiKey}
        />
        <label htmlFor="development-model-search">Search models</label>
        <input
          autoComplete="off"
          id="development-model-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search OpenRouter"
          type="search"
          value={query}
        />
        <SearchResults
          onAdd={(model) => setFavorites([...favorites, model])}
          saved={favorites}
          search={search}
        />
        <h3>Favorites</h3>
        <Favorites
          favorites={favorites}
          onRemove={(id) => setFavorites(favorites.filter((model) => model.id !== id))}
        />
        {saveError === undefined ? null : <p className="development-model-error">{saveError}</p>}
        <div className="confirmation-actions">
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
