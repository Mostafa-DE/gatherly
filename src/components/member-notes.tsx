import { useState, useCallback } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { StickyNote, Pencil, Trash2, Send, Sparkles } from "lucide-react"
import { useAISuggestMemberNote } from "@/plugins/ai/hooks/use-ai-suggestion"

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function MemberNotesSection({
  targetUserId,
}: {
  targetUserId: string
}) {
  const utils = trpc.useUtils()
  const { data: whoami } = trpc.user.whoami.useQuery()
  const currentUserId = whoami?.user?.id

  const { data: notes, isLoading } = trpc.memberNote.list.useQuery({ targetUserId })

  const [newContent, setNewContent] = useState("")
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const onAIComplete = useCallback((text: string) => {
    setNewContent(text)
  }, [])

  const {
    suggest: suggestNote,
    streamedText: aiStreamedText,
    isStreaming: aiIsStreaming,
    isPending: aiIsPending,
    error: aiError,
    isAvailable: aiAvailable,
  } = useAISuggestMemberNote({ onComplete: onAIComplete })

  const createNote = trpc.memberNote.create.useMutation({
    onSuccess: () => {
      utils.memberNote.list.invalidate({ targetUserId })
      setNewContent("")
    },
  })

  const updateNote = trpc.memberNote.update.useMutation({
    onSuccess: () => {
      utils.memberNote.list.invalidate({ targetUserId })
      setEditingNoteId(null)
      setEditContent("")
    },
  })

  const deleteNote = trpc.memberNote.delete.useMutation({
    onSuccess: () => {
      utils.memberNote.list.invalidate({ targetUserId })
      setConfirmDeleteId(null)
    },
  })

  const handleCreate = () => {
    const trimmed = newContent.trim()
    if (!trimmed) return
    createNote.mutate({ targetUserId, content: trimmed })
  }

  const handleUpdate = (noteId: string) => {
    const trimmed = editContent.trim()
    if (!trimmed) return
    updateNote.mutate({ noteId, content: trimmed })
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <StickyNote className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Admin Notes</h2>
          <p className="text-sm text-muted-foreground">
            Private notes visible to all admins
          </p>
        </div>
      </div>

      {/* Add note form */}
      <div className="mb-6">
        <textarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-white dark:bg-input/30 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="Add a note about this member..."
          value={aiIsStreaming ? aiStreamedText : newContent}
          onChange={(e) => setNewContent(e.target.value)}
          maxLength={2000}
          disabled={aiIsStreaming}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {newContent.length}/2000
          </span>
          <div className="flex items-center gap-2">
            {aiAvailable && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => suggestNote({ targetUserId })}
                disabled={aiIsPending}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                {aiIsPending ? "Generating..." : "Suggest"}
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!newContent.trim() || createNote.isPending}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {createNote.isPending ? "Adding..." : "Add Note"}
            </Button>
          </div>
        </div>
        {aiError && (
          <p className="mt-2 text-sm text-destructive">{aiError}</p>
        )}
        {createNote.error && (
          <p className="mt-2 text-sm text-destructive">{createNote.error.message}</p>
        )}
      </div>

      {/* Notes list */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-border/50 bg-background/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-1 h-4 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {notes && notes.length === 0 && (
        <div className="py-6 text-center">
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        </div>
      )}

      {notes && notes.length > 0 && (
        <div className="space-y-3">
          {notes.map(({ note, author }) => {
            const isAuthor = currentUserId === author.id
            const isEditing = editingNoteId === note.id
            const isDeleting = confirmDeleteId === note.id

            return (
              <div
                key={note.id}
                className="rounded-lg border border-border/50 bg-background/50 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={author.image ?? undefined} alt={author.name} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {author.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{author.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(new Date(note.createdAt))}
                    </span>
                  </div>
                  {isAuthor && !isEditing && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingNoteId(note.id)
                          setEditContent(note.content)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setConfirmDeleteId(note.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div>
                    <textarea
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-white dark:bg-input/30 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      maxLength={2000}
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleUpdate(note.id)}
                        disabled={!editContent.trim() || updateNote.isPending}
                      >
                        {updateNote.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingNoteId(null)
                          setEditContent("")
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                    {updateNote.error && (
                      <p className="mt-2 text-sm text-destructive">{updateNote.error.message}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                )}

                {isDeleting && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 p-3">
                    <p className="flex-1 text-sm text-destructive">Delete this note?</p>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteNote.mutate({ noteId: note.id })}
                      disabled={deleteNote.isPending}
                    >
                      {deleteNote.isPending ? "Deleting..." : "Delete"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
