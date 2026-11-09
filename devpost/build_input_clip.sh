#!/usr/bin/env bash
# Assembles devpost/footage/{K0,K1,K2}.jpg + {V1,V2}.mp4 into the Lens Studio
# Preview media-source clip. Usage: FFMPEG=/path/to/ffmpeg ./build_input_clip.sh
set -euo pipefail
FF="${FFMPEG:-ffmpeg}"
cd "$(dirname "$0")/footage"

NORM="scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,format=yuv420p,setsar=1,settb=AVTB"

# Timeline (0.5 s crossfades):  K0 8s | V1 10s | K1 6s (step-aside) | V2 10s | K2 150s (pinch interactions, orb, conclude — must outlast the take, ~140 s with spec generation)
"$FF" -hide_banner -loglevel error -y \
  -loop 1 -t 8  -i K0.jpg \
  -t 10 -i V1.mp4 \
  -loop 1 -t 6  -i K1.jpg \
  -t 10 -i V2.mp4 \
  -loop 1 -t 150 -i K2.jpg \
  -filter_complex "\
[0:v]$NORM[k0];[1:v]$NORM[v1];[2:v]$NORM[k1];[3:v]$NORM[v2];[4:v]$NORM[k2];\
[k0][v1]xfade=transition=fade:duration=0.5:offset=7.5[a];\
[a][k1]xfade=transition=fade:duration=0.5:offset=17[b];\
[b][v2]xfade=transition=fade:duration=0.5:offset=22.5[c];\
[c][k2]xfade=transition=fade:duration=0.5:offset=32[out]" \
  -map "[out]" -an -pix_fmt yuv420p -color_range tv -c:v libx264 -profile:v high -preset slow -crf 18 -movflags +faststart \
  demo_whiteboard_drawing_50s.mp4

echo "Wrote $(pwd)/demo_whiteboard_drawing_50s.mp4"
