"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Brand } from "@/components/brand";
import { LanguageSwitch } from "@/components/language-switch";
import { ListCard } from "@/components/lists/list-card";
import { NewListButton } from "@/components/lists/new-list-button";
import { PlaceBadge } from "@/components/places/place-badge";
import { Link } from "@/i18n/navigation";
import { summarizeLists, useDemo } from "./demo-store";

/** The demo's home screen: the sample place and its lists. */
export function DemoHome() {
  const t = useTranslations("Home");
  const tNav = useTranslations("Nav");
  const tDemo = useTranslations("Demo");
  const { state } = useDemo();

  // Due-soon counts as of opening the screen.
  const [now] = useState(() => Date.now());
  const lists = summarizeLists(state, now);
  const attention = lists.reduce((sum, list) => sum + list.overdue + list.soon, 0);

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between bg-background px-5 pt-[18px] pb-2 lg:static lg:px-8 lg:pt-6">
        <span className="lg:invisible">
          <Brand />
        </span>
        <div className="flex items-center gap-2">
          <LanguageSwitch className="lg:hidden" />
          <Link
            href="/login"
            className="flex h-11 items-center rounded-[14px] bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
          >
            {tDemo("signIn")}
          </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col px-5 pt-3 pb-8 lg:px-8">
        <div className="flex items-center gap-3 rounded-[18px] border bg-card px-3.5 py-3 shadow-soft">
          <PlaceBadge icon="home" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs text-muted-foreground">{tNav("yourPlace")}</span>
            <span className="truncate text-[17px] font-bold">{state.place}</span>
          </span>
        </div>
        <div className="pt-6 pb-1">
          <h1 className="text-[26px] font-extrabold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("count", { count: lists.length })}
            {attention > 0 && ` · ${t("attention", { count: attention })}`}
          </p>
        </div>
        <div className="flex items-center justify-between px-1 pt-4 pb-2.5">
          <h2 className="text-[13px] font-semibold text-muted-foreground">{t("lists")}</h2>
          <NewListButton />
        </div>
        {lists.length === 0 ? (
          <p className="rounded-[18px] border border-dashed border-[#c3cbc7] px-4 py-6 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <ul className="grid gap-2.5 lg:grid-cols-2">
            {lists.map((list) => (
              <li key={list.id}>
                <ListCard list={list} personal={false} href={`/demo/lists/${list.id}`} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">{tDemo("aiNote")}</p>
      </main>
    </>
  );
}
