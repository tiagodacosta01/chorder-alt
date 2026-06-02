import { useCreateOrUpdateArrangement } from "#api-client";
import ConfirmDiscardDialog from "@/components/common/ConfirmDiscardDialog";
import FormFooter from "@/components/common/FormFooter";
import Text from "@/components/common/Text";
import SongMetaModal, { SongMeta } from "@/components/song/SongMetaModal";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ClientArrangement } from "@/prisma/models";
import { ArrangementSchema } from "@/schemas/arrangement";
import { autoScrollWindowForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { NotebookPen, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import ArrangementInfoForm from "./ArrangementInfoForm";
import SongUnitListForm from "./SongUnitListForm";
import { initForm } from "./useArrangementForm";

type ArrangementFormProps = {
  arrangement: ClientArrangement | null;
  defaultMeta?: SongMeta;
  onSaved?: (arrangement: ClientArrangement) => void;
};

export default function ArrangementForm({
  arrangement: origArrangement,
  defaultMeta,
  onSaved,
}: ArrangementFormProps) {
  const t = useTranslations("Messages");

  const initialArrangement: ClientArrangement | null = origArrangement ?? (defaultMeta ? {
    key: "C",
    name: null,
    isDefault: true,
    isDeleted: false,
    isServiceArrangement: false,
    originalArrangementId: null,
    youtubeUrl: null,
    audioUrl: null,
    song: {
      title: defaultMeta.title,
      artist: defaultMeta.artist,
      slug: "",
      lyrics: "",
      isDeleted: false,
    },
  } as ClientArrangement : null);

  const form = useForm<ArrangementSchema>(initForm(initialArrangement));
  const { isDirty, isValid } = form.formState;

  const searchParams = useSearchParams().toString();
  const pathname = usePathname().replace("/edit", "");
  const cancelUrl = `${pathname}${searchParams ? `?${searchParams}` : ""}`;

  const isNew = !origArrangement?.id;
  const closeUrl = isNew ? "/songs" : cancelUrl;

  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const watchedTitle = form.watch("song.title");
  const watchedArtist = form.watch("song.artist");
  const { createOrUpdateArrangement, isMutating } = useCreateOrUpdateArrangement(origArrangement?.id);

  useEffect(() => {
    return autoScrollWindowForElements();
  }, []);

  async function onSubmit(arrangement: ArrangementSchema) {
    const newOrUpdatedArrangement = await createOrUpdateArrangement(arrangement);
    if (onSaved) onSaved(newOrUpdatedArrangement);
  }

  function handleMetaSave({ title, artist }: SongMeta) {
    form.setValue("song.title", title, { shouldDirty: true });
    form.setValue("song.artist", artist ?? "", { shouldDirty: true });
  }

  const closeButton = isDirty ? (
    <ConfirmDiscardDialog onDiscard={() => window.location.href = closeUrl}>
      <Button type="button" variant="outline" className="shrink-0">
        {t("cancel")}
      </Button>
    </ConfirmDiscardDialog>
  ) : (
    <Button type="button" variant="outline" className="shrink-0" asChild>
      <Link href={closeUrl}>{t("cancel")}</Link>
    </Button>
  );

  const isSaveDisabled = isNew ? !isValid : !isDirty || !isValid;

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-dvh">

          {/* Header */}
          <button
            type="button"
            onClick={() => setMetaModalOpen(true)}
            className="shrink-0 text-left w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-5 bg-secondary/20 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Text variant="heading-lg" className="truncate">
                {watchedTitle || t("newSong")}
              </Text>
              <Pencil className="w-4 h-4 shrink-0 text-muted-foreground" />
            </div>
            {watchedArtist && (
              <Text variant="caption" className="flex items-center gap-1 truncate">
                <NotebookPen className="w-3 h-3 shrink-0" />
                {watchedArtist}
              </Text>
            )}
          </button>

          {/* Conteúdo rolável */}
          <div className="flex-1 overflow-y-auto">
            <ArrangementInfoForm arrangementId={origArrangement?.id} />
            <SongUnitListForm />
          </div>

          <FormFooter
            disabled={isSaveDisabled}
            loading={isMutating}
            label={t("saveSong")}
            cancelButton={closeButton}
          />

        </form>
      </Form>

      <SongMetaModal
        open={metaModalOpen}
        onOpenChange={setMetaModalOpen}
        defaultValues={{ title: watchedTitle ?? "", artist: watchedArtist ?? null }}
        onSave={handleMetaSave}
      />
    </>
  );
}
