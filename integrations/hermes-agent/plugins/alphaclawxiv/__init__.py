"""AlphaClawXiv Hermes plugin.

Native Hermes Agent plugin that exposes the live hosted AlphaXiv MCP surface.
It includes a local Clerk/OAuth login flow similar to the OpenClaw plugin, so
Hermes users do not need to paste a bearer header manually.
"""

from __future__ import annotations

import base64
import hashlib
import http.server
import json
import os
import secrets
import socketserver
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, Optional


DEFAULT_MCP_URL = "https://api.alphaxiv.org/mcp/v1"
DEFAULT_SCOPES = "openid profile email offline_access"
ENV_NAME = "ALPHAXIV_AUTH_HEADER"
TOKEN_ACCESS_FIELD = "access" + "Token"
TOKEN_REFRESH_FIELD = "refresh" + "Token"


DISCOVER_PAPERS_SCHEMA = {
    "name": "discover_papers",
    "description": "Discover and rank papers for a topic using keywords, a semantic question, and retrieval difficulty.",
    "parameters": {
        "type": "object",
        "properties": {
            "keywords": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Three or four concise keywords for exact matching.",
            },
            "question": {
                "type": "string",
                "description": "Detailed semantic description of the papers you want.",
            },
            "difficulty": {
                "type": "number",
                "minimum": 1,
                "maximum": 10,
                "description": "Retrieval effort estimate. Higher values perform broader search.",
            },
        },
        "required": ["keywords", "question", "difficulty"],
    },
}

GET_PAPER_CONTENT_SCHEMA = {
    "name": "get_paper_content",
    "description": "Get AlphaXiv, arXiv, or paper content as an intermediate report or raw extracted text.",
    "parameters": {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "AlphaXiv, arXiv, or paper URL.",
            },
            "fullText": {
                "type": "boolean",
                "description": "If true, return raw extracted text instead of the intermediate report.",
                "default": False,
            },
        },
        "required": ["url"],
    },
}

ANSWER_PDF_QUERIES_SCHEMA = {
    "name": "answer_pdf_queries",
    "description": "Return raw filtered PDF page content relevant to one or more questions.",
    "parameters": {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "PDF or paper URL.",
            },
            "queries": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Questions to answer about the paper.",
            },
        },
        "required": ["url", "queries"],
    },
}

READ_GITHUB_SCHEMA = {
    "name": "read_files_from_github_repository",
    "description": "Read files or directories from a paper implementation repository on GitHub.",
    "parameters": {
        "type": "object",
        "properties": {
            "githubUrl": {
                "type": "string",
                "description": "GitHub repository URL.",
            },
            "path": {
                "type": "string",
                "description": "File or directory path inside the repository.",
            },
        },
        "required": ["githubUrl", "path"],
    },
}


def _error(message: str) -> str:
    return json.dumps({"error": message})


def _hermes_home() -> Path:
    return Path.home() / ".hermes"


def _plugin_state_dir() -> Path:
    return _hermes_home() / "alphaxiv"


def _token_store_path() -> Path:
    return _plugin_state_dir() / "oauth.json"


def _hermes_env_path() -> Path:
    return _hermes_home() / ".env"


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _read_json(path: Path, fallback: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def _write_json(path: Path, value: Dict[str, Any]) -> None:
    _ensure_dir(path.parent)
    path.write_text(f"{json.dumps(value, indent=2)}\n", encoding="utf-8")


def _quote_env_value(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _update_env_header(access_token: str) -> None:
    _ensure_dir(_hermes_home())
    env_path = _hermes_env_path()
    header_value = f"Bearer {access_token}"
    line = f"{ENV_NAME}={_quote_env_value(header_value)}"
    existing = env_path.read_text(encoding="utf-8") if env_path.exists() else ""
    lines = existing.splitlines()
    replaced = False
    next_lines = []
    for current in lines:
        if current.strip().startswith(f"{ENV_NAME}="):
            next_lines.append(line)
            replaced = True
        else:
            next_lines.append(current)
    if not replaced:
        next_lines.append(line)
    env_path.write_text("\n".join(next_lines).rstrip() + "\n", encoding="utf-8")


def _remove_env_header() -> None:
    env_path = _hermes_env_path()
    if not env_path.exists():
        return
    next_lines = [
        line for line in env_path.read_text(encoding="utf-8").splitlines()
        if not line.strip().startswith(f"{ENV_NAME}=")
    ]
    env_path.write_text("\n".join(next_lines).rstrip() + ("\n" if next_lines else ""), encoding="utf-8")


def _normalize_expires_at(token: Optional[Dict[str, Any]]) -> Optional[int]:
    if not token:
        return None
    raw = token.get("expiresAt")
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return int(raw * 1000) if raw < 10_000_000_000 else int(raw)
    try:
        return int(time.mktime(time.strptime(raw[:19], "%Y-%m-%dT%H:%M:%S")) * 1000)
    except Exception:
        try:
            from datetime import datetime
            return int(datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp() * 1000)
        except Exception:
            return None


def _redact_token_info(token: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not token:
        return {"available": False}
    expires_at = _normalize_expires_at(token)
    return {
        "available": bool(token.get(TOKEN_ACCESS_FIELD)),
        "expiresAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(expires_at / 1000)) if expires_at else None,
        "source": token.get("source"),
        "mcpUrl": token.get("mcpUrl") or DEFAULT_MCP_URL,
    }


def _save_token(token: Dict[str, Any], mcp_url: str) -> Dict[str, Any]:
    access_token = token.get("access_token") or token.get(TOKEN_ACCESS_FIELD)
    if not access_token:
        raise RuntimeError("No access token was found in the OAuth response.")
    expires_in = token.get("expires_in")
    if expires_in is not None:
        expires_at = int((time.time() + float(expires_in)) * 1000)
    else:
        expires_at = token.get("expiresAt")
    stored = {
        TOKEN_ACCESS_FIELD: access_token,
        TOKEN_REFRESH_FIELD: token.get("refresh_token") or token.get(TOKEN_REFRESH_FIELD),
        "tokenType": token.get("token_type") or token.get("tokenType") or "Bearer",
        "expiresAt": expires_at,
        "scope": token.get("scope"),
        "source": "native-oauth",
        "mcpUrl": mcp_url,
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    _write_json(_token_store_path(), stored)
    _update_env_header(access_token)
    return stored


def _load_stored_token() -> Optional[Dict[str, Any]]:
    return _read_json(_token_store_path(), None)


def _read_stored_access_token() -> str:
    token = _load_stored_token()
    if token and token.get(TOKEN_ACCESS_FIELD):
        expires_at = _normalize_expires_at(token)
        if expires_at and expires_at <= int((time.time() + 60) * 1000):
            raise RuntimeError("AlphaXiv token is expired or about to expire. Run `hermes alphaclawxiv auth login` again.")
        return str(token[TOKEN_ACCESS_FIELD])
    env_value = os.getenv(ENV_NAME, "").strip()
    if env_value:
        return env_value[7:].strip() if env_value.lower().startswith("bearer ") else env_value
    raise RuntimeError("AlphaXiv is not authenticated. Run `hermes alphaclawxiv auth login` first.")


def _status_payload() -> Dict[str, Any]:
    token = _load_stored_token()
    info = _redact_token_info(token)
    has_env = _hermes_env_path().exists() and any(
        line.strip().startswith(f"{ENV_NAME}=")
        for line in _hermes_env_path().read_text(encoding="utf-8").splitlines()
    )
    return {
        "token": info,
        "pluginConfigured": True,
        "hermesEnvConfigured": has_env,
        "mcpUrl": token.get("mcpUrl") if token else _mcp_url(),
    }


def _logout() -> None:
    token_path = _token_store_path()
    if token_path.exists():
        token_path.unlink()
    _remove_env_header()


def _mcp_url() -> str:
    token = _load_stored_token()
    if token and token.get("mcpUrl"):
        return str(token["mcpUrl"])
    return os.getenv("ALPHAXIV_MCP_URL", DEFAULT_MCP_URL).strip() or DEFAULT_MCP_URL


def _auth_header() -> str:
    return f"Bearer {_read_stored_access_token()}"


def _parse_mcp_response(text: str) -> Dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("event:") or "\ndata:" in stripped:
        messages = []
        for block in stripped.split("\n\n"):
            payload = []
            for line in block.splitlines():
                if line.startswith("data:"):
                    payload.append(line[5:].lstrip())
            joined = "\n".join(payload).strip()
            if not joined or joined == "[DONE]":
                continue
            messages.append(json.loads(joined))
        if not messages:
            raise RuntimeError("AlphaXiv MCP returned an empty event stream.")
        for message in messages:
            if message.get("error") or message.get("result"):
                return message
        return messages[-1]
    return json.loads(stripped)


def _fetch_json(url: str, *, method: str = "GET", headers: Optional[Dict[str, str]] = None, body: Optional[bytes] = None) -> Dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0",
            **(headers or {}),
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        body_text = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{url} returned HTTP {exc.code}: {body_text[:300]}") from exc
    try:
        return json.loads(payload)
    except Exception as exc:
        raise RuntimeError(f"{url} did not return valid JSON.") from exc


def _origin_from_url(raw_url: str) -> str:
    parsed = urllib.parse.urlparse(raw_url)
    return f"{parsed.scheme}://{parsed.netloc}"


def _discover_oauth(mcp_url: str) -> Dict[str, Any]:
    resource = _origin_from_url(mcp_url)
    protected_resource = _fetch_json(urllib.parse.urljoin(resource, "/.well-known/oauth-protected-resource"))
    authorization_server = (
        (protected_resource.get("authorization_servers") or [None])[0]
        or protected_resource.get("authorization_server")
    )
    if not authorization_server:
        raise RuntimeError("AlphaXiv protected resource metadata did not include an authorization server.")
    authorization_metadata = _fetch_json(
        urllib.parse.urljoin(authorization_server, "/.well-known/oauth-authorization-server")
    )
    for key in ("authorization_endpoint", "token_endpoint", "registration_endpoint"):
        if not authorization_metadata.get(key):
            raise RuntimeError(f"Authorization server metadata is missing {key}.")
    return {
        "resource": protected_resource.get("resource") or resource,
        "authorizationMetadata": authorization_metadata,
    }


def _register_oauth_client(metadata: Dict[str, Any], redirect_uri: str) -> Dict[str, Any]:
    body = json.dumps(
        {
            "client_name": "Hermes AlphaXiv OAuth",
            "redirect_uris": [redirect_uri],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none",
            "scope": DEFAULT_SCOPES,
        }
    ).encode("utf-8")
    client = _fetch_json(
        metadata["authorizationMetadata"]["registration_endpoint"],
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Origin": metadata["resource"],
            "Referer": f"{metadata['resource']}/",
        },
        body=body,
    )
    if not client.get("client_id"):
        raise RuntimeError("OAuth registration did not return a client_id.")
    return client


def _base64url_sha256(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


class _CallbackServer(socketserver.TCPServer):
    allow_reuse_address = True


def _wait_for_callback(expected_state: str, timeout_seconds: int = 300) -> str:
    result: Dict[str, Optional[str]] = {"code": None, "error": None}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path != "/callback":
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"Not found")
                return
            params = urllib.parse.parse_qs(parsed.query)
            error = params.get("error", [None])[0]
            code = params.get("code", [None])[0]
            state = params.get("state", [None])[0]
            if error:
                result["error"] = f"AlphaXiv OAuth failed: {error}"
                self.send_response(400)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"AlphaXiv OAuth failed. You can close this tab.")
                return
            if not code or state != expected_state:
                result["error"] = "Invalid AlphaXiv OAuth callback state."
                self.send_response(400)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"Invalid AlphaXiv OAuth callback. You can close this tab.")
                return
            result["code"] = code
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(
                b"<!doctype html><title>AlphaXiv OAuth</title><h1>AlphaXiv OAuth complete</h1><p>You can close this tab and return to Hermes.</p>"
            )

        def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
            del format, args

    with _CallbackServer(("127.0.0.1", 0), Handler) as server:
        server.timeout = 0.5
        port = int(server.server_address[1])
        deadline = time.time() + timeout_seconds
        while time.time() < deadline and not result["code"] and not result["error"]:
            server.handle_request()
        if result["error"]:
            raise RuntimeError(result["error"])
        if not result["code"]:
            raise RuntimeError("Timed out waiting for AlphaXiv OAuth callback.")
        return f"http://127.0.0.1:{port}/callback", result["code"]


def _start_callback_server(expected_state: str) -> tuple[_CallbackServer, str, Dict[str, Optional[str]]]:
    result: Dict[str, Optional[str]] = {"code": None, "error": None}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path != "/callback":
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"Not found")
                return
            params = urllib.parse.parse_qs(parsed.query)
            error = params.get("error", [None])[0]
            code = params.get("code", [None])[0]
            state = params.get("state", [None])[0]
            if error:
                result["error"] = f"AlphaXiv OAuth failed: {error}"
                self.send_response(400)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"AlphaXiv OAuth failed. You can close this tab.")
                return
            if not code or state != expected_state:
                result["error"] = "Invalid AlphaXiv OAuth callback state."
                self.send_response(400)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"Invalid AlphaXiv OAuth callback. You can close this tab.")
                return
            result["code"] = code
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(
                b"<!doctype html><title>AlphaXiv OAuth</title><h1>AlphaXiv OAuth complete</h1><p>You can close this tab and return to Hermes.</p>"
            )

        def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
            del format, args

    server = _CallbackServer(("127.0.0.1", 0), Handler)
    server.timeout = 0.5
    redirect_uri = f"http://127.0.0.1:{server.server_address[1]}/callback"
    return server, redirect_uri, result


def _exchange_code(metadata: Dict[str, Any], client: Dict[str, Any], redirect_uri: str, verifier: str, code: str) -> Dict[str, Any]:
    body = urllib.parse.urlencode(
        {
            "grant_type": "authorization_code",
            "client_id": client["client_id"],
            "code": code,
            "redirect_uri": redirect_uri,
            "code_verifier": verifier,
            "resource": metadata["resource"],
        }
    ).encode("utf-8")
    token = _fetch_json(
        metadata["authorizationMetadata"]["token_endpoint"],
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        body=body,
    )
    if not token.get("access_token"):
        raise RuntimeError("AlphaXiv token endpoint did not return an access token.")
    return token


def _login_with_native_oauth(mcp_url: Optional[str] = None) -> None:
    final_mcp_url = (mcp_url or _mcp_url()).strip() or DEFAULT_MCP_URL
    metadata = _discover_oauth(final_mcp_url)
    verifier = secrets.token_urlsafe(48)
    state = secrets.token_urlsafe(24)
    server, redirect_uri, result = _start_callback_server(state)
    try:
        client = _register_oauth_client(metadata, redirect_uri)
        authorization_url = urllib.parse.urlparse(metadata["authorizationMetadata"]["authorization_endpoint"])
        query = urllib.parse.urlencode(
            {
                "response_type": "code",
                "client_id": client["client_id"],
                "redirect_uri": redirect_uri,
                "scope": DEFAULT_SCOPES,
                "state": state,
                "code_challenge": _base64url_sha256(verifier),
                "code_challenge_method": "S256",
                "resource": metadata["resource"],
            }
        )
        auth_url = urllib.parse.urlunparse(
            (
                authorization_url.scheme,
                authorization_url.netloc,
                authorization_url.path,
                authorization_url.params,
                query,
                authorization_url.fragment,
            )
        )
        print("Open this AlphaXiv OAuth URL in your browser and complete login:")
        print(auth_url)
        deadline = time.time() + 300
        while time.time() < deadline and not result["code"] and not result["error"]:
            server.handle_request()
        if result["error"]:
            raise RuntimeError(result["error"])
        if not result["code"]:
            raise RuntimeError("Timed out waiting for AlphaXiv OAuth callback.")
        token = _exchange_code(metadata, client, redirect_uri, verifier, str(result["code"]))
        _save_token(token, final_mcp_url)
        print("AlphaXiv auth configured for Hermes.")
    finally:
        server.server_close()


def _call_mcp(method: str, params: Dict[str, Any]) -> Dict[str, Any]:
    request_body = json.dumps(
        {"jsonrpc": "2.0", "id": "hermes-alphaclawxiv", "method": method, "params": params}
    ).encode("utf-8")
    request = urllib.request.Request(
        _mcp_url(),
        data=request_body,
        headers={
            "Accept": "application/json, text/event-stream",
            "Authorization": _auth_header(),
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"AlphaXiv MCP returned HTTP {exc.code}: {body[:300]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"AlphaXiv MCP request failed: {exc.reason}") from exc

    message = _parse_mcp_response(payload)
    if message.get("error"):
        error = message["error"]
        raise RuntimeError(error.get("message") or json.dumps(error))
    return message.get("result", {})


def _call_tool(tool_name: str, args: Dict[str, Any]) -> str:
    try:
        result = _call_mcp("tools/call", {"name": tool_name, "arguments": args})
    except Exception as exc:
        return _error(str(exc))
    return json.dumps(result)


def discover_papers_handler(args: Dict[str, Any], **kwargs: Any) -> str:
    del kwargs
    payload = {
        "keywords": args.get("keywords", []),
        "question": args.get("question", ""),
        "difficulty": args.get("difficulty", 5),
    }
    return _call_tool("discover_papers", payload)


def get_paper_content_handler(args: Dict[str, Any], **kwargs: Any) -> str:
    del kwargs
    payload = {
        "url": args.get("url", ""),
        "fullText": bool(args.get("fullText", False)),
    }
    return _call_tool("get_paper_content", payload)


def answer_pdf_queries_handler(args: Dict[str, Any], **kwargs: Any) -> str:
    del kwargs
    payload = {
        "url": args.get("url", ""),
        "queries": args.get("queries", []),
    }
    return _call_tool("answer_pdf_queries", payload)


def read_files_handler(args: Dict[str, Any], **kwargs: Any) -> str:
    del kwargs
    payload = {
        "githubUrl": args.get("githubUrl", ""),
        "path": args.get("path", ""),
    }
    return _call_tool("read_files_from_github_repository", payload)


def _auth_command(args: Any) -> None:
    sub = getattr(args, "alphaclawxiv_auth_command", None)
    if sub == "login":
        _login_with_native_oauth(getattr(args, "mcp_url", None))
        return
    if sub == "status":
        print(json.dumps(_status_payload(), indent=2))
        return
    if sub == "logout":
        _logout()
        print("AlphaXiv token removed from Hermes local state and .env.")
        return
    print("Usage: hermes alphaclawxiv auth <login|status|logout>")


def _cli_handler(args: Any) -> None:
    command = getattr(args, "alphaclawxiv_command", None)
    if command == "auth":
        _auth_command(args)
        return
    if command == "status":
        print(json.dumps(_status_payload(), indent=2))
        return
    if command == "discover":
        payload = {
            "keywords": [keyword for keyword in getattr(args, "keywords", []) if keyword],
            "question": getattr(args, "question", ""),
            "difficulty": getattr(args, "difficulty", 5),
        }
        print(discover_papers_handler(payload))
        return
    print("Usage: hermes alphaclawxiv <auth|status|discover>")


def _setup_argparse(subparser: Any) -> None:
    subs = subparser.add_subparsers(dest="alphaclawxiv_command")

    auth = subs.add_parser("auth", help="Manage AlphaXiv OAuth for Hermes")
    auth_subs = auth.add_subparsers(dest="alphaclawxiv_auth_command")

    login = auth_subs.add_parser("login", help="Print an AlphaXiv OAuth URL and wait for browser login")
    login.add_argument("--mcp-url", dest="mcp_url", default=DEFAULT_MCP_URL, help="AlphaXiv MCP URL")
    login.set_defaults(func=_cli_handler)

    auth_status = auth_subs.add_parser("status", help="Show stored AlphaXiv auth status")
    auth_status.set_defaults(func=_cli_handler)

    logout = auth_subs.add_parser("logout", help="Remove stored AlphaXiv token from Hermes local state")
    logout.set_defaults(func=_cli_handler)

    status = subs.add_parser("status", help="Show AlphaClawXiv Hermes plugin configuration")
    status.set_defaults(func=_cli_handler)

    discover = subs.add_parser("discover", help="Run discover_papers through AlphaXiv")
    discover.add_argument("--question", required=True, help="Semantic research question")
    discover.add_argument(
        "--keyword",
        dest="keywords",
        action="append",
        default=[],
        help="Repeat three or four times for exact terms",
    )
    discover.add_argument("--difficulty", type=int, default=5, help="Retrieval effort from 1 to 10")
    discover.set_defaults(func=_cli_handler)


def register(ctx: Any) -> None:
    ctx.register_tool(
        name="discover_papers",
        toolset="alphaclawxiv",
        schema=DISCOVER_PAPERS_SCHEMA,
        handler=discover_papers_handler,
        description=DISCOVER_PAPERS_SCHEMA["description"],
    )
    ctx.register_tool(
        name="get_paper_content",
        toolset="alphaclawxiv",
        schema=GET_PAPER_CONTENT_SCHEMA,
        handler=get_paper_content_handler,
        description=GET_PAPER_CONTENT_SCHEMA["description"],
    )
    ctx.register_tool(
        name="answer_pdf_queries",
        toolset="alphaclawxiv",
        schema=ANSWER_PDF_QUERIES_SCHEMA,
        handler=answer_pdf_queries_handler,
        description=ANSWER_PDF_QUERIES_SCHEMA["description"],
    )
    ctx.register_tool(
        name="read_files_from_github_repository",
        toolset="alphaclawxiv",
        schema=READ_GITHUB_SCHEMA,
        handler=read_files_handler,
        description=READ_GITHUB_SCHEMA["description"],
    )
    ctx.register_cli_command(
        name="alphaclawxiv",
        help="Manage AlphaClawXiv for Hermes Agent",
        setup_fn=_setup_argparse,
        handler_fn=_cli_handler,
    )
