import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2, GripVertical } from "lucide-react"
import { getDomain } from "@/plugins/ranking/domains"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

type RankingSetupFormProps = {
  activityId: string
  activityName: string
}

type LevelDraft = {
  key: string
  name: string
  color: string
  order: number
}

let levelKeyCounter = 0

function createLevelDraft(name: string, order: number, color?: string): LevelDraft {
  return {
    key: `new-${++levelKeyCounter}`,
    name,
    color: color ?? "",
    order,
  }
}

function getLevelsForDomain(domainId: string): LevelDraft[] {
  const domain = getDomain(domainId)
  if (!domain?.defaultLevels?.length) return []
  return domain.defaultLevels.map((l, i) => createLevelDraft(l.name, i, l.color))
}

export function RankingSetupForm({
  activityId,
  activityName,
}: RankingSetupFormProps) {
  const utils = trpc.useUtils()

  const { data: domains } = trpc.plugin.ranking.listDomains.useQuery()

  const [name, setName] = useState("")
  const [domainId, setDomainId] = useState("")
  const [levels, setLevels] = useState<LevelDraft[]>([])
  const [error, setError] = useState("")

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const createMutation = trpc.plugin.ranking.create.useMutation({
    onSuccess: () => {
      utils.plugin.ranking.getByActivity.invalidate({ activityId })
    },
    onError: (err) => setError(err.message),
  })

  function addLevel() {
    setLevels((prev) => [
      ...prev,
      createLevelDraft("", prev.length),
    ])
  }

  function removeLevel(key: string) {
    setLevels((prev) => {
      const filtered = prev.filter((l) => l.key !== key)
      return filtered.map((l, i) => ({ ...l, order: i }))
    })
  }

  function updateLevel(key: string, field: "name" | "color", value: string) {
    setLevels((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [field]: value } : l))
    )
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setLevels((prev) => {
      const oldIndex = prev.findIndex((l) => l.key === active.id)
      const newIndex = prev.findIndex((l) => l.key === over.id)
      const reordered = arrayMove(prev, oldIndex, newIndex)
      return reordered.map((l, i) => ({ ...l, order: i }))
    })
  }

  function handleSubmit() {
    setError("")
    if (!name.trim()) {
      setError("Name is required")
      return
    }
    if (!domainId) {
      setError("Please select a domain")
      return
    }
    if (levels.length > 0) {
      const emptyLevel = levels.find((l) => !l.name.trim())
      if (emptyLevel) {
        setError("All levels must have a name")
        return
      }
    }

    createMutation.mutate({
      activityId,
      name: name.trim(),
      domainId,
      levels: levels.map((l) => ({
        name: l.name.trim(),
        color: l.color || null,
        order: l.order,
      })),
    })
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="ranking-name">Ranking Name</Label>
        <Input
          id="ranking-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`e.g. ${activityName} Rankings`}
          className="bg-popover"
        />
      </div>

      <div className="space-y-2">
        <Label>Domain</Label>
        <Select value={domainId} onValueChange={(val) => {
          setDomainId(val)
          setLevels(getLevelsForDomain(val))
          if (!name.trim()) {
            setName(`${activityName} Ranking`)
          }
        }}>
          <SelectTrigger className="bg-popover">
            <SelectValue placeholder="Select a domain..." />
          </SelectTrigger>
          <SelectContent>
            {domains?.map((domain) => (
              <SelectItem key={domain.id} value={domain.id}>
                {domain.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {domainId && domains && (
          <p className="text-xs text-muted-foreground">
            Stats:{" "}
            {domains
              .find((d) => d.id === domainId)
              ?.statFields.map((f) => f.label)
              .join(", ")}
          </p>
        )}
      </div>

      {domainId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Levels (lowest to highest)</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addLevel}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
          {levels.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No levels configured. Click &quot;Add&quot; to create skill tiers.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={levels.map((l) => l.key)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {levels.map((level, i) => (
                    <SortableLevelRow
                      key={level.key}
                      level={level}
                      index={i}
                      onUpdate={updateLevel}
                      onRemove={removeLevel}
                      disableRemove={false}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      <div className="border-t border-border/50 pt-4">
        <Button
          onClick={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? "Creating..." : "Create Rankings"}
        </Button>
      </div>
    </div>
  )
}

function SortableLevelRow({
  level,
  index,
  onUpdate,
  onRemove,
  disableRemove,
}: {
  level: LevelDraft
  index: number
  onUpdate: (key: string, field: "name" | "color", value: string) => void
  onRemove: (key: string) => void
  disableRemove: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: level.key })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2"
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none shrink-0 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        type="button"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-xs text-muted-foreground w-5 shrink-0 text-center">
        {index + 1}
      </span>
      <Input
        value={level.name}
        onChange={(e) => onUpdate(level.key, "name", e.target.value)}
        placeholder="Level name"
        className="h-8 bg-popover"
      />
      <Input
        type="color"
        value={level.color || "#6B7280"}
        onChange={(e) => onUpdate(level.key, "color", e.target.value)}
        className="h-8 w-12 p-0.5 shrink-0 cursor-pointer"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onRemove(level.key)}
        disabled={disableRemove}
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  )
}
