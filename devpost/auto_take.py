"""Hands-free SpecScribe take: OBS record + Lens preview restart + audio cues + SIK pinches via the Lens Studio MCP.

Reuses devpost/take_runner.py (cues, audio helper, OBS connect) and scripts/lsmcp.py (Lens Studio MCP client).
Env: OBS_WS_PASSWORD, LS_MCP_TOKEN, BACKEND_LOG (uvicorn output file).
"""
import glob
import json
import os
import sys
import threading
import time

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO, "devpost"))
sys.path.insert(0, os.path.join(REPO, "scripts"))
import lsmcp  # noqa: E402
import take_runner as tr  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")
BACKEND_LOG = os.environ["BACKEND_LOG"]
LENS_LOG = max(glob.glob(os.path.expanduser(r"~\AppData\Local\Snap\Lens Studio\logs\LensStudioLog-*.txt")), key=os.path.getmtime)
T0 = None


def log(msg):
    stamp = f"{time.monotonic() - T0:6.1f}s" if T0 else "  ---  "
    print(f"[{stamp}] {msg}", flush=True)


class Tail:
    """Reads lines appended to a file after construction."""

    def __init__(self, path):
        self.path, self.pos = path, os.path.getsize(path)

    def new_lines(self):
        with open(self.path, "rb") as f:
            f.seek(self.pos)
            data = f.read()
            self.pos += len(data)
        return data.decode("utf-8", "replace").splitlines()


def wait_for(tail, needle, timeout):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        for line in tail.new_lines():
            if needle in line:
                return line.strip()
        time.sleep(0.25)
    return None


def mcp(tool, args):
    r = lsmcp.rpc("tools/call", {"name": tool, "arguments": args}, timeout=60)
    res = r.get("result", {})
    text = " ".join(c.get("text", "") for c in res.get("content", []) if c.get("type") == "text")
    return bool(res.get("isError")), text


HANDS = ["right", "left"]


def pinch(name):
    """The preview's simulated hands sometimes stop responding (which one varies); fall back to the other hand."""
    for hand in list(HANDS):
        err, text = mcp("PreviewInteractTool", {"action": "Pinch", "name": name, "handType": hand})
        if not err:
            log(f"PINCH {name}: ok ({hand} hand)")
            if HANDS[0] != hand:
                HANDS.reverse()
            return True
        log(f"PINCH {name}: {hand} hand failed ({text[60:120]})")
    return False


def pinch_async(name):
    threading.Thread(target=pinch, args=(name,), daemon=True).start()


def main():
    global T0
    player = tr.make_player(True)
    obs = tr.connect()
    obs.set_current_program_scene(tr.SCENE)
    backend, lens = Tail(BACKEND_LOG), Tail(LENS_LOG)
    obs.start_record()
    log("REC started")
    try:
        time.sleep(1.0)
        # Restart the preview's media clip with the Lens: re-applying the same source is a no-op, so bounce via an image.
        clip = os.path.join(REPO, "devpost", "footage", "demo_whiteboard_drawing_50s.mp4").replace(os.sep, "/")
        idle = json.loads(mcp("PreviewPanelTool", {"action": "listSources"})[1])["images"][0]
        mcp("PreviewPanelTool", {"action": "setConfig", "inputType": "Multimedia", "sourcePath": idle})
        mcp("PreviewPanelTool", {"action": "setConfig", "inputType": "Multimedia", "sourcePath": clip})
        call_start = time.monotonic()
        err, text = mcp("RunAndCollectLogsTool", {})
        T0 = call_start + 0.3  # the reset happens right at the start of the call; the clip restarts with it
        log(f"Lens preview restarted ({'ERROR ' + text[:200] if err else 'ok'})")

        pinch_cues = {19.0: "BtnCaptureWhiteboard", 36.0: "BtnCaptureWhiteboard"}
        for cue_t, kind, text, audio in tr.TIMED_CUES:
            while time.monotonic() - T0 < cue_t:
                time.sleep(0.02)
            if audio:
                player.play(audio)
                log(f"PLAY {audio}: {text}")
            elif cue_t in pinch_cues:
                pinch_async(pinch_cues[cue_t])
            else:
                log(f"{kind}: {text}")

        log("Waiting for the orb to raise its hand (backend HAND_RAISED)...")
        hit = wait_for(backend, "HAND_RAISED [", 45)
        log(f"hand raised: {hit[-140:] if hit else 'NOT SEEN in 45 s, pinching the orb anyway'}")
        time.sleep(3.0)  # let the pulse + badge read on camera
        pinch("AgentOrbMesh")
        log("Letting the critique card + spoken critique play (15 s)...")
        time.sleep(15.0)

        pinch("BtnConcludeMeeting")
        hit = wait_for(lens, "Meeting Concluded", 150)
        log(f"conclude: {'spec generated' if hit else 'NOT SEEN in 150 s'}")
        time.sleep(6.0)  # hold on the result
    finally:
        out = obs.stop_record().output_path
        log(f"REC stopped -> {out}")
        player.close()
        for line in backend.new_lines():
            pass


if __name__ == "__main__":
    main()
