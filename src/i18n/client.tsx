'use client';

import { createContext, useContext } from 'react';
import { makeT, type Lang, type T } from './core';

const LangContext = createContext<Lang>('bn');

/** Set once, in the root layout of each language; every client component below reads it. */
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = (): Lang => useContext(LangContext);
export const useT = (): T => makeT(useContext(LangContext));
