import type { AttendanceStatus, PaymentStatus } from "@/lib/sessions/state-machine"

export type ParticipantData = {
  participation: {
    id: string
    status: string
    attendance: string
    payment: string
    notes: string | null
    formAnswers: unknown
    joinedAt: Date
  }
  user: {
    id: string
    name: string
    email: string
    image: string | null
    phoneNumber: string | null
  }
}

export type UpdateParticipationData = {
  participationId: string
  attendance?: AttendanceStatus
  payment?: PaymentStatus
  notes?: string | null
}

export type TargetSession = {
  id: string
  title: string
  status: string
}
