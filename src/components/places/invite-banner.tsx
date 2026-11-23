import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Mail } from "lucide-react";
import type { InviteView } from "@/lib/invites";

/** "New invite: Tomer invited you to the Shopping list", linking to the invite. */
export async function InviteBanner({ invite }: { invite: InviteView }) {
  const [t, tEmail] = await Promise.all([getTranslations("Home"), getTranslations("InviteEmail")]);
  const what =
    invite.lists === null
      ? tEmail("toPlace", { place: invite.placeName })
      : invite.lists.length === 1
        ? tEmail("toList", { list: invite.lists[0].name })
        : tEmail("toLists", { count: invite.lists.length });

  return (
    <Link
      href={`/invites/${invite.id}`}
      className="flex items-center gap-3 rounded-2xl bg-[#fff3d6] px-3.5 py-3 text-[#5c3d00] transition-colors active:bg-[#fbe9bd]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-[#8a5a00]">
        <Mail className="size-4.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-sm leading-snug">
        {t.rich("invite", {
          name: invite.invitedByName ?? "",
          what,
          b: (chunks) => <b className="font-bold">{chunks}</b>,
        })}
      </span>
      <span className="shrink-0 text-sm font-semibold">{t("inviteOpen")}</span>
    </Link>
  );
}
