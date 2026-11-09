"""Minimal Lens Studio MCP client tolerant of the server's bogus chunked framing.
usage: python lsmcp.py list | call <tool> '<json args>' """
import json, socket, sys, time
import os
TOKEN = os.environ.get("LS_MCP_TOKEN") or sys.exit("set LS_MCP_TOKEN (Bearer token from the lens-studio MCP config)")
def rpc(method, params=None, timeout=120):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}}).encode()
    req = (f"POST /mcp HTTP/1.1\r\nHost: localhost:50040\r\nAuthorization: Bearer {TOKEN}\r\nContent-Type: application/json\r\n"
           f"Accept: application/json, text/event-stream\r\nContent-Length: {len(body)}\r\nConnection: close\r\n\r\n").encode() + body
    s = socket.create_connection(("localhost", 50040), timeout=timeout); s.sendall(req)
    data, dec, deadline = b"", json.JSONDecoder(), time.time() + timeout
    while time.time() < deadline:
        try: chunk = s.recv(65536)
        except socket.timeout: break
        if not chunk: break
        data += chunk
        if b"\r\n\r\n" in data:
            txt = data.split(b"\r\n\r\n", 1)[1].decode("utf-8", "replace").lstrip()
            try: return dec.raw_decode(txt)[0]
            except ValueError: pass
    raise RuntimeError("no complete response: " + data[:500].decode("utf-8", "replace"))
if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if sys.argv[1] == "list":
        for t in rpc("tools/list")["result"]["tools"]: print(t["name"], "-", (t.get("description") or "")[:110].replace("\n", " "))
    elif sys.argv[1] == "schema":
        for t in rpc("tools/list")["result"]["tools"]:
            if t["name"] == sys.argv[2]: print(json.dumps(t, indent=1)[:6000])
    else:
        r = rpc("tools/call", {"name": sys.argv[2], "arguments": json.loads(sys.argv[3] if len(sys.argv) > 3 else "{}")})
        print(json.dumps(r, indent=1)[:12000])
