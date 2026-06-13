import { describe, it, expect } from "vitest"
import { parseContextTags, addContextTag, removeContextTag, getContextKey } from "./contexts"

describe("parseContextTags", () => {
  it("returns empty array for null tags", () => {
    expect(parseContextTags(null)).toEqual([])
  })

  it("returns empty array when no context tags", () => {
    expect(parseContextTags(["work", "urgent"])).toEqual([])
  })

  it("extracts context keys from ctx/ tags", () => {
    expect(parseContextTags(["ctx/work", "ctx/casa"])).toEqual(["work", "casa"])
  })

  it("ignores unknown tags mixed with ctx tags", () => {
    expect(parseContextTags(["ctx/work", "finance", "ctx/saude"])).toEqual(["work", "saude"])
  })
})

describe("addContextTag", () => {
  it("adds context tag to empty array", () => {
    expect(addContextTag(null, "work")).toEqual(["ctx/work"])
  })

  it("replaces existing context tag", () => {
    expect(addContextTag(["ctx/casa"], "work")).toEqual(["ctx/work"])
  })

  it("keeps non-context tags when replacing", () => {
    expect(addContextTag(["ctx/casa", "urgent"], "work")).toEqual(["urgent", "ctx/work"])
  })
})

describe("removeContextTag", () => {
  it("removes context tag", () => {
    expect(removeContextTag(["ctx/work", "urgent"], "work")).toEqual(["urgent"])
  })

  it("returns empty array when tag not found", () => {
    expect(removeContextTag(["urgent"], "work")).toEqual(["urgent"])
  })
})

describe("getContextKey", () => {
  it("extracts key from ctx/ tag", () => {
    expect(getContextKey("ctx/work")).toBe("work")
  })

  it("returns key if it exists in config", () => {
    expect(getContextKey("work")).toBe("work")
  })

  it("returns null for unknown key", () => {
    expect(getContextKey("unknown")).toBeNull()
  })
})
