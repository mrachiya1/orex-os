"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPropertyDefinition } from "@/app/actions/project-properties";
import { PROPERTY_TYPES, type PropertyType } from "@/lib/projects/property-types";
import { Popover } from "@/components/ui/Popover";
import { IconPlus } from "@/components/ui/icons";

const TYPE_LABEL: Record<PropertyType, string> = {
  text: "Text",
  number: "Number",
  select: "Select",
  multi_select: "Multi-select",
  status: "Status",
  date: "Date",
  person: "Person",
  files: "Files & media",
  checkbox: "Checkbox",
  url: "URL",
  email: "Email",
  phone: "Phone",
};

const NEEDS_OPTIONS: PropertyType[] = ["select", "multi_select", "status"];

export function AddPropertyMenu({
  organisationId,
  companyId,
  onCreated,
}: {
  organisationId: string;
  companyId: string;
  onCreated: () => void;
}) {
  return (
    <Popover
      align="right"
      trigger={
        <span className="ox-focus-ring grid h-7 w-7 place-items-center rounded-[var(--radius-s)] border border-[var(--border-medium)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <IconPlus width={13} height={13} />
        </span>
      }
    >
      {(close) => <Form organisationId={organisationId} companyId={companyId} onDone={() => { close(); onCreated(); }} />}
    </Popover>
  );
}

function Form({ organisationId, companyId, onDone }: { organisationId: string; companyId: string; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<PropertyType>("text");
  const [options, setOptions] = useState<string[]>(["Option 1"]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const configuration = NEEDS_OPTIONS.includes(type)
          ? { options: options.filter((o) => o.trim()).map((label, i) => ({ id: `opt_${i}_${label.toLowerCase().replace(/\W+/g, "_")}`, label })) }
          : {};
        await createPropertyDefinition({ organisationId, companyId, name: name.trim(), propertyType: type, configuration });
        router.refresh();
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create property");
      }
    });
  }

  return (
    <form onSubmit={submit} className="w-64 px-3 py-2.5">
      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">New Property</div>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Property name"
        className="ox-input mb-2 h-8 w-full text-[12px]"
      />
      <select value={type} onChange={(e) => setType(e.target.value as PropertyType)} className="ox-select mb-2 h-8 w-full text-[12px]">
        {PROPERTY_TYPES.map((t) => (
          <option key={t} value={t}>{TYPE_LABEL[t]}</option>
        ))}
      </select>

      {NEEDS_OPTIONS.includes(type) && (
        <div className="mb-2 flex flex-col gap-1.5">
          {options.map((o, i) => (
            <input
              key={i}
              value={o}
              onChange={(e) => setOptions((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))}
              className="ox-input h-7 w-full text-[11.5px]"
            />
          ))}
          <button type="button" onClick={() => setOptions((prev) => [...prev, `Option ${prev.length + 1}`])} className="self-start text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            + Add option
          </button>
        </div>
      )}

      {error && <p className="ox-error mb-2">{error}</p>}
      <button type="submit" disabled={isPending} className="ox-btn ox-btn-primary ox-btn-sm w-full">
        {isPending ? "Creating…" : "Create property"}
      </button>
    </form>
  );
}
