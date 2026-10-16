#!/usr/bin/env bash
# Cuts the background loop out of the raw screen recording.
# Usage: scripts/encode-bg.sh "/path/to/Screen Recording.mov"
set -euo pipefail

SRC="$1"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/media"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

START=62   # first clean second of the recording (no UI overlays)
LEN=40     # loop length
FADE=1.5   # crossfade from the tail back into the head so the loop is invisible

# Crop off the 66px title bar, drop the duplicate frames (visualizer drew at
# 60fps into a 120fps recording), lock to 60fps, and fold the tail into the head.
ffmpeg -v error -stats -y -ss "$START" -t "$(echo "$LEN + $FADE" | bc)" -i "$SRC" -an \
  -filter_complex "
    [0:v]crop=3024:1890:0:70,mpdecimate=max=1,fps=60,setpts=PTS-STARTPTS,split[a][b];
    [a]trim=start=$FADE,setpts=PTS-STARTPTS[main];
    [b]trim=duration=$FADE,setpts=PTS-STARTPTS[head];
    [main][head]xfade=transition=fade:duration=$FADE:offset=$(echo "$LEN - $FADE" | bc),format=yuv420p[v]" \
  -map "[v]" -c:v libx264 -preset ultrafast -crf 8 "$TMP/master.mp4"

LANDSCAPE="scale=1920:1200:flags=lanczos"
PORTRAIT="crop=1064:1890:980:0,scale=1080:1920:flags=lanczos"

# Capped bitrates keep playback smooth on slow connections; 2s keyframes keep seeking cheap.
h264() { ffmpeg -v error -stats -y -i "$TMP/master.mp4" -vf "$1" -an -c:v libx264 -preset slow -profile:v high -level "$2" \
  -crf 23 -maxrate "$3" -bufsize "$4" -g 120 -pix_fmt yuv420p -movflags +faststart "$OUT/$5"; }
hevc() { ffmpeg -v error -stats -y -i "$TMP/master.mp4" -vf "$1" -an -c:v libx265 -preset slow -tag:v hvc1 \
  -crf 26 -x265-params "log-level=error:keyint=120:vbv-maxrate=$2:vbv-bufsize=$3" -pix_fmt yuv420p -movflags +faststart "$OUT/$4"; }

h264 "$LANDSCAPE" 5.0 5M 10M bg-landscape.h264.mp4
hevc "$LANDSCAPE" 3500 7000 bg-landscape.hevc.mp4
h264 "$PORTRAIT"  4.2 4M 8M  bg-portrait.h264.mp4
hevc "$PORTRAIT"  2800 5600 bg-portrait.hevc.mp4

# Posters are frame 0, so the swap from poster to video is seamless.
ffmpeg -v error -y -i "$OUT/bg-landscape.h264.mp4" -frames:v 1 -q:v 5 "$OUT/poster-landscape.jpg"
ffmpeg -v error -y -i "$OUT/bg-portrait.h264.mp4" -frames:v 1 -q:v 5 "$OUT/poster-portrait.jpg"

ls -lh "$OUT"
