"""
Serves thermometer.html over HTTP and donor updates over WebSocket on the SAME port
(so a browser can use http://<droplet>/thermometer and ws://<droplet>/ with no reverse proxy).

Droplet (port 80):   sudo python3 thermometer_server.py
Local dev:           python3 thermometer_server.py --port 8765

Put your Zeffy token in zeffy_api_key.txt (same folder as this script). See
zeffy_api_key.example.txt — that file is safe to commit; zeffy_api_key.txt is gitignored.
"""
import argparse
import asyncio
import functools
import http.client
import json
import urllib.parse
from http import HTTPStatus
from pathlib import Path

import websockets

LIMIT = 100
POLL_FREQ_S = 15

_WEB_DIR = Path(__file__).resolve().parent
_THERMOMETER_HTML = _WEB_DIR / "thermometer.html"
_DREAM_MAP_HTML = _WEB_DIR / "dream_map.html"
_DREAM_MAP_EMBED_HTML = _WEB_DIR / "dream_map_embed.html"
_MAP_ADMIN_HTML = _WEB_DIR / "map_admin.html"
_SHARED_MAP_JS = _WEB_DIR / "js" / "dream_map_shared.js"


def _require_bytes(path: Path) -> bytes:
    if not path.is_file():
        raise FileNotFoundError(f"Missing {path}")
    return path.read_bytes()


THERMOMETER_BYTES = _require_bytes(_THERMOMETER_HTML)
DREAM_MAP_BYTES = _require_bytes(_DREAM_MAP_HTML)
DREAM_MAP_EMBED_BYTES = _require_bytes(_DREAM_MAP_EMBED_HTML)
MAP_ADMIN_BYTES = _require_bytes(_MAP_ADMIN_HTML)
SHARED_MAP_JS_BYTES = _require_bytes(_SHARED_MAP_JS)

_ZEFFY_KEY_FILE = _WEB_DIR / "zeffy_api_key.txt"


@functools.lru_cache(maxsize=1)
def _zeffy_api_key():
    if not _ZEFFY_KEY_FILE.is_file():
        raise FileNotFoundError(
            f"Missing {_ZEFFY_KEY_FILE.name}. Copy zeffy_api_key.example.txt to "
            f"{_ZEFFY_KEY_FILE.name} and paste your Zeffy API token (one line)."
        )
    text = _ZEFFY_KEY_FILE.read_text(encoding="utf-8")
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        return line
    raise ValueError(f"{_ZEFFY_KEY_FILE.name} has no token (non-comment line).")


def create_conn():
    return http.client.HTTPSConnection("api.zeffy.com")


def req(conn, limit=None, before_id=None):
    if not limit:
        limit = LIMIT

    headers = {
        "accept": "application/json",
        "Authorization": f"Bearer {_zeffy_api_key()}",
    }

    query_params = {
        "limit": limit,
        "campaign": "078950ed-786b-4f5b-b88f-b0de4836bb26",
    }
    if before_id:
        query_params["starting_after"] = before_id

    query_string = urllib.parse.urlencode(query_params)
    endpoint = f"/api/v1/payments?{query_string}"

    print(f"Request: {endpoint}")

    conn.request("GET", endpoint, headers=headers)
    response = conn.getresponse()
    data = json.loads(response.read().decode())

    print(f"Response: {response.status}")

    return response.status, data


def _snapshot_copy(donors):
    """Shallow copy of donor dicts for safe reuse across polls / clients."""
    out = []
    for d in donors:
        out.append(
            {
                "name": d.get("name", ""),
                "amount": int(d["amount"]),
                "currency": d.get("currency", "usd"),
            }
        )
    return out


def get_all_donors():
    """Return (donors, clean_exit).

    clean_exit is True only when pagination finished without HTTP errors or
    exceptions (including an empty first page — a valid \"zero donors\" state).
    On connection resets / partial reads, clean_exit is False and donors may be
    incomplete or empty; callers must not treat that as authoritative.
    """
    conn = create_conn()
    donors = []
    finished = False
    last_id = None
    clean_exit = False

    try:
        while not finished:
            status, data = req(conn=conn, limit=LIMIT, before_id=last_id)
            if status != 200:
                print(f"API Error: Status {status}")
                break

            for row in data.get("data", []):
                buyer = row.get("buyer", {})
                name = f"{buyer.get('first_name', '')} {buyer.get('last_name', '')}".strip()
                amount = row.get("amount", 0) // 100
                currency = row.get("currency", "usd")

                if amount:
                    donors.append(
                        {
                            "name": name,
                            "amount": amount,
                            "currency": currency,
                        }
                    )

            if not len(data.get("data", [])):
                finished = True
                clean_exit = True
                break

            last_id = data["data"][-1]["id"]

    except Exception as e:
        print(f"Error parsing Zeffy data: {e}")
    finally:
        conn.close()

    return donors, clean_exit


clients = set()
# Last list from a *clean* Zeffy poll only — used when a poll fails or a new WS
# client connects during an error so we never broadcast or send empty by mistake.
_last_donor_snapshot = []


async def handler(websocket):
    """Handles new client connections."""
    print("Adding new client")
    clients.add(websocket)
    try:
        try:
            donors, clean = await asyncio.to_thread(get_all_donors)
        except Exception as e:
            print(f"Error web socket initial fetch: {e}")
            donors, clean = [], False
        if not clean and _last_donor_snapshot:
            donors = _snapshot_copy(_last_donor_snapshot)
            print("Initial Zeffy fetch incomplete; sending last known donor snapshot")
        await websocket.send(json.dumps({"donors": donors}))
        await websocket.wait_closed()
    except Exception as e:
        print(f"Error web socket: {e}")
    finally:
        clients.remove(websocket)


def _norm_http_path(path: str) -> str:
    p = path.split("?")[0]
    if len(p) > 1 and p.endswith("/"):
        p = p[:-1]
    return p or "/"


def _http_route(norm_path: str):
    """Return ('redirect', location) or ('bytes', content_type, data) or None."""
    if norm_path == "/":
        return ("redirect", "/thermometer")
    if norm_path in ("/thermometer", "/thermometer.html"):
        return ("bytes", "text/html; charset=utf-8", THERMOMETER_BYTES)
    if norm_path == "/map":
        return ("bytes", "text/html; charset=utf-8", DREAM_MAP_BYTES)
    if norm_path == "/map/embed":
        return ("bytes", "text/html; charset=utf-8", DREAM_MAP_EMBED_BYTES)
    if norm_path in ("/map_admin", "/map_admin.html"):
        return ("bytes", "text/html; charset=utf-8", MAP_ADMIN_BYTES)
    if norm_path == "/js/dream_map_shared.js":
        return ("bytes", "application/javascript; charset=utf-8", SHARED_MAP_JS_BYTES)
    return None


async def process_request(arg1, arg2=None):
    """Serve static HTML/JS on GET; return None so WebSocket handshakes proceed.

    websockets < 12: process_request(path: str, request_headers: Headers) -> tuple|None
    websockets >= 12: process_request(connection, request: Request) -> Response|None
    """
    # New asyncio API (websockets 12+): ServerConnection has .respond()
    if hasattr(arg1, "respond"):
        connection, request = arg1, arg2
        upgrade = (request.headers.get("Upgrade") or "").lower()
        if upgrade == "websocket":
            return None
        p = _norm_http_path(request.path)
        routed = _http_route(p)
        if routed is None:
            if p == "/favicon.ico":
                return connection.respond(HTTPStatus.NO_CONTENT, "")
            return connection.respond(HTTPStatus.NOT_FOUND, "Not found\n")
        if routed[0] == "redirect":
            response = connection.respond(HTTPStatus.FOUND, "")
            response.headers["Location"] = routed[1]
            return response
        _, content_type, raw = routed
        body = raw.decode("utf-8", errors="replace")
        response = connection.respond(HTTPStatus.OK, body)
        response.headers["Content-Type"] = content_type
        return response

    # Legacy API (websockets 10.x / dist packages): (path, request_headers)
    path, request_headers = arg1, arg2
    upgrade = (request_headers.get("Upgrade") or "").lower()
    if upgrade == "websocket":
        return None

    p = _norm_http_path(path)
    routed = _http_route(p)
    if routed is None:
        if p == "/favicon.ico":
            return (HTTPStatus.NO_CONTENT, [], b"")
        return (
            HTTPStatus.NOT_FOUND,
            [("Content-Type", "text/plain; charset=utf-8")],
            b"Not found\n",
        )
    if routed[0] == "redirect":
        return (
            HTTPStatus.FOUND,
            [("Location", routed[1]), ("Content-Length", "0")],
            b"",
        )
    _, content_type, raw = routed
    return (HTTPStatus.OK, [("Content-Type", content_type)], raw)


async def broadcast_loop():
    global _last_donor_snapshot
    last_total = -1
    last_count = -1
    print("Fetching initial data from Zeffy...")

    while True:
        try:
            donors, clean = await asyncio.to_thread(get_all_donors)
            if not clean:
                print(
                    "Zeffy poll did not complete cleanly (connection error or partial data); "
                    "skipping broadcast — keeping last known donors and totals."
                )
                await asyncio.sleep(POLL_FREQ_S)
                continue

            _last_donor_snapshot = _snapshot_copy(donors)
            current_total = sum(d["amount"] for d in donors)
            current_count = len(donors)

            if current_total != last_total or current_count != last_count:
                print(
                    f"Update detected! {current_count} donors, ${current_total} raised. "
                    f"(Broadcasting to {len(clients)} clients)"
                )
                last_total = current_total
                last_count = current_count

                if clients:
                    message = json.dumps({"donors": donors})
                    websockets.broadcast(clients, message)
            else:
                print("No update")

        except Exception as e:
            print(f"Error fetching data from Zeffy: {e}")

        await asyncio.sleep(POLL_FREQ_S)


async def main(host: str, port: int):
    async with websockets.serve(
        handler,
        host,
        port,
        process_request=process_request,
    ):
        scheme = "https" if port == 443 else "http"
        ws_scheme = "wss" if port == 443 else "ws"
        host_hint = host if host != "0.0.0.0" else "<this-host>"
        port_bit = f":{port}" if port not in (80, 443) else ""
        print(
            f"Thermometer: {scheme}://{host_hint}{port_bit}/thermometer\n"
            f"Dream map:   {scheme}://{host_hint}{port_bit}/map\n"
            f"Map admin:   {scheme}://{host_hint}{port_bit}/map_admin\n"
            f"WebSocket:   {ws_scheme}://{host_hint}{port_bit}/ (same port)\n"
            f"(Use the droplet's public IP or DNS in the browser.)"
        )
        await broadcast_loop()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HTTP + WebSocket thermometer server")
    parser.add_argument("--host", default="0.0.0.0", help="Bind address (default 0.0.0.0)")
    parser.add_argument(
        "--port",
        type=int,
        default=80,
        help="Listen port (80 needs root on Linux; use --port 8765 for local dev)",
    )
    args = parser.parse_args()
    try:
        asyncio.run(main(args.host, args.port))
    except PermissionError:
        print(
            f"Permission denied binding to port {args.port}. "
            f"Try: sudo python3 {Path(__file__).name} --port 80\n"
            f"Or: python3 {Path(__file__).name} --port 8765"
        )
        raise
