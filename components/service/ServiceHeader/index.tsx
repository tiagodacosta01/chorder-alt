import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { ClientService, ServiceRef } from "@/prisma/models";
import { Calendar, ChevronLeft, ChevronRight, MicVocal, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import HolyricsSetlistButton from "./HolyricsSetlistButton";
import ServiceActionMenu from "./ServiceActionMenu";
import ServiceConfig from "./ServiceConfig";
import Skeleton from "./Skeleton";

type ServiceHeaderProps = {
  service: ClientService;
};

export default function ServiceHeader({ service }: ServiceHeaderProps) {
  const t = useTranslations();
  const serviceTitle = service?.title?.trim() || t("Service.noTitle");

  if (!service) {
    return <Skeleton />;
  }

  return (
    <Popover>
      <PageHeader
        backLinkHref="/services"
        backLinkText={t("Messages.services")}
        title={serviceTitle}
        subtitle={<Subtitle service={service} />}
        actions={
          <div className="flex gap-1 items-center">
            <ServiceNavButton dir="prev" serviceRef={service.prevService} />
            <ServiceNavButton dir="next" serviceRef={service.nextService} />
            <div className="w-px h-5 bg-border mx-1" />
            <HolyricsSetlistButton service={service} />
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon">
                <SlidersHorizontal />
                <span className="sr-only">{t("Messages.toggleConfig")}</span>
              </Button>
            </PopoverTrigger>
            <ServiceActionMenu service={service} />
          </div>
        }
      />

      <PopoverContent className="w-80" align="end">
        <ServiceConfig />
      </PopoverContent>
    </Popover>
  );
}

type ServiceNavButtonProps = {
  dir: "prev" | "next";
  serviceRef?: ServiceRef | null;
};

function ServiceNavButton({ dir, serviceRef }: ServiceNavButtonProps) {
  const formattedDate = useFormattedDate(serviceRef?.date ?? new Date());
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;

  if (!serviceRef) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Icon size={18} />
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/services/${serviceRef.slug}`}>
            <Icon size={18} />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="font-medium">{serviceRef.title || formattedDate}</p>
        {serviceRef.title && <p className="text-muted-foreground text-xs">{formattedDate}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

type SubtitleProps = { service: ClientService };
function Subtitle({ service }: SubtitleProps) {
  const formattedDate = useFormattedDate(service.date);
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4 leading-tight">
      <span className="flex items-center gap-1">
        <Calendar className="w-4 h-4" />
        {formattedDate}
      </span>
      {service.worshipLeader && (
        <span className="flex items-center gap-1">
          <MicVocal className="w-4 h-4" />
          <span className="hidden sm:block">{t("Service.ledBy")}</span>
          {service.worshipLeader}
        </span>
      )}
    </div>
  );
}
