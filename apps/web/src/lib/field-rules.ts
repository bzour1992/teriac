/**
 * Hook + types for consuming the per-clinic field rules set via the superadmin
 * portal. Fields without a rule fall back to `{ visibility: "visible",
 * requirement: "optional" }` — superadmins must explicitly opt fields out.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "./api/client";

export type FieldVisibility = "hidden" | "visible" | "readonly";
export type FieldRequirement = "optional" | "required" | "conditional";

export interface FieldRule {
  entityName: string;
  fieldName: string;
  visibility: FieldVisibility;
  requirement: FieldRequirement;
  defaultValue: string | null;
  labelEn: string | null;
  labelAr: string | null;
}

const DEFAULT_RULE: Omit<FieldRule, "entityName" | "fieldName"> = {
  visibility: "visible",
  requirement: "optional",
  defaultValue: null,
  labelEn: null,
  labelAr: null,
};

function listFieldRules(entity: string, signal?: AbortSignal): Promise<FieldRule[]> {
  return api<FieldRule[]>("/field-rules", { query: { entity }, signal });
}

export interface ResolvedField {
  /** The field key from the rule editor — used as the DOM `id` and for `htmlFor`. */
  id: string;
  /** True when the rule says this field should be omitted from the UI entirely. */
  hidden: boolean;
  /** True when input should be shown but disabled. */
  readOnly: boolean;
  /** True when the rule marks the field as required. */
  required: boolean;
  /** Resolved label (rule override → fallback). */
  label: string;
  /** Default value set in the rule editor (null when none). */
  defaultValue: string | null;
}

export interface FieldRuleMap {
  /** Get the rule for one field (returns the default rule if no override exists). */
  get(fieldName: string): FieldRule;
  isHidden(fieldName: string): boolean;
  isReadonly(fieldName: string): boolean;
  isRequired(fieldName: string): boolean;
  /** Resolve a label override based on current language; falls back to provided default. */
  label(fieldName: string, fallback: string, lang?: string): string;
  /**
   * One-shot accessor for forms — returns `{ id, hidden, readOnly, required,
   * label, defaultValue }` so a field render can spread the props directly:
   *
   *   const f = rules.field("firstName", "First");
   *   {!f.hidden && <TextInput label={f.label} required={f.required} ... />}
   */
  field(fieldName: string, fallbackLabel: string, lang?: string): ResolvedField;
  /**
   * Map of fieldName → defaultValue (only fields that have a non-empty default
   * set in the rule editor). Use to seed form state when a new record opens.
   */
  defaults: Record<string, string>;
  /** Raw access — useful for debugging or full inspection. */
  rules: FieldRule[];
  loading: boolean;
}

/**
 * Loads the field rules for one entity (e.g. "patient", "visit") and returns a
 * lookup helper. Cached for 5 minutes; on form mount this is typically already
 * warm because every screen in the app uses some subset of rules.
 */
export function useFieldRules(entity: string): FieldRuleMap {
  const { i18n } = useTranslation();
  // Normalize to bare language code so "en-US" still resolves to "en".
  const currentLang = (i18n.language || "en").split("-")[0];

  const query = useQuery({
    queryKey: ["field-rules", entity],
    queryFn: ({ signal }) => listFieldRules(entity, signal),
    staleTime: 5 * 60_000,
  });

  const rules = query.data ?? [];

  return useMemo<FieldRuleMap>(() => {
    const byField = new Map(rules.map((r) => [r.fieldName, r]));
    const fallback = (name: string): FieldRule => ({
      entityName: entity,
      fieldName: name,
      ...DEFAULT_RULE,
    });
    const get = (name: string): FieldRule => byField.get(name) ?? fallback(name);
    const resolveLabel = (name: string, defaultLabel: string, lang?: string): string => {
      const effective = lang ?? currentLang;
      const rule = byField.get(name);
      if (!rule) return defaultLabel;
      if (effective === "ar" && rule.labelAr) return rule.labelAr;
      if (effective !== "ar" && rule.labelEn) return rule.labelEn;
      return defaultLabel;
    };
    // Pre-compute the defaults map — exposed so consumers can seed forms.
    const defaults: Record<string, string> = {};
    for (const r of rules) {
      if (r.defaultValue != null && r.defaultValue !== "") {
        defaults[r.fieldName] = r.defaultValue;
      }
    }

    return {
      rules,
      loading: query.isLoading,
      get,
      isHidden: (name) => get(name).visibility === "hidden",
      isReadonly: (name) => get(name).visibility === "readonly",
      isRequired: (name) => get(name).requirement === "required",
      label: resolveLabel,
      defaults,
      field: (name, fallbackLabel, lang) => {
        const r = get(name);
        return {
          id: name,
          hidden: r.visibility === "hidden",
          readOnly: r.visibility === "readonly",
          required: r.requirement === "required",
          label: resolveLabel(name, fallbackLabel, lang),
          defaultValue: r.defaultValue,
        };
      },
    };
  }, [rules, entity, query.isLoading, currentLang]);
}
