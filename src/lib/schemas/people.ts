import { z } from "zod"

export const personSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  nickname: z.string().max(100).optional().nullable(),
  side: z.enum(["leo", "parceira", "comum", "outro"]).default("outro"),
  circle: z
    .enum([
      "familia_nuclear",
      "familia_extensa",
      "amigos",
      "trabalho",
      "vizinhos",
      "outro",
    ])
    .default("outro"),
  household: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  birthday: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string()).default([]),
})

export const personRelationSchema = z
  .object({
    id: z.string().uuid().optional(),
    from_person: z.string().uuid(),
    to_person: z.string().uuid(),
    kind: z.enum([
      "conjuge",
      "filho_de",
      "pai_de",
      "irmao_de",
      "amigo_de",
      "colega_de",
      "ex_de",
    ]),
    note: z.string().max(1000).optional().nullable(),
  })
  .refine((r) => r.from_person !== r.to_person, {
    message: "Uma pessoa não se relaciona consigo mesma",
    path: ["to_person"],
  })

export const personConflictSchema = z
  .object({
    id: z.string().uuid().optional(),
    subject_id: z.string().uuid(),
    object_id: z.string().uuid(),
    invite_policy: z.enum(["excluir_um", "nao_juntos", "ok_com_ressalva"]),
    excluded_person_id: z.string().uuid().optional().nullable(),
    handling: z.array(z.enum(["avisar_antes", "separar_no_evento"])).default([]),
    veto_owner: z.enum(["eu", "parceira", "ambos"]).default("eu"),
    reason: z.string().max(5000).optional().nullable(),
    status: z.enum(["ativo", "resolvido"]).default("ativo"),
  })
  .refine((c) => c.subject_id !== c.object_id, {
    message: "Um conflito precisa de duas pessoas diferentes",
    path: ["object_id"],
  })
  // Espelha person_conflict_excluir_um_needs_person no banco: a UI dá o erro
  // antes do round-trip, o banco garante que nada entra por outro caminho.
  .refine(
    (c) => c.invite_policy !== "excluir_um" || !!c.excluded_person_id,
    {
      message: "Escolha quem fica de fora",
      path: ["excluded_person_id"],
    },
  )
  // Espelha person_conflict_excluded_is_an_endpoint.
  .refine(
    (c) =>
      !c.excluded_person_id ||
      c.excluded_person_id === c.subject_id ||
      c.excluded_person_id === c.object_id,
    {
      message: "Quem fica de fora tem que ser uma das duas pessoas do conflito",
      path: ["excluded_person_id"],
    },
  )

export const guestEventSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  event_date: z.string().optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
})

export const guestInviteSchema = z.object({
  id: z.string().uuid().optional(),
  event_id: z.string().uuid(),
  person_id: z.string().uuid(),
  status: z
    .enum(["cogitado", "convidar", "convidado", "confirmado", "recusou", "vetado"])
    .default("cogitado"),
  plus_ones: z.number().int().min(0).default(0),
  decided_by: z.enum(["eu", "parceira", "ambos"]).optional().nullable(),
  decision_note: z.string().max(2000).optional().nullable(),
})

export type Person = z.infer<typeof personSchema>
export type PersonRelation = z.infer<typeof personRelationSchema>
export type PersonConflict = z.infer<typeof personConflictSchema>
export type GuestEvent = z.infer<typeof guestEventSchema>
export type GuestInvite = z.infer<typeof guestInviteSchema>
