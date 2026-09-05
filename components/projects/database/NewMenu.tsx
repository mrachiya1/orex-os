"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Popover, PopoverOption } from "@/components/ui/Popover";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { createFolder } from "@/app/actions/project-folders";
import { IconPlus } from "@/components/ui/icons";

/** Combined "+ New" entry point: New Project (modal form) or New Folder (inline). */
export function NewMenu({
  organisationId,
  companyId,
  companySlug,
  folderId,
}: {
  organisationId: string;
  companyId: string;
  companySlug: string;
  folderId?: string;
}) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [folderMode, setFolderMode] = useState(false);

  return (
    <>
      <Popover
        align="right"
        trigger={
          <span className="ox-btn ox-btn-primary ox-btn-sm">
            <IconPlus width={12} height={12} />
            New
          </span>
        }
      >
        {(close) =>
          folderMode ? (
            <NewFolderForm
              organisationId={organisationId}
              companyId={companyId}
              parentFolderId={folderId}
              onDone={close}
            />
          ) : (
            <>
              <PopoverOption
                onClick={() => {
                  setProjectOpen(true);
                  close();
                }}
              >
                New Project
              </PopoverOption>
              <PopoverOption onClick={() => setFolderMode(true)}>New Folder</PopoverOption>
            </>
          )
        }
      </Popover>

      <Modal open={projectOpen} onClose={() => setProjectOpen(false)} title="New project">
        <ProjectForm organisationId={organisationId} companyId={companyId} companySlug={companySlug} folderId={folderId} />
      </Modal>
    </>
  );
}

function NewFolderForm({
  organisationId,
  companyId,
  parentFolderId,
  onDone,
}: {
  organisationId: string;
  companyId: string;
  parentFolderId?: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      await createFolder({ organisationId, companyId, name: name.trim(), parentFolderId });
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="w-56 px-3 py-2.5">
      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">New Folder</div>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Folder name"
        className="ox-input mb-2 h-8 w-full text-[12px]"
      />
      <Button type="submit" variant="primary" size="sm" disabled={isPending} className="w-full">
        {isPending ? "Creating…" : "Create folder"}
      </Button>
    </form>
  );
}
