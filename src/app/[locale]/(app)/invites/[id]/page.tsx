import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Eye, ListChecks, Users } from "lucide-react";
import { z } from "zod";
import { Brand } from "@/components/brand";
import { Initial } from "@/components/people";
import { PlaceBadge } from "@/components/places/place-badge";
import { InviteAnswer } from "@/components/places/invite-answer";
import { requireUser } from "@/lib/auth";
import { countOpenItems, getInvite, getListMemberNames } from "@/lib/invites";
import { LIST_KINDS } from "@/lib/list-kinds";
import { cn } from "@/lib/utils";

export default function InvitePage({ params }: PageProps<"/[locale]/invites/[id]">) {
  return (
    <>
      <header className="px-5 pt-[18px]">
        <Brand />
      </header>
      <main className="flex flex-1 flex-col justify-center px-5 pt-6 pb-10">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" />}>
          <Invite params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Invite({ params }: Pick<PageProps<"/[locale]/invites/[id]">, "params">) {
  const { id } = await params;
  const [user, t] = await Promise.all([requireUser(), getTranslations("Invite")]);
  const invite = z.uuid().safeParse(id).success && user.email ? await getInvite(id, user.email) : null;

  if (!invite) {
    return (
      <div className="rounded-3xl border bg-card px-5 py-8 text-center shadow-soft">
        <p className="text-muted-foreground">{t("gone")}</p>
        <Link href="/" className="mt-4 inline-block font-semibold text-accent-foreground">
          {t("home")}
        </Link>
      </div>
    );
  }

  const from = invite.invitedByName ?? t("someone");
  const single = invite.lists?.length === 1 ? invite.lists[0] : null;
  const [open, names] = single
    ? await Promise.all([countOpenItems(single.id), getListMemberNames(single.id)])
    : [null, []];
  const where = invite.ownerName ? t("personalOf", { name: invite.ownerName }) : t("inPlace", { place: invite.placeName });

  const kind = single ? LIST_KINDS[single.type] : null;
  const KindIcon = kind?.icon;
  const facts: { icon: typeof Eye; text: string }[] = [];
  if (invite.lists === null) facts.push({ icon: Eye, text: t("wholePlace") });
  else if (!invite.ownerName) facts.push({ icon: Eye, text: invite.lists.length === 1 ? t("onlyThis") : t("onlyThese") });
  if (names.length > 0) facts.push({ icon: Users, text: t("already", { names: names.join(", ") }) });
  if (open !== null) facts.push({ icon: ListChecks, text: t("open", { count: open }) });

  return (
    <>
      <div className="rounded-3xl border bg-card px-5.5 pt-7 pb-5.5 text-center shadow-[0_1px_2px_rgba(20,20,20,.04),0_8px_20px_-10px_rgba(20,20,20,.13)]">
        <div className="mb-4.5 flex justify-center">
          <div className="relative">
            {kind && KindIcon ? (
              <span className={cn("flex size-19 items-center justify-center rounded-full", kind.tone)}>
                <KindIcon className="size-8.5" strokeWidth={1.8} aria-hidden />
              </span>
            ) : (
              <PlaceBadge icon="home" className="size-19 [&_svg]:size-8.5" />
            )}
            <Initial name={from} className="absolute -bottom-1 -end-1.5 size-8.5 border-3 border-card" />
          </div>
        </div>
        <p className="text-[15px] text-muted-foreground">
          {invite.lists === null
            ? t("toPlace", { name: from })
            : single
              ? t("toList", { name: from })
              : t("toLists", { name: from, count: invite.lists.length })}
        </p>
        <h1 className="mt-1 text-[26px] font-extrabold tracking-tight">
          {invite.lists === null ? invite.placeName : invite.lists.map((l) => l.name).join(", ")}
        </h1>
        {invite.lists !== null && <p className="mt-0.5 text-[15px] text-muted-foreground">{where}</p>}

        {facts.length > 0 && (
          <ul className="mt-5 text-start">
            {facts.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 border-t border-[#f0f2f1] py-2.5 text-[15px]">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        )}

        <InviteAnswer inviteId={invite.id} />
      </div>
      <p className="mx-2 mt-4 text-center text-[13px] leading-normal text-muted-foreground">
        {invite.ownerName ? t("afterPersonal") : t("after", { place: invite.placeName })}
      </p>
    </>
  );
}
