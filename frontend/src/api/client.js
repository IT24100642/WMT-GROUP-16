export async function api(path, options = {}, token) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(path, { ...options, headers });
}

/** Multipart upload (do not set Content-Type — browser sets boundary). */
export async function apiUpload(path, formData, token) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(path, { method: "POST", body: formData, headers });
}

export async function parseJson(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: "Invalid response" };
  }
}
