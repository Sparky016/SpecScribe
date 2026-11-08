"""SpecScribe demo take runner: drives OBS over obs-websocket v5 and prompts every
spoken line / pinch in sync with devpost/footage/demo_whiteboard_drawing_50s.mp4.

  pip install --user obsws-python
  $env:OBS_WS_PASSWORD = "<Tools > WebSocket Server Settings > Show Connect Info>"

  python take_runner.py --setup                 # (re)build the OBS scene + 1080p output
  python take_runner.py --setup --crop 0,80,700,40   # crop Lens Studio capture to the Preview panel (L,T,R,B px)
  python take_runner.py --dry-run               # rehearse the cues, no OBS
  python take_runner.py --audio-check           # play A01-A03 back to back to test audio routing
  python take_runner.py                         # record a take
  python take_runner.py --no-audio              # record a take, speakers say the lines live

SPEAK cues play their recorded line from devpost/footage/ (A01-A03.mp3) on the default Windows output
device. The Lens Studio preview's ASR listens to the *microphone*, so that audio has to reach it: either play
it out loud near the mic, or set the default output to a virtual cable (e.g. VB-CABLE "CABLE Input") and pick
"CABLE Output" as Lens Studio's microphone. OBS Desktop Audio records whatever the default output plays.
"""
from __future__ import annotations

import argparse
import os
import sys
import time

SCENE = "SpecScribe Demo"
LENS_INPUT, DASH_INPUT = "Lens Studio Preview", "Dashboard"
CLIP_LENGTH_S = 122.0  # devpost/build_input_clip.sh output
FOOTAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "footage")

# (clip time in seconds, kind, text, audio file in footage/ or None) - clip time 0 = the empty board appears.
TIMED_CUES = [
    (0.0, "INFO", "Clean board baseline. Nobody speaks.", None),
    (8.0, "SPEAK 1", '"We need a public client connecting to an API Gateway, and every request has to carry HMAC verification."', "A01.mp3"),
    (18.0, "WATCH", "Presenter stepped aside. Green 2-node overlay (Client -> API Gateway) within ~3 s.", None),
    (23.0, "SPEAK 2", "\"Let's route traffic from the Gateway to a Core Service and persist everything in PostgreSQL.\"", "A02.mp3"),
    # 31 s, not 29: A02 ends at ~28.9 s and the Lens ASR closes a turn after 1 s of silence, so a shorter gap
    # merges Speaker 2's and Speaker 1's lines into one turn.
    (31.0, "SPEAK 1", '"Do we need auth between the Core Service and the database, or is the network enough?"', "A03.mp3"),
    (34.0, "WATCH", "Full 4-node overlay (+ Core Service, + Postgres DB).", None),
    (40.0, "PINCH", "BtnToggleCaptureMode -> toast 'Capture Mode: MANUAL (Pinch to Capture)'.", None),
    (44.0, "PINCH", "BtnCaptureWhiteboard -> immediate snapshot.", None),
    (49.0, "PINCH", "[◇ Decision] -> diamond inserted, edges re-route.", None),
]
MANUAL_CUES = [
    ("WAIT", "Orb raises hand: cyan pulse, badge 'Auth Token Leak Risk', chime."),
    ("PINCH", "The Orb -> 3-bullet critique card + spoken critique. Let the voice finish."),
    ("PINCH", "BtnConcludeMeeting -> dashboard shows spec, timeline, RAG drawer. Hold ~5 s."),
]


# Helper process: preloads every clip into a WPF MediaPlayer (ships with Windows), prints READY, then plays a
# clip the moment its file name arrives on stdin. Preloading keeps PowerShell's startup cost out of the cue timing.
_PLAYER_PS = r"""
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName PresentationCore
$volume = [double]$env:TAKE_AUDIO_VOLUME
$players = @{}
foreach ($name in $env:TAKE_AUDIO_FILES.Split('|')) {
    $p = New-Object System.Windows.Media.MediaPlayer
    $p.Volume = $volume
    $p.Open([uri](Join-Path $env:TAKE_AUDIO_DIR $name))
    $players[$name] = $p
}
$deadline = (Get-Date).AddSeconds(10)
while (($players.Values | Where-Object { -not $_.NaturalDuration.HasTimeSpan }) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 50
}
$bad = @($players.Keys | Where-Object { -not $players[$_].NaturalDuration.HasTimeSpan })
if ($bad.Count) { [Console]::Out.WriteLine("ERROR could not load: $($bad -join ', ')"); exit 1 }
[Console]::Out.WriteLine("READY"); [Console]::Out.Flush()
while ($null -ne ($line = [Console]::In.ReadLine())) {
    $line = $line.Trim()
    if ($line -like 'POS *') { $n = $line.Substring(4); [Console]::Out.WriteLine("POS $n $($players[$n].Position.TotalMilliseconds)") }
    elseif ($players.ContainsKey($line)) { $players[$line].Position = [TimeSpan]::Zero; $players[$line].Play(); [Console]::Out.WriteLine("PLAYING $line") }
    else { [Console]::Out.WriteLine("ERROR unknown clip $line") }
    [Console]::Out.Flush()
}
"""


class CuePlayer:
    """Plays the SPEAK-cue clips on the default Windows output device, without blocking the cue loop."""

    def __init__(self, files: list[str], volume: float = 1.0) -> None:
        import base64
        import subprocess
        env = dict(os.environ, TAKE_AUDIO_DIR=FOOTAGE_DIR, TAKE_AUDIO_FILES="|".join(files), TAKE_AUDIO_VOLUME=str(volume))
        encoded = base64.b64encode(_PLAYER_PS.encode("utf-16-le")).decode("ascii")  # stdin stays free for cue names
        self._proc = subprocess.Popen(
            # No -NonInteractive: with -EncodedCommand and redirected stdin, PowerShell 5.1 then exits without running.
            ["powershell", "-NoProfile", "-STA", "-EncodedCommand", encoded],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env,
        )
        line = self._readline()
        if line != "READY":
            self.close()
            raise RuntimeError(f"audio helper failed to start: {line}")

    def _readline(self) -> str:
        """Next protocol reply (READY/PLAYING/POS/ERROR); skips PowerShell noise such as CLIXML progress records."""
        assert self._proc.stdout
        noise: list[str] = []
        while True:
            line = self._proc.stdout.readline()
            if not line:
                return "(helper exited) " + " | ".join(noise)[-500:]
            line = line.strip()
            if line.split(" ", 1)[0] in ("READY", "PLAYING", "POS", "ERROR"):
                return line
            if line:
                noise.append(line)

    def _send(self, command: str) -> str:
        assert self._proc.stdin
        self._proc.stdin.write(command + "\n")
        self._proc.stdin.flush()
        return self._readline()

    def play(self, filename: str) -> None:
        reply = self._send(filename)
        if not reply.startswith("PLAYING"):
            print(f"\n   !! audio: {reply}", flush=True)

    def position_ms(self, filename: str) -> float:
        return float(self._send(f"POS {filename}").split()[-1])

    def close(self) -> None:
        if self._proc.poll() is None:
            try:
                assert self._proc.stdin
                self._proc.stdin.close()
                self._proc.wait(timeout=3)
            except Exception:
                self._proc.kill()


def make_player(enabled: bool) -> CuePlayer | None:
    if not enabled:
        return None
    if sys.platform != "win32":
        sys.exit("Audio playback uses Windows' built-in media player; pass --no-audio on other platforms.")
    files = [f for *_, f in TIMED_CUES if f]
    missing = [f for f in files if not os.path.isfile(os.path.join(FOOTAGE_DIR, f))]
    if missing:
        sys.exit(f"Missing audio in {FOOTAGE_DIR}: {', '.join(missing)} (or pass --no-audio).")
    print("Loading audio cues...", flush=True)
    return CuePlayer(files, volume=float(os.environ.get("TAKE_AUDIO_VOLUME", "1.0")))


def audio_check(player: CuePlayer) -> None:
    for t, kind, text, filename in TIMED_CUES:
        if filename:
            say(kind, f"{filename}: {text}")
            player.play(filename)
            time.sleep(9.0)  # longest clip is ~6.8 s; >1 s of silence after each so the ASR ends the turn
    player.close()
    print("Did Lens Studio's ASR pick up all three lines? (Check the Lens logs / dashboard transcript.)")


def say(kind: str, text: str, clip_t: float | None = None) -> None:
    stamp = f"[{clip_t:5.1f}s]" if clip_t is not None else "[ --- ]"
    print(f"\r{' ' * 100}\r{stamp} {kind:<8} {text}", flush=True)


def connect():
    try:
        import obsws_python as obs
    except ImportError:
        sys.exit("obsws-python missing: pip install --user obsws-python")
    password = os.environ.get("OBS_WS_PASSWORD")
    if not password:
        sys.exit("Set OBS_WS_PASSWORD (OBS > Tools > WebSocket Server Settings > Show Connect Info).")
    host = os.environ.get("OBS_WS_HOST", "localhost")
    port = int(os.environ.get("OBS_WS_PORT", "4455"))
    try:
        return obs.ReqClient(host=host, port=port, password=password, timeout=5)
    except Exception as e:  # obsws raises a bare OBSSDKError on auth failure
        sys.exit(f"Could not connect to OBS at {host}:{port} ({e}). Is the WebSocket server enabled and the password current?")


def find_window(client, input_name: str, *needles: str, exclude: str | None = None) -> str | None:
    items = client.get_input_properties_list_property_items(input_name, "window").property_items
    for it in items:
        value = it["itemValue"]
        # OBS also lists the currently configured window with itemEnabled=False when it no longer exists.
        if not value or not it.get("itemEnabled", True):
            continue
        if exclude and exclude.lower() in value.lower():
            continue
        if all(n.lower() in value.lower() for n in needles):
            return value
    return None


def setup(client, crop: str | None) -> None:
    if SCENE not in [s["sceneName"] for s in client.get_scene_list().scenes]:
        client.create_scene(SCENE)
    existing = [i["inputName"] for i in client.get_input_list().inputs]
    for name in (LENS_INPUT, DASH_INPUT):
        if name not in existing:
            client.create_input(SCENE, name, "window_capture", {"method": 2}, True)

    lens = find_window(client, LENS_INPUT, "Lens Studio.exe")
    if lens:
        client.set_input_settings(LENS_INPUT, {"window": lens, "priority": 2, "method": 2, "cursor": True}, True)
    print("Lens Studio window:", lens or "NOT FOUND (open Lens Studio, then re-run --setup)")

    # --app windows have no " - Microsoft Edge" suffix; the main tabbed browser does (and may have a localhost tab in front).
    dash = (find_window(client, DASH_INPUT, "msedge.exe", "localhost", exclude="Microsoft")
            or find_window(client, DASH_INPUT, "msedge.exe", "SpecScribe", exclude="Microsoft"))
    if dash:
        client.set_input_settings(DASH_INPUT, {"window": dash, "priority": 0, "method": 2, "cursor": True}, True)
    print("Dashboard window:  ", dash or "NOT FOUND - run:  start msedge --app=http://localhost:3000/meetings/demo-session-01  then re-run --setup")

    layout = {LENS_INPUT: (0, 0, 1152, 1080), DASH_INPUT: (1152, 0, 768, 1080)}
    for item in client.get_scene_item_list(SCENE).scene_items:
        if item["sourceName"] not in layout:
            continue
        x, y, w, h = layout[item["sourceName"]]
        transform = {"positionX": x, "positionY": y, "alignment": 5, "boundsType": "OBS_BOUNDS_SCALE_INNER",
                     "boundsWidth": w, "boundsHeight": h, "boundsAlignment": 0}
        if crop and item["sourceName"] == LENS_INPUT:
            left, top, right, bottom = (int(v) for v in crop.split(","))
            transform.update(cropLeft=left, cropTop=top, cropRight=right, cropBottom=bottom)
        client.set_scene_item_transform(SCENE, item["sceneItemId"], transform)

    client.set_video_settings(numerator=30, denominator=1, base_width=1920, base_height=1080, out_width=1920, out_height=1080)
    client.set_current_program_scene(SCENE)
    print(f"Scene '{SCENE}' ready at 1920x1080@30. Check the OBS preview, then run a take.")


def run_cues(clip_start: float, player: CuePlayer | None) -> None:
    for i, (cue_t, kind, text, audio) in enumerate(TIMED_CUES):
        while (now := time.monotonic() - clip_start) < cue_t:
            print(f"\r   next: {kind} in {cue_t - now:4.1f}s  ", end="", flush=True)
            time.sleep(0.05)
        if audio and player:
            player.play(audio)
            kind = f"{kind} ▶"
        say(kind, text, time.monotonic() - clip_start)
        if i + 1 < len(TIMED_CUES):
            nxt = TIMED_CUES[i + 1]
            print(f"          (then {nxt[1]} at {nxt[0]:.0f}s)", flush=True)
    for kind, text in MANUAL_CUES:
        left = CLIP_LENGTH_S - (time.monotonic() - clip_start)
        say(kind, text, time.monotonic() - clip_start)
        input(f"          ...press Enter when done ({left:.0f}s of clip left before it loops)")
    say("DONE", "Take complete.")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--setup", action="store_true", help="build/refresh the OBS scene and exit")
    ap.add_argument("--crop", help="L,T,R,B pixel crop for the Lens Studio capture (with --setup)")
    ap.add_argument("--dry-run", action="store_true", help="cue rehearsal only, no OBS (still plays the audio)")
    ap.add_argument("--no-audio", action="store_true", help="don't play footage/A01-A03.mp3; speakers say the lines live")
    ap.add_argument("--audio-check", action="store_true", help="play the three lines back to back and exit")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")  # window titles can contain U+200B, which cp1252 consoles can't print

    if args.audio_check:
        audio_check(make_player(True))
        return

    if args.setup:
        setup(connect(), args.crop)
        return

    player = make_player(not args.no_audio)
    try:
        if args.dry_run:
            input("Restart the Lens preview; press Enter the moment the empty board appears...")
            run_cues(time.monotonic(), player)
            return

        client = connect()
        client.set_current_program_scene(SCENE)
        client.start_record()
        print(f"REC started ({SCENE}).")
        try:
            input("Restart the Lens preview; press Enter the moment the empty board appears...")
            run_cues(time.monotonic(), player)
        except KeyboardInterrupt:
            print("\nAborted.")
        finally:
            path = client.stop_record().output_path
            print(f"REC stopped -> {path}")
    finally:
        if player:
            player.close()


if __name__ == "__main__":
    main()
