import type { Problem } from '@/types/task'

/**
 * A non-2xx response from the task API, carrying the server's problem details.
 *
 * Exists so callers can branch on `status` (a 404 is a normal outcome the UI
 * should explain; a 500 is not) instead of string-matching a generic `Error`.
 */
export class ApiError extends Error {
  readonly status: number
  readonly problem: Problem | null

  /**
   * @param status - the HTTP status code returned by the backend.
   * @param message - human-readable reason, taken from the problem detail when present.
   * @param problem - the parsed RFC 9457 body, or `null` when the body was not JSON.
   */
  constructor(status: number, message: string, problem: Problem | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

/**
 * Performs a JSON request against the backend and unwraps a typed body.
 *
 * Centralised so every operation gets the same failure translation: without it,
 * each call site would re-implement "was it ok, was there a body, what went
 * wrong" and they would drift apart.
 *
 * @param path - absolute API path, e.g. `/api/tasks`. Relative to the current
 *     origin, so the Vite dev proxy and production deploys share one code path.
 * @param init - standard `fetch` options; a JSON content type is added for bodies.
 * @returns the parsed response body, or `undefined` for a 204.
 * @throws {ApiError} when the backend answers with a non-2xx status.
 */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init.body === undefined ? init.headers : { 'Content-Type': 'application/json', ...init.headers },
  })

  if (!response.ok) {
    throw await toApiError(response)
  }

  // 204 carries no body; calling .json() on it would throw on valid success.
  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

/**
 * Converts a failed response into an {@link ApiError}.
 *
 * @param response - the non-2xx response.
 * @returns the error to throw, degrading to status text when the body is not JSON
 *     (proxies and gateways answer with HTML, and that must not mask the status).
 */
async function toApiError(response: Response): Promise<ApiError> {
  const problem = await readProblem(response)
  const message = problem?.detail ?? problem?.title ?? `${response.status} ${response.statusText}`.trim()
  return new ApiError(response.status, message, problem)
}

/**
 * Reads an RFC 9457 problem body, tolerating responses that have none.
 *
 * @param response - the failed response.
 * @returns the parsed problem, or `null` when the body is absent or not JSON.
 */
async function readProblem(response: Response): Promise<Problem | null> {
  try {
    return (await response.json()) as Problem
  } catch {
    return null
  }
}
