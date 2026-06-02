"use client";

import { useCreateOrUpdateService } from "#api-client";
import ConfirmDiscardDialog from "@/components/common/ConfirmDiscardDialog";
import FormFooter from "@/components/common/FormFooter";
import Text from "@/components/common/Text";
import ServiceMetaModal, { ServiceMeta } from "@/components/service/ServiceMetaModal";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ClientService } from "@/prisma/models";
import { ServiceSchema } from "@/schemas/service";
import { Calendar, MicVocal, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useFormState } from "react-hook-form";
import ServiceUnitListForm from "./ServiceUnitListForm";
import { initForm } from "./useServiceForm";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ServiceFormProps = {
  service: ClientService | null;
  defaultMeta?: ServiceMeta;
  onSaved?: (service: ClientService) => void;
};

export default function ServiceForm({ service, defaultMeta, onSaved }: ServiceFormProps) {
  const t = useTranslations("Messages");
  const router = useRouter();

  const initialService: ClientService | null = service ?? (defaultMeta ? {
    slug: "",
    title: defaultMeta.title,
    worshipLeader: defaultMeta.worshipLeader,
    date: defaultMeta.date,
    isDeleted: false,
    units: [],
  } : null);

  const form = useForm<ServiceSchema>(initForm(initialService));

  const { isDirty, isValid } = useFormState({ control: form.control });
  const watchedTitle = form.watch("title");
  const watchedDate = form.watch("date");
  const watchedLeader = form.watch("worshipLeader");

  const isNew = !service?.id;
  const viewUrl = service ? `/services/${service.slug}` : "/services";

  const [metaModalOpen, setMetaModalOpen] = useState(false);

  const { createOrUpdateService, isMutating } = useCreateOrUpdateService(service?.id ?? null);

  useEffect(() => {
    return () => {};
  }, []);

  async function onSubmit(data: ClientService) {
    const saved = await createOrUpdateService(data);
    if (onSaved) onSaved(saved);
  }

  function handleMetaSave(values: ServiceMeta) {
    form.setValue("title", values.title, { shouldDirty: true });
    form.setValue("date", values.date, { shouldDirty: true });
    form.setValue("worshipLeader", values.worshipLeader, { shouldDirty: true });
  }

  const formattedDate = watchedDate
    ? format(new Date(watchedDate), "d 'de' MMM. yyyy", { locale: ptBR })
    : "";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-dvh">

        {/* Header */}
        <button
          type="button"
          onClick={() => setMetaModalOpen(true)}
          className="shrink-0 text-left w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-5 bg-secondary/20 hover:bg-secondary/30 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0 mb-1">
            <Text variant="heading-lg" className="truncate">
              {watchedTitle || t("newService")}
            </Text>
            <Pencil className="w-4 h-4 shrink-0 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
            {formattedDate && (
              <Text variant="caption" className="flex items-center gap-1">
                <Calendar className="w-3 h-3 shrink-0" />
                {formattedDate}
              </Text>
            )}
            {watchedLeader && (
              <Text variant="caption" className="flex items-center gap-1 truncate">
                <MicVocal className="w-3 h-3 shrink-0" />
                {watchedLeader}
              </Text>
            )}
          </div>
        </button>

        {/* Conteúdo rolável */}
        <div className="flex-1 overflow-y-auto">
          <ServiceUnitListForm />
        </div>

        <FormFooter
          disabled={!isDirty || !isValid}
          loading={isMutating}
          label={t("saveService")}
          cancelButton={
            isDirty ? (
              <ConfirmDiscardDialog onDiscard={() => router.push(viewUrl)}>
                <Button type="button" variant="outline">{t("cancel")}</Button>
              </ConfirmDiscardDialog>
            ) : (
              <Button type="button" variant="outline" onClick={() => router.push(viewUrl)}>
                {t("cancel")}
              </Button>
            )
          }
        />

      </form>

      <ServiceMetaModal
        open={metaModalOpen}
        onOpenChange={setMetaModalOpen}
        isNew={isNew}
        defaultValues={{
          title: form.getValues("title") ?? "",
          date: form.getValues("date"),
          worshipLeader: form.getValues("worshipLeader"),
        }}
        onSave={handleMetaSave}
      />
    </Form>
  );
}
