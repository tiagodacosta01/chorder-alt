import Heading from "@/components/common/Heading";
import Main from "@/components/common/Main";
import { Card } from "@/components/ui/card";
import { BarChart3, LibraryBig, Radio, Tags } from "lucide-react";
import Link from "next/link";

const links = [
  {
    href: "/admin/catalogo",
    icon: LibraryBig,
    title: "Catálogo",
    description: "Gerenciar tags de todas as músicas do catálogo em um só lugar.",
  },
  {
    href: "/admin/tags",
    icon: Tags,
    title: "Tags",
    description: "Criar, editar e organizar os grupos de tags usados nas músicas.",
  },
  {
    href: "/admin/holyrics",
    icon: Radio,
    title: "Integração Holyrics",
    description: "Vincular músicas do catálogo a IDs do Holyrics e enviar setlists.",
  },
  {
    href: "/stats",
    icon: BarChart3,
    title: "Estatísticas",
    description: "Músicas mais tocadas e histórico de uso por líder de louvor.",
  },
];

export default function AdminPage() {
  return (
    <>
      <div className="px-5 sm:px-8 lg:px-14 pt-6 sm:pt-8 pb-4 sm:pb-6 lg:pb-8">
        <Heading level={1}>Administração</Heading>
      </div>
      <Main>
        <div className="max-w-2xl mx-auto py-8 px-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {links.map(({ href, icon: Icon, title, description }) => (
              <Link key={href} href={href}>
                <Card className="p-5 hover:border-secondary transition-colors h-full">
                  <div className="flex items-start gap-3">
                    <Icon size={22} className="text-secondary shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">{title}</div>
                      <p className="text-sm text-muted-foreground mt-1">{description}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </Main>
    </>
  );
}
