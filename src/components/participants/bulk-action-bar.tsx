import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { CheckSquare, Square } from "lucide-react"
import type { AttendanceStatus, PaymentStatus } from "@/lib/sessions/state-machine"

type BulkActionBarProps = {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onDeselectAll: () => void
  attendanceAction: AttendanceStatus
  onAttendanceActionChange: (value: AttendanceStatus) => void
  paymentAction: PaymentStatus
  onPaymentActionChange: (value: PaymentStatus) => void
  onApplyAttendance: () => void
  onApplyPayment: () => void
  isApplyingAttendance: boolean
  isApplyingPayment: boolean
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  attendanceAction,
  onAttendanceActionChange,
  paymentAction,
  onPaymentActionChange,
  onApplyAttendance,
  onApplyPayment,
  isApplyingAttendance,
  isApplyingPayment,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-[var(--color-primary-highlight)] px-4 py-2.5">
      <span className="text-sm font-medium">
        {selectedCount} of {totalCount} selected
      </span>

      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={onSelectAll}>
          <CheckSquare className="mr-1 h-3.5 w-3.5" />
          All
        </Button>
        <Button variant="ghost" size="sm" onClick={onDeselectAll}>
          <Square className="mr-1 h-3.5 w-3.5" />
          None
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Attendance:</span>
        <Select
          value={attendanceAction}
          onValueChange={(v) => onAttendanceActionChange(v as AttendanceStatus)}
        >
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="show">Show</SelectItem>
            <SelectItem value="no_show">No Show</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={onApplyAttendance}
          disabled={isApplyingAttendance}
        >
          {isApplyingAttendance ? "..." : "Apply"}
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Payment:</span>
        <Select
          value={paymentAction}
          onValueChange={(v) => onPaymentActionChange(v as PaymentStatus)}
        >
          <SelectTrigger className="h-8 w-[100px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={onApplyPayment}
          disabled={isApplyingPayment}
        >
          {isApplyingPayment ? "..." : "Apply"}
        </Button>
      </div>
    </div>
  )
}
