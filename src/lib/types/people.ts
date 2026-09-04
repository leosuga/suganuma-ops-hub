export type PersonSide = "leo" | "parceira" | "comum" | "outro"
export type PersonCircle =
  | "familia_nuclear"
  | "familia_extensa"
  | "amigos"
  | "trabalho"
  | "vizinhos"
  | "outro"
export type RelationKind =
  | "conjuge"
  | "filho_de"
  | "pai_de"
  | "irmao_de"
  | "amigo_de"
  | "colega_de"
  | "ex_de"
export type InvitePolicy = "excluir_um" | "nao_juntos" | "ok_com_ressalva"
export type ConflictHandling = "avisar_antes" | "separar_no_evento"
export type VetoOwner = "eu" | "parceira" | "ambos"
export type ConflictStatus = "ativo" | "resolvido"
export type InviteStatus =
  | "cogitado"
  | "convidar"
  | "convidado"
  | "confirmado"
  | "recusou"
  | "vetado"

export interface PersonRow {
  id: string
  owner_id: string
  name: string
  nickname: string | null
  side: PersonSide
  circle: PersonCircle
  household: string | null
  phone: string | null
  email: string | null
  birthday: string | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface PersonInsert {
  id?: string
  owner_id: string
  name: string
  nickname?: string | null
  side?: PersonSide
  circle?: PersonCircle
  household?: string | null
  phone?: string | null
  email?: string | null
  birthday?: string | null
  notes?: string | null
  tags?: string[]
}

export interface PersonRelationRow {
  id: string
  owner_id: string
  from_person: string
  to_person: string
  kind: RelationKind
  note: string | null
  created_at: string
}

export interface PersonConflictRow {
  id: string
  owner_id: string
  subject_id: string
  object_id: string
  invite_policy: InvitePolicy
  excluded_person_id: string | null
  handling: ConflictHandling[]
  veto_owner: VetoOwner
  reason: string | null
  status: ConflictStatus
  created_at: string
  updated_at: string
}

export interface GuestEventRow {
  id: string
  owner_id: string
  name: string
  event_date: string | null
  location: string | null
  capacity: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface GuestInviteRow {
  id: string
  owner_id: string
  event_id: string
  person_id: string
  status: InviteStatus
  plus_ones: number
  decided_by: VetoOwner | null
  decision_note: string | null
  created_at: string
  updated_at: string
}
