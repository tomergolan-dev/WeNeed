"use client";

import { createContext, useContext } from "react";

const MeContext = createContext<string | null>(null);

/** The signed-in user's id (the demo's "me" in the demo), for "added by you" and "mine". */
export const MeProvider = MeContext.Provider;

export function useMe() {
  return useContext(MeContext);
}
