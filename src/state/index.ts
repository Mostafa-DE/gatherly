import { atom } from "jotai"

// UI State atoms
export const sidebarOpenAtom = atom<boolean>(true)
export const mobileMenuOpenAtom = atom<boolean>(false)

// Loading state atom
export const globalLoadingAtom = atom<boolean>(false)
