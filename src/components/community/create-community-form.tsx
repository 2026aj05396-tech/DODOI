"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { showToast } from "@/components/ui/toast";
import { createCommunity } from "@/lib/api-client/communities";
import { ApiRequestError } from "@/lib/api-client/request";
import {
  COMMUNITY_DESCRIPTION_MAX,
  COMMUNITY_NAME_MAX,
  COMMUNITY_RULE_MAX,
  COMMUNITY_RULES_MAX,
} from "@/lib/schemas/communities";

// Start a community (COM-01, COM-02, F-28 step 3; not designed, built from the system): a name, one
// craft, a description and up to 5 rules. Communities are public; the creator becomes the Owner.

export function CreateCommunityForm({
  skills,
  isVerified,
}: {
  skills: { id: string; name: string }[];
  isVerified: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const [name, setName] = useState("");
  const [skillId, setSkillId] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 3) next.name = "Use at least 3 characters for the name.";
    if (!skillId) next.skillId = "Choose the craft this community is about.";
    if (!description.trim()) next.description = "Say what this community is about.";
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;
    setIsSending(true);
    try {
      const community = await createCommunity({
        name: name.trim(),
        skillId,
        description: description.trim(),
        rules: rules.map((rule) => rule.trim()).filter(Boolean),
      });
      showToast({ message: "Your community is ready." });
      router.push(`/community/circles/${community.slug}`);
    } catch (caught) {
      setIsSending(false);
      if (caught instanceof ApiRequestError) {
        setErrors(caught.fields);
        setFormError(caught.message);
      } else {
        setFormError("We couldn't start that. Try again.");
      }
    }
  }

  return (
    <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-5">
      {!isVerified ? (
        <p role="status" className="rounded-md bg-butter p-3.5 text-body text-foreground">
          Verify your email to start a community. You can fill it in now.
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input
          id={`${id}-name`}
          value={name}
          maxLength={COMMUNITY_NAME_MAX}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${id}-name-error` : undefined}
          onChange={(event) => setName(event.target.value)}
        />
        <FieldError id={`${id}-name-error`}>{errors.name}</FieldError>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-skill`}>Craft</Label>
        <Select
          id={`${id}-skill`}
          value={skillId}
          aria-invalid={Boolean(errors.skillId)}
          aria-describedby={errors.skillId ? `${id}-skill-error` : undefined}
          onChange={(event) => setSkillId(event.target.value)}
        >
          <option value="">Choose a craft</option>
          {skills.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.name}
            </option>
          ))}
        </Select>
        <FieldError id={`${id}-skill-error`}>{errors.skillId}</FieldError>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-description`}>What is it about?</Label>
        <Textarea
          id={`${id}-description`}
          value={description}
          rows={4}
          maxLength={COMMUNITY_DESCRIPTION_MAX}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={`${id}-description-count${errors.description ? ` ${id}-description-error` : ""}`}
          onChange={(event) => setDescription(event.target.value)}
        />
        <p id={`${id}-description-count`} className="text-meta text-foreground-secondary">
          {description.length} / {COMMUNITY_DESCRIPTION_MAX}
        </p>
        <FieldError id={`${id}-description-error`}>{errors.description}</FieldError>
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="text-control-sm font-bold text-foreground">
          Rules (optional, up to {COMMUNITY_RULES_MAX})
        </legend>
        {rules.map((rule, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              aria-label={`Rule ${index + 1}`}
              value={rule}
              maxLength={COMMUNITY_RULE_MAX}
              onChange={(event) =>
                setRules((current) =>
                  current.map((item, position) => (position === index ? event.target.value : item)),
                )
              }
            />
            <button
              type="button"
              aria-label={`Remove rule ${index + 1}`}
              onClick={() => setRules((current) => current.filter((_, p) => p !== index))}
              className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
        ))}
        {rules.length < COMMUNITY_RULES_MAX ? (
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => setRules((current) => [...current, ""])}
          >
            <Plus aria-hidden className="size-4" />
            Add a rule
          </Button>
        ) : null}
        <FieldError id={`${id}-rules-error`}>{errors.rules}</FieldError>
      </fieldset>

      <p className="text-body text-foreground-secondary">
        Communities are public: anyone signed in to dodoi can read and join.
      </p>
      <FieldError id={`${id}-form-error`}>{formError}</FieldError>
      <div className="flex flex-col gap-2 md:flex-row-reverse">
        <Button type="submit" disabled={isSending || !isVerified} className="md:min-w-48">
          {isSending ? "Starting…" : "Start community"}
        </Button>
      </div>
    </form>
  );
}
