import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

// UI State atoms
export const sidebarOpenAtom = atom<boolean>(true)
export const mobileMenuOpenAtom = atom<boolean>(false)

// Theme atom with localStorage persistence
export const themeAtom = atomWithStorage<"light" | "dark" | "system">(
  "theme",
  "system"
)

// Loading state atom
export const globalLoadingAtom = atom<boolean>(false)

// Derived atom example - computed theme based on system preference
export const resolvedThemeAtom = atom((get) => {
  const theme = get(themeAtom)
  if (theme === "system") {
    // This would need to be updated based on system preference
    return "light"
  }
  return theme
})
