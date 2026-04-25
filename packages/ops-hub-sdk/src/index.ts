export * from "./types"

export class OpsHubClient {
  private headers: Record<string, string>

  constructor(
    private baseUrl: string,
    token: string
  ) {
    this.headers = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  }

  private async request<T>(method: string, path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) url.searchParams.set(k, v)
      }
    }
    const res = await fetch(url.toString(), {
      method,
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new OpsHubError(res.status, err.error ?? "Unknown error")
    }
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  tasks = {
    list: (params?: { status?: string; priority?: string; limit?: number }) =>
      this.request<{ tasks: import("./types").Task[] }>("GET", "/api/agent/tasks", undefined, {
        ...(params?.status && { status: params.status }),
        ...(params?.priority && { priority: params.priority }),
        ...(params?.limit && { limit: String(params.limit) }),
      }),

    create: (input: import("./types").CreateTaskInput) =>
      this.request<import("./types").Task>("POST", "/api/agent/tasks", input),

    update: (id: string, input: import("./types").UpdateTaskInput) =>
      this.request<import("./types").Task>("PATCH", `/api/agent/tasks/${id}`, input),

    complete: (id: string) =>
      this.request<import("./types").Task>("POST", `/api/agent/tasks/${id}/complete`),
  }

  finance = {
    summary: (month?: string) =>
      this.request<import("./types").FinanceSummary>(
        "GET",
        "/api/agent/finance/summary",
        undefined,
        month ? { month } : undefined
      ),

    createTransaction: (input: import("./types").CreateTransactionInput) =>
      this.request<import("./types").Transaction>("POST", "/api/agent/finance/transactions", input),
  }

  health = {
    log: (input: import("./types").CreateHealthLogInput) =>
      this.request<import("./types").HealthLog>("POST", "/api/agent/health/log", input),

    biometrics: (params?: { kind?: string; since?: string; limit?: number }) =>
      this.request<{ logs: import("./types").HealthLog[] }>("GET", "/api/agent/health/biometrics", undefined, {
        ...(params?.kind && { kind: params.kind }),
        ...(params?.since && { since: params.since }),
        ...(params?.limit && { limit: String(params.limit) }),
      }),

    createAppointment: (input: import("./types").CreateAppointmentInput) =>
      this.request<import("./types").Appointment>("POST", "/api/agent/health/appointments", input),
  }

  dashboard = {
    get: (month?: string) =>
      this.request<import("./types").DashboardSnapshot>(
        "GET",
        "/api/agent/dashboard",
        undefined,
        month ? { month } : undefined
      ),
  }
}

export class OpsHubError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = "OpsHubError"
  }
}
