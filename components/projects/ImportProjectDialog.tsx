"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { importProject } from "@/app/actions/project-import";
import { IconUpload } from "@/components/ui/icons";

export function ImportProjectButton({
  companyId,
  organisationId,
  companySlug,
}: {
  companyId: string;
  organisationId: string;
  companySlug: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <IconUpload width={13} height={13} />
        Import project
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Import project">
        <ImportProjectForm
          companyId={companyId}
          organisationId={organisationId}
          companySlug={companySlug}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function ImportProjectForm({
  companyId,
  organisationId,
  companySlug,
  onDone,
}: {
  companyId: string;
  organisationId: string;
  companySlug: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(file: File) {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch {
        setError("That file is not valid JSON.");
        return;
      }
      startTransition(async () => {
        const result = await importProject({ companyId, organisationId, file: parsed });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onDone();
        router.push(`/${companySlug}/projects/${result.projectId}`);
        router.refresh();
      });
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-[var(--text-secondary)]">
        Choose a project export file (.json) previously downloaded from Orex OS. This creates a brand-new project
        in this company — it never overwrites an existing one.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        disabled={isPending}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="ox-input"
      />
      {error && <p className="ox-error">{error}</p>}
      {isPending && <p className="text-[11.5px] text-[var(--text-muted)]">Importing…</p>}
    </div>
  );
}
