"""Helpers para TestClient com cookies HttpOnly."""


def mutation_headers(client) -> dict:
    return _cookie_headers(client, csrf=True)


def read_headers(client) -> dict:
    return _cookie_headers(client, csrf=False)


def _cookie_headers(client, *, csrf: bool) -> dict:
    headers: dict[str, str] = {}
    if csrf:
        headers["X-Requested-With"] = "XMLHttpRequest"
    parts = []
    token = client.cookies.get("access_token")
    refresh = client.cookies.get("refresh_token")
    if token:
        parts.append(f"access_token={token}")
    if refresh:
        parts.append(f"refresh_token={refresh}")
    if parts:
        headers["Cookie"] = "; ".join(parts)
    return headers
