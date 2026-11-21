import type { ModelSelection, ProjectId, ServerProvider, ServerSettings } from "@t3tools/contracts";
import type { UnifiedSettings } from "@t3tools/contracts/settings";
import {
  resolveProjectSettings,
  type LegacyProjectSettingsFields,
} from "@t3tools/shared/projectSettings";
import { msg } from "gt-react";

import { resolveEffectiveDefaultModelSelection } from "../../modelSelection";
import {
  providerInstanceEntriesFor,
  resolveDefaultProviderModelSelection,
  shouldShowInstanceBadge,
  resolveProjectDefaultProviderModelSelection,
  type ProviderInstanceEntry,
} from "../../providerInstances";
import { m, type MessageResolver } from "../../i18n/messages";
import { getTriggerDisplayModelName } from "../chat/providerIconUtils";

export interface DefaultModelSettingsPresentation {
  readonly selection: ModelSelection | null;
  /** Set when the saved model's provider cannot run; effort stays hidden until it can. */
  readonly providerNote: string | null;
}

export function resolveDefaultModelSettingsPresentation(
  input: {
    readonly entries: ReadonlyArray<ProviderInstanceEntry>;
    readonly providers: ReadonlyArray<ServerProvider>;
    readonly settings: UnifiedSettings;
    readonly projectId: ProjectId | null;
  },
  resolve: MessageResolver = m,
): DefaultModelSettingsPresentation {
  const saved = input.settings.defaultModelSelection;
  if (saved === null) {
    const automatic = resolveProjectDefaultProviderModelSelection(
      input.providers,
      input.settings,
      input.projectId,
    );
    return {
      selection: automatic
        ? resolveEffectiveDefaultModelSelection(input.settings, input.providers, automatic)
        : null,
      providerNote: null,
    };
  }

  const savedEntry = input.entries.find((entry) => entry.instanceId === saved.instanceId);
  const resolved = resolveDefaultProviderModelSelection(input.providers, saved);
  // Settings can turn a provider off before the server snapshot catches up, so check both.
  if (
    !savedEntry?.enabled ||
    !savedEntry.isAvailable ||
    resolved?.instanceId !== saved.instanceId
  ) {
    return { selection: saved, providerNote: providerNote(savedEntry, resolve) };
  }
  return {
    selection: resolveEffectiveDefaultModelSelection(input.settings, input.providers, resolved),
    providerNote: null,
  };
}

function providerNote(entry: ProviderInstanceEntry | undefined, resolve: MessageResolver): string {
  if (!entry) return resolve(msg("This provider is not available on this environment."));
  if (!entry.enabled)
    return resolve(msg("{provider} is turned off.", { provider: entry.displayName }));
  return resolve(msg("{provider} is unavailable.", { provider: entry.displayName }));
}

interface ProjectDefaultModel {
  readonly selection: ModelSelection;
  readonly label: string;
  readonly entry: ProviderInstanceEntry | undefined;
  readonly showInstanceBadge: boolean;
}

/** Distinct models and options new threads would start with across a project's checkouts. */
export function projectDefaultModels(
  members: ReadonlyArray<{
    readonly project: LegacyProjectSettingsFields & { readonly id: ProjectId };
    readonly settings: ServerSettings | undefined;
    readonly providers: ReadonlyArray<ServerProvider>;
  }>,
): ProjectDefaultModel[] {
  const models = new Map<string, ProjectDefaultModel>();
  for (const { project, settings, providers } of members) {
    if (!settings) continue;
    const selection =
      resolveProjectSettings(settings, project.id, project).settings.defaultModelSelection ??
      resolveProjectDefaultProviderModelSelection(providers, settings, project.id);
    if (!selection) continue;
    const key = JSON.stringify([selection.instanceId, selection.model, selection.options ?? []]);
    if (models.has(key)) continue;
    const entries = providerInstanceEntriesFor(providers, settings, project.id);
    const entry = entries.find((candidate) => candidate.instanceId === selection.instanceId);
    const model = entry?.models.find((candidate) => candidate.slug === selection.model);
    models.set(key, {
      selection,
      label: model ? getTriggerDisplayModelName(model, entry?.driverKind) : selection.model,
      entry,
      showInstanceBadge: entry !== undefined && shouldShowInstanceBadge(entry, entries),
    });
  }
  return [...models.values()];
}
