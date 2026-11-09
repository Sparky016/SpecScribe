"""Run a Lens Studio runtime-scene GraphQL query (arg 1) and print the JSON result."""
import json, os, re, sys
sys.path.insert(0, r"C:\Users\ruanc\source\repos\SpecScribe\scripts")
cfg = json.load(open(r"C:\Users\ruanc\source\repos\SpecScribe\.mcp.json"))
os.environ["LS_MCP_TOKEN"] = re.sub(r"^Bearer\s+", "", cfg["mcpServers"]["lens-studio"]["headers"]["Authorization"])
import lsmcp
tool = sys.argv[2] if len(sys.argv) > 2 else "QueryRuntimeSceneTool"
r = lsmcp.rpc("tools/call", {"name": tool, "arguments": {"query": sys.argv[1]}}, timeout=90)
for c in r["result"]["content"]:
    t = c.get("text", "")
    try: print(json.dumps(json.loads(t), indent=1)[:int(os.environ.get("MAXC", "14000"))])
    except Exception: print(t[:14000])
