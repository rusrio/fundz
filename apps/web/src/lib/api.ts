export const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {})
      }
    });
  } catch (error) {
    throw new Error(`Unable to reach API at ${apiBaseUrl}`);
  }

  const rawBody = await response.text();
  let body: unknown = null;

  if (rawBody.length > 0) {
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      throw new Error(`API returned a non-JSON response from ${apiBaseUrl}${path}`);
    }
  }

  if (!response.ok) {
    const errorMessage =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : `API returned ${response.status}`;
    throw new Error(errorMessage);
  }

  return body as T;
}
