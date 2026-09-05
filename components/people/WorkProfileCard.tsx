"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateWorkProfile } from "@/app/actions/people";
import { Card, CardHeader } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";

export interface WorkProfileData {
  userId: string;
  displayName: string | null;
  fullName: string | null;
  email: string | null;
  jobTitle: string | null;
  department: string | null;
  timezone: string | null;
  skills: string[];
}

export function WorkProfileCard({ profile, isSelf }: { profile: WorkProfileData; isSelf: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName ?? profile.fullName ?? "");
  const [jobTitle, setJobTitle] = useState(profile.jobTitle ?? "");
  const [department, setDepartment] = useState(profile.department ?? "");
  const [timezone, setTimezone] = useState(profile.timezone ?? "");
  const [skillsText, setSkillsText] = useState(profile.skills.join(", "));
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateWorkProfile({
        userId: profile.userId,
        displayName,
        jobTitle,
        department,
        timezone,
        skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Work Profile"
        action={
          isSelf && (
            <button type="button" onClick={() => setEditing((v) => !v)} className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              {editing ? "Cancel" : "Edit"}
            </button>
          )
        }
      />
      <div className="flex flex-col gap-3 px-5 pb-5">
        {!editing ? (
          <>
            <Field label="Display name" value={profile.displayName ?? profile.fullName ?? "—"} />
            <Field label="Job title" value={profile.jobTitle ?? "—"} />
            <Field label="Department" value={profile.department ?? "—"} />
            <Field label="Timezone" value={profile.timezone ?? "—"} />
            <Field label="Skills" value={profile.skills.length ? profile.skills.join(", ") : "—"} />
          </>
        ) : (
          <>
            <LabeledInput label="Display name" value={displayName} onChange={setDisplayName} />
            <LabeledInput label="Job title" value={jobTitle} onChange={setJobTitle} />
            <LabeledInput label="Department" value={department} onChange={setDepartment} />
            <LabeledInput label="Timezone" value={timezone} onChange={setTimezone} placeholder="e.g. Asia/Colombo" />
            <LabeledInput label="Skills (comma separated)" value={skillsText} onChange={setSkillsText} />
            <Button variant="primary" size="sm" disabled={isPending} onClick={save} className="self-start">
              {isPending ? "Saving…" : "Save"}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="text-[var(--text-secondary)]">{value}</span>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="ox-field">
      <label className="ox-label">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="ox-input" />
    </div>
  );
}
