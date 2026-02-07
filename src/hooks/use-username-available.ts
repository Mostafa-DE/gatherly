import { trpc } from "@/lib/trpc"
import { usernameSchema } from "@/schemas/user"

export function useUsernameAvailable(username: string) {
  const isValidFormat = username.length >= 3 && usernameSchema.safeParse(username).success

  const { data, isLoading } = trpc.user.checkUsernameAvailable.useQuery(
    { username },
    {
      enabled: isValidFormat,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    }
  )

  return {
    isAvailable: isValidFormat ? (data?.available ?? null) : null,
    isChecking: isValidFormat && isLoading,
    isValidFormat,
  }
}
