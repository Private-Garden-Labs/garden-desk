import {
  DEFAULT_THINKING_LEVEL,
  type DevelopmentModel,
  type ThinkingLevel,
} from "@gardendesk/shared";
import { useState } from "react";

/** Composer choices stay in memory, so every application start begins on the local model. */
export function useComposerSettings() {
  const [thinking, setThinking] = useState<ThinkingLevel>(DEFAULT_THINKING_LEVEL);
  const [developmentModel, setDevelopmentModel] = useState<DevelopmentModel>();
  return { developmentModel, setDevelopmentModel, setThinking, thinking };
}
