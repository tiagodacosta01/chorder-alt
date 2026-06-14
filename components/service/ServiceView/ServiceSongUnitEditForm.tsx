"use client";

import { useCreateOrUpdateArrangement } from "#api-client";
import { defaultArrangementValues } from "@/components/song/ArrangementForm/useArrangementForm";
import SongUnitListForm from "@/components/song/ArrangementForm/SongUnitListForm";
import { Form } from "@/components/ui/form";
import { ClientArrangement, ClientServiceUnit } from "@/prisma/models";
import { ArrangementSchema, arrangementSchema } from "@/schemas/arrangement";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useSWRConfig } from "swr";

export type EditFormHandle = {
  submit: (scope: "service" | "both") => void;
};

type ServiceSongUnitEditFormProps = {
  unit: ClientServiceUnit;
  submitRef: MutableRefObject<EditFormHandle | null>;
  onSavingChange: (saving: boolean) => void;
  onSaved: () => void;
};

export default function ServiceSongUnitEditForm({
  unit,
  submitRef,
  onSavingChange,
  onSaved,
}: ServiceSongUnitEditFormProps) {
  const t = useTranslations("ServiceView");

  const arrangement = unit.arrangement!;

  const form = useForm<ArrangementSchema>({
    resolver: zodResolver(arrangementSchema),
    defaultValues: {
      ...defaultArrangementValues(arrangement),
      units: arrangement.units ?? [],
    },
  });

  const { mutate } = useSWRConfig();
  const [saveError, setSaveError] = useState<string | null>(null);

  const { createOrUpdateArrangement: saveToService, isMutating: savingService } =
    useCreateOrUpdateArrangement(arrangement.id);
  const { createOrUpdateArrangement: saveToOriginal, isMutating: savingOriginal } =
    useCreateOrUpdateArrangement(arrangement.originalArrangementId ?? null);

  const isSaving = savingService || savingOriginal;

  const onSavingChangeRef = useRef(onSavingChange);
  onSavingChangeRef.current = onSavingChange;

  useEffect(() => {
    onSavingChangeRef.current(isSaving);
  }, [isSaving]);

  function buildServicePayload(data: ArrangementSchema): ClientArrangement {
    return {
      ...defaultArrangementValues(arrangement),
      ...data,
      id: arrangement.id,
      isServiceArrangement: true,
      song: arrangement.song,
    } as ClientArrangement;
  }

  function buildOriginalPayload(data: ArrangementSchema): ClientArrangement {
    return {
      ...defaultArrangementValues(arrangement),
      ...data,
      id: arrangement.originalArrangementId!,
      isServiceArrangement: false,
      originalArrangementId: null,
      song: arrangement.song,
    } as ClientArrangement;
  }

  async function performSave(data: ArrangementSchema, scope: "service" | "both") {
    setSaveError(null);
    try {
      if (scope === "both") {
        await Promise.all([
          saveToService(buildServicePayload(data)),
          saveToOriginal(buildOriginalPayload(data)),
        ]);
      } else {
        await saveToService(buildServicePayload(data));
      }
      mutate((key) => typeof key === "string" && key.startsWith("/api/services"));
      onSaved();
    } catch {
      setSaveError(t("saveError"));
    }
  }

  useEffect(() => {
    submitRef.current = {
      submit: (scope: "service" | "both") => form.handleSubmit((data) => performSave(data, scope))(),
    };
  });

  return (
    <Form {...form}>
      <SongUnitListForm fieldPrefix="" sectionClassName="" toolbarClassName="" />
      {saveError && (
        <p className="text-sm text-red-500 text-right py-2 px-2">{saveError}</p>
      )}
    </Form>
  );
}
