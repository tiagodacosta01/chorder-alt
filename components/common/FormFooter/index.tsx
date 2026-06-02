import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

type FormFooterProps = {
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  cancelButton?: React.ReactNode;
};

export default function FormFooter({ disabled = false, loading = false, label, cancelButton }: FormFooterProps) {
  const t = useTranslations("Messages");

  return (
    <div className="shrink-0 px-4 sm:px-6 lg:px-8 py-3 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
      <div className={`gap-2 sm:flex sm:justify-end ${cancelButton ? "grid grid-cols-2" : "flex justify-end"}`}>
        {cancelButton}
        <Button type="submit" disabled={disabled || loading} variant="secondary" className="sm:min-w-40">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (label ?? t("save"))}
        </Button>
      </div>
    </div>
  );
}
