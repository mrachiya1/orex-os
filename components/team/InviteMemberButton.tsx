"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { InviteForm } from "@/components/team/InviteForm";
import { IconPlus } from "@/components/ui/icons";

export function InviteMemberButton({
  companyId,
  roles,
}: {
  companyId: string;
  roles: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <IconPlus width={13} height={13} />
        Invite Member
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Invite member">
        <InviteForm companyId={companyId} roles={roles} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
