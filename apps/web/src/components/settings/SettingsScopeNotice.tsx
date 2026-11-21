import { resolveEnvironmentMachineKind, type EnvironmentId } from "@t3tools/contracts";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { buildTraitsTriggerDisplay } from "@t3tools/client-runtime/model-traits";
import { useGT, useMessages } from "gt-react";
import { ChevronRightIcon, GaugeIcon, LayersIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../lib/utils";
import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import {
  useEnvironmentProviders,
  useEnvironments,
  type EnvironmentPresentation,
} from "../../state/environments";
import { EMPTY_SERVER_PROVIDERS } from "../../state/server";
import { EnvironmentMachineIcon } from "../EnvironmentMachineIcon";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { getTraitsSectionVisibility } from "../chat/TraitsPicker";
import { ProjectFavicon } from "../ProjectFavicon";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { ITEM_ROW_CLASSNAME } from "./itemRows";
import { projectDefaultModels } from "./ProjectDefaultsSettings.logic";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsPageContainer, SettingsSection } from "./settingsLayout";
import { useSettingsScope } from "./SettingsScopeContext";
import type { SettingsScopeSearch } from "./settingsScope";
import {
  projectScopeMenuGroups,
  selectProjectAxis,
  settingsScopeEnvironmentAddress,
  settingsScopeEnvironmentLabels,
  settingsScopeProjectMachines,
} from "./settingsScopeAxis";

interface ScopeChoice {
  label: string;
  secondary?: string;
  detail?: ReactNode;
  icon: ReactNode;
  search: SettingsScopeSearch;
}

export function SettingsScopeNotice({
  children,
  target,
  targetId,
  eligibleEnvironmentIds,
  inline = false,
}: {
  children: string;
  /** Renders inside a section instead of as its own page. */
  inline?: boolean;
  target: "environment" | "all" | "project" | "checkout";
  targetId?: string;
  eligibleEnvironmentIds?: readonly EnvironmentId[];
}) {
  const gt = useGT();
  const resolve = useMessages();
  const { selectScope, search, groups } = useSettingsScope();
  const navigate = useNavigate({ from: "/settings" });
  const pathname = useLocation({ select: (location) => location.pathname });
  const { environments } = useEnvironments();
  const providersByEnvironment = useEnvironmentProviders();
  const defaultModel = (group: SidebarProjectSnapshot) => {
    const models = projectDefaultModels(
      group.memberProjects.map((member) => ({
        project: member,
        settings: environments.find((entry) => entry.environmentId === member.environmentId)
          ?.serverConfig?.settings,
        providers: providersByEnvironment.get(member.environmentId) ?? EMPTY_SERVER_PROVIDERS,
      })),
    );
    const [model] = models;
    if (!model) return null;
    if (models.length > 1) return gt("Mixed", { $context: "values differ across targets" });
    const chip = (
      <Badge variant="outline" size="control" className="min-w-0">
        {model.entry ? (
          <ProviderInstanceIcon
            driverKind={model.entry.driverKind}
            displayName={model.entry.displayName}
            accentColor={model.entry.accentColor}
            acpRegistryAgentId={model.entry.acpRegistryAgentId}
            acpRegistryIconUrl={model.entry.acpRegistryIconUrl}
            showBadge={model.showInstanceBadge}
            className="size-4"
            iconClassName="size-4"
            indicatorBackground="var(--background)"
            badgeClassName="right-[-0.125rem] bottom-[-0.125rem] h-3 min-w-3 px-0.5 text-5xs"
          />
        ) : null}
        <span className="truncate">{model.label}</span>
      </Badge>
    );
    if (!model.entry) return chip;
    const traits = getTraitsSectionVisibility({
      provider: model.entry.driverKind,
      models: model.entry.models,
      model: model.selection.model,
      modelOptions: model.selection.options ?? [],
      allowPromptInjectedEffort: false,
      resolve,
    });
    if (!traits.hasAnyControls) return chip;
    const { label: traitsLabel } = buildTraitsTriggerDisplay(
      {
        descriptors: traits.descriptors,
        primarySelectDescriptorId: traits.primarySelectDescriptor?.id ?? null,
        ultrathinkPromptControlled: traits.ultrathinkPromptControlled,
        modelSelection: model.selection,
      },
      resolve,
    );
    return (
      <>
        {chip}
        <Badge variant="outline" size="control" className="hidden min-w-0 sm:inline-flex">
          <GaugeIcon aria-hidden />
          <span className="truncate">{traitsLabel}</span>
        </Badge>
      </>
    );
  };
  const environmentIcon = (environment: EnvironmentPresentation | undefined) =>
    environment ? (
      <EnvironmentMachineIcon
        aria-hidden
        kind={resolveEnvironmentMachineKind(environment.serverConfig)}
        className="size-4 shrink-0 text-muted-foreground"
      />
    ) : null;
  const choiceGroups =
    target === "checkout"
      ? groups.filter((group) => !search.project || group.projectKey === search.project)
      : [null];
  const projectGroups = projectScopeMenuGroups(groups, search);
  const renderChoices = (group: SidebarProjectSnapshot | null) => {
    const choices: ScopeChoice[] = group
      ? group.memberProjects.map((member) => {
          const environment = environments.find(
            (entry) => entry.environmentId === member.environmentId,
          );
          const { primary, secondary } = environment
            ? settingsScopeEnvironmentLabels(environment, environments)
            : {
                primary: member.environmentLabel ?? gt("Environment"),
                secondary: member.environmentId,
              };
          return {
            label: primary,
            secondary: [secondary, member.workspaceRoot].filter(Boolean).join(" · "),
            icon: environmentIcon(environment),
            search: {
              project: group.projectKey,
              machine: member.environmentId,
              checkout: member.physicalProjectKey,
            },
          };
        })
      : target === "project"
        ? projectGroups.map((group) => ({
            label: group.displayName,
            secondary: [
              ...(group.archived ? [gt("Archived", { $context: "project state" })] : []),
              ...(projectGroups.some(
                (other) =>
                  other.projectKey !== group.projectKey && other.displayName === group.displayName,
              )
                ? settingsScopeProjectMachines(group, environments)
                : []),
              group.workspaceRoot,
            ].join(" · "),
            detail: defaultModel(group),
            icon: <ProjectFavicon project={group} className="size-4 shrink-0" />,
            search: selectProjectAxis(search, group.projectKey),
          }))
        : target === "environment"
          ? environments
              .filter(
                (entry) =>
                  eligibleEnvironmentIds === undefined ||
                  eligibleEnvironmentIds.includes(entry.environmentId),
              )
              .map((entry) => {
                const { primary, secondary } = settingsScopeEnvironmentLabels(entry, environments);
                return {
                  label: primary,
                  secondary: secondary || settingsScopeEnvironmentAddress(entry),
                  icon: environmentIcon(entry),
                  search: { machine: entry.environmentId },
                };
              })
          : [
              {
                label: gt("Open all environments"),
                icon: <LayersIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />,
                search: {},
              },
            ];
    return choices.map((choice) => (
      <button
        key={JSON.stringify(choice.search)}
        type="button"
        className={cn(
          ITEM_ROW_CLASSNAME,
          "flex w-full min-w-0 cursor-pointer items-center gap-3 text-left outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        )}
        onClick={() => {
          if (targetId)
            void navigate({
              to: pathname,
              search: () => ({
                project: undefined,
                machine: undefined,
                checkout: undefined,
                ...choice.search,
              }),
              hash: targetId,
            });
          else selectScope(choice.search);
        }}
      >
        {choice.icon}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{choice.label}</span>
          {choice.secondary ? (
            <Tooltip>
              <TooltipTrigger
                render={<span className="block truncate text-xs text-muted-foreground" />}
              >
                {choice.secondary}
              </TooltipTrigger>
              <TooltipPopup>{choice.secondary}</TooltipPopup>
            </Tooltip>
          ) : null}
        </span>
        {choice.detail ? (
          <span className="flex max-w-96 shrink-0 gap-1.5 text-xs text-muted-foreground">
            {choice.detail}
          </span>
        ) : null}
        <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>
    ));
  };
  const notice = (
    <div className="space-y-3">
      <p role="status" className="px-3 text-sm text-muted-foreground sm:px-4">
        {children}
      </p>
      <div className="space-y-4">
        {choiceGroups.map((group) =>
          group?.displayName ? (
            <SettingsSection key={group.projectKey} title={group.displayName}>
              {renderChoices(group)}
            </SettingsSection>
          ) : (
            <SettingsGroup key={group?.projectKey ?? target}>{renderChoices(group)}</SettingsGroup>
          ),
        )}
      </div>
    </div>
  );
  return inline ? notice : <SettingsPageContainer>{notice}</SettingsPageContainer>;
}
