"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CreateClientForm } from "@/components/clients/CreateClientForm";
import { IconPlus } from "@/components/ui/icons";

export function CreateClientButton({ organisationId, companyId }: { organisationId: string; companyId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <IconPlus width={13} height={13} />
        Add Client
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add client">
        <CreateClientForm organisationId={organisationId} companyId={companyId} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
