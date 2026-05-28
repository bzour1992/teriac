import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../lib/api/client";
import { SearchableSelect } from "../../components/SearchableSelect";
import { FieldLabel } from "../../lib/form-primitives";
import {
  COMMON_FIELDS_BY_ENTITY,
  FIELD_RULE_ENTITIES,
  isCardEntity,
  listClinicFieldRules,
  updateClinicFieldRule,
  type FieldRequirement,
  type FieldRule,
  type FieldVisibility,
} from "./api";

const INPUT_CLS =
  "rounded-[10px] border border-rule bg-card px-2.5 py-1.5 text-[12.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]";

const VISIBILITY_OPTIONS: ReadonlyArray<{ v: FieldVisibility; label: string }> = [
  { v: "visible", label: "Visible" },
  { v: "readonly", label: "Read-only" },
  { v: "hidden", label: "Hidden" },
];

const REQUIREMENT_OPTIONS: ReadonlyArray<{ v: FieldRequirement; label: string }> = [
  { v: "optional", label: "Optional" },
  { v: "required", label: "Required" },
  { v: "conditional", label: "Conditional" },
];

interface RowState {
  fieldName: string;
  visibility: FieldVisibility;
  requirement: FieldRequirement;
  labelEn: string;
  labelAr: string;
  defaultValue: string;
  dirty: boolean;
}

function defaultRow(fieldName: string): RowState {
  return {
    fieldName,
    visibility: "visible",
    requirement: "optional",
    labelEn: "",
    labelAr: "",
    defaultValue: "",
    dirty: false,
  };
}

function ruleToRow(rule: FieldRule | undefined, fieldName: string): RowState {
  if (!rule) return defaultRow(fieldName);
  return {
    fieldName,
    visibility: rule.visibility,
    requirement: rule.requirement,
    labelEn: rule.labelEn ?? "",
    labelAr: rule.labelAr ?? "",
    defaultValue: rule.defaultValue ?? "",
    dirty: false,
  };
}

function FieldRuleRow({
  clinicId,
  entity,
  row,
  onSaved,
}: {
  clinicId: string;
  entity: string;
  row: RowState;
  onSaved: () => void;
}): JSX.Element {
  const [state, setState] = useState<RowState>(row);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setState(row);
  }, [row]);

  const update = <K extends keyof RowState>(key: K, value: RowState[K]): void => {
    setState((prev) => ({ ...prev, [key]: value, dirty: true }));
  };

  const mut = useMutation({
    mutationFn: () =>
      updateClinicFieldRule(clinicId, entity, state.fieldName, {
        visibility: state.visibility,
        requirement: state.requirement,
        labelEn: state.labelEn.trim() || null,
        labelAr: state.labelAr.trim() || null,
        defaultValue: state.defaultValue.trim() || null,
      }),
    onSuccess: () => {
      setSaved(true);
      setErr(null);
      setState((prev) => ({ ...prev, dirty: false }));
      setTimeout(() => setSaved(false), 1500);
      onSaved();
    },
    onError: (e) =>
      setErr(e instanceof ApiError ? e.message : (e as Error).message),
  });

  const isCard = isCardEntity(entity);

  return (
    <tr className="border-t border-dashed border-rule align-middle">
      <td className="px-3 py-2.5">
        <div className="font-mono text-[12.5px] tnum text-ink">
          {state.fieldName}
        </div>
        {err && (
          <div className="mt-0.5 text-[11px] text-alert-fg" role="alert">
            {err}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5">
        <SearchableSelect
          value={state.visibility}
          onChange={(v) => update("visibility", v as FieldVisibility)}
          ariaLabel="Visibility"
          options={VISIBILITY_OPTIONS.map((o) => ({ value: o.v, label: o.label }))}
        />
      </td>
      {!isCard && (
        <td className="px-3 py-2.5">
          <SearchableSelect
            value={state.requirement}
            onChange={(v) => update("requirement", v as FieldRequirement)}
            ariaLabel="Requirement"
            options={REQUIREMENT_OPTIONS.map((o) => ({ value: o.v, label: o.label }))}
          />
        </td>
      )}
      <td className="px-3 py-2.5">
        <input
          type="text"
          value={state.labelEn}
          onChange={(e) => update("labelEn", e.target.value)}
          placeholder="Label (EN)"
          dir="auto"
          className={INPUT_CLS + " w-full"}
        />
      </td>
      <td className="px-3 py-2.5">
        <input
          type="text"
          value={state.labelAr}
          onChange={(e) => update("labelAr", e.target.value)}
          placeholder="Label (AR)"
          dir="auto"
          className={INPUT_CLS + " w-full"}
        />
      </td>
      {!isCard && (
        <td className="px-3 py-2.5">
          <input
            type="text"
            value={state.defaultValue}
            onChange={(e) => update("defaultValue", e.target.value)}
            placeholder="Default value"
            dir="auto"
            className={INPUT_CLS + " w-full"}
            title="Pre-fills this field when a new record is opened. For numeric fields (sex, visitType, intensity, painLevel) enter the numeric code."
          />
        </td>
      )}
      <td className="px-3 py-2.5 text-end">
        <div className="flex items-center justify-end gap-2">
          {saved && (
            <span className="text-[11.5px] font-medium text-vital-fg">Saved ✓</span>
          )}
          <button
            type="button"
            disabled={!state.dirty || mut.isPending}
            onClick={() => mut.mutate()}
            className="rounded-[10px] bg-primary px-3 py-1.5 text-[12px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mut.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </td>
    </tr>
  );
}

export function ClinicFieldRulesTab({
  clinicId,
}: {
  clinicId: string;
}): JSX.Element {
  const qc = useQueryClient();
  const [entity, setEntity] = useState<string>(FIELD_RULE_ENTITIES[0] ?? "patient");

  const query = useQuery({
    queryKey: ["superadmin", "clinic", clinicId, "field-rules", entity],
    queryFn: ({ signal }) => listClinicFieldRules(clinicId, entity, signal),
    staleTime: 30_000,
  });

  const rules = query.data ?? [];

  const rows = useMemo<RowState[]>(() => {
    const byField = new Map(rules.map((r) => [r.fieldName, r]));
    const commonFields = COMMON_FIELDS_BY_ENTITY[entity] ?? [];
    const allFields = new Set<string>([
      ...commonFields,
      ...rules.map((r) => r.fieldName),
    ]);
    return Array.from(allFields).map((field) =>
      ruleToRow(byField.get(field), field),
    );
  }, [rules, entity]);

  const onSaved = (): void => {
    qc.invalidateQueries({
      queryKey: ["superadmin", "clinic", clinicId, "field-rules", entity],
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-medium tracking-tight">
            Field rules
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-3">
            Override per-clinic field visibility, requirement, and labels.
          </p>
        </div>
        <div className="min-w-[200px]">
          <FieldLabel>Entity</FieldLabel>
          <SearchableSelect
            value={entity}
            onChange={(v) => setEntity(String(v))}
            options={FIELD_RULE_ENTITIES.map((e) => ({
              value: e,
              label: e.charAt(0).toUpperCase() + e.slice(1),
            }))}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-rule bg-card shadow-1">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="bg-card-2">
              <th className="border-b border-rule px-3 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                {isCardEntity(entity) ? "Card" : "Field"}
              </th>
              <th className="border-b border-rule px-3 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Visibility
              </th>
              {!isCardEntity(entity) && (
                <th className="border-b border-rule px-3 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                  Requirement
                </th>
              )}
              <th className="border-b border-rule px-3 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Label (EN)
              </th>
              <th className="border-b border-rule px-3 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Label (AR)
              </th>
              {!isCardEntity(entity) && (
                <th className="border-b border-rule px-3 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                  Default value
                </th>
              )}
              <th className="border-b border-rule px-3 py-3 text-end text-[11px] font-medium uppercase tracking-wider text-ink-3">
                {" "}
              </th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Total cols: card entities have 5 (Card, Visibility, Label EN, Label AR, action),
              // field entities have 7 (Field, Visibility, Requirement, Label EN, Label AR, Default, action).
              const totalCols = isCardEntity(entity) ? 5 : 7;
              if (query.isLoading) {
                return (
                  <tr>
                    <td
                      colSpan={totalCols}
                      className="px-3 py-8 text-center text-[13px] text-ink-3"
                    >
                      Loading…
                    </td>
                  </tr>
                );
              }
              if (query.error) {
                return (
                  <tr>
                    <td
                      colSpan={totalCols}
                      className="px-3 py-8 text-center text-[13px] text-alert-fg"
                    >
                      {(query.error as Error).message}
                    </td>
                  </tr>
                );
              }
              if (rows.length === 0) {
                return (
                  <tr>
                    <td
                      colSpan={totalCols}
                      className="px-3 py-12 text-center text-[13px] text-ink-3"
                    >
                      {isCardEntity(entity) ? "No cards configured." : "No fields configured."}
                    </td>
                  </tr>
                );
              }
              return rows.map((row) => (
                <FieldRuleRow
                  key={`${entity}-${row.fieldName}`}
                  clinicId={clinicId}
                  entity={entity}
                  row={row}
                  onSaved={onSaved}
                />
              ));
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
