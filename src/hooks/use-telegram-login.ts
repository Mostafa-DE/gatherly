import { useRef, useCallback } from "react"
import type { TelegramWidgetAuthInput } from "@/plugins/assistant/schemas"

type TelegramLoginOptions = {
  botUsername: string
  onAuth: (user: TelegramWidgetAuthInput) => void
  buttonSize?: "large" | "medium" | "small"
  cornerRadius?: number
}

let callbackCounter = 0

function clearChildren(el: HTMLElement) {
  while (el.firstChild) {
    el.removeChild(el.firstChild)
  }
}

export function useTelegramLogin({
  botUsername,
  onAuth,
  buttonSize = "large",
  cornerRadius,
}: TelegramLoginOptions) {
  const onAuthRef = useRef(onAuth)
  onAuthRef.current = onAuth

  // Callback ref — fires when the DOM node mounts (or unmounts with null).
  // This avoids the timing bug where useEffect + useRef misses the node
  // because it's hidden behind a conditional render (skeleton).
  const callbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return

      clearChildren(node)

      const callbackName = `__telegramLoginCallback_${++callbackCounter}`
      ;(window as unknown as Record<string, unknown>)[callbackName] = (
        user: TelegramWidgetAuthInput
      ) => {
        onAuthRef.current(user)
      }

      const script = document.createElement("script")
      script.src = "https://telegram.org/js/telegram-widget.js?22"
      script.async = true
      script.setAttribute("data-telegram-login", botUsername)
      script.setAttribute("data-size", buttonSize)
      script.setAttribute("data-onauth", `${callbackName}(user)`)
      script.setAttribute("data-request-access", "write")
      if (cornerRadius !== undefined) {
        script.setAttribute("data-radius", String(cornerRadius))
      }

      node.appendChild(script)
    },
    [botUsername, buttonSize, cornerRadius]
  )

  return { ref: callbackRef }
}
