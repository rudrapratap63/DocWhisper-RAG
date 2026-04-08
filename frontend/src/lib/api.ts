const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FetchOptions extends RequestInit {
  requiresAuth?: boolean;
}

export async function fetchApi<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { requiresAuth = true, headers: customHeaders, ...restOptions } = options;
  const headers = new Headers(customHeaders);
  
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (options.body && typeof window !== "undefined" && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  } else if (options.body && typeof window === "undefined" && !headers.has("Content-Type")) {
     // for ssr if needed
     headers.set("Content-Type", "application/json");
  }

  if (requiresAuth) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    } else if (typeof window !== "undefined" && window.location.pathname !== "/login" && window.location.pathname !== "/signup") {
      // Optional: Redirect to login if no token and requiresAuth? 
      // Better to handle auth state in a React Context
    }
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...restOptions,
    headers,
  });

  if (!response.ok) {
    let errorDetail = "An error occurred while fetching the data.";
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch {}
    throw new Error(errorDetail);
  }

  try {
    return await response.json() as T;
  } catch {
    return {} as T; // for 204 No Content
  }
}
