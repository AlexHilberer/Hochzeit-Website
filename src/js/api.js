export async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const isJson = response.headers.get('Content-Type')?.includes('application/json');
  const data = isJson ? await response.json() : null;
  return { status: response.status, ok: response.ok, data };
}

export function errorText(result) {
  return result.data?.error ?? 'Etwas ist schiefgelaufen. Bitte versucht es später noch einmal.';
}
