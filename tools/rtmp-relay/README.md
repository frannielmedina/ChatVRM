# ChatVRM RTMP relay

Browsers can't speak RTMP, so Streamer Mode captures the streamer tab (picture **and** audio),
encodes it to WebM and sends it to this tiny local server. The server pipes it into
`ffmpeg`, which pushes RTMP to Twitch / YouTube / Kick / anything RTMP.

```
Streamer tab ─ getDisplayMedia + MediaRecorder ─ WebSocket ─▶ relay ─▶ ffmpeg ─ RTMP ─▶ Twitch
```

## Run it

```bash
cd tools/rtmp-relay
npm install     # also installs a bundled ffmpeg (ffmpeg-static) unless you already have one
npm start
```

Then in ChatVRM: Settings → Twitch → **Open Streamer Window** → ⚙ Control Panel → **Stream** tab →
paste your stream key → **Go Live**. Chrome/Edge will ask what to share — keep **This tab** selected
and tick **Share tab audio** (that's how the character's voice gets into the stream).

## Notes

* It only listens on `127.0.0.1` and only accepts connections from pages on `localhost` / `127.0.0.1`.
  If you host ChatVRM elsewhere, add its origin: `ALLOWED_ORIGINS=https://my.site npm start`.
* Use your own ffmpeg with `FFMPEG_PATH=/path/to/ffmpeg npm start`. Hardware encoders
  (NVENC / QuickSync / AMF / VideoToolbox) show up in the Stream tab automatically if your build has them.
* Don't resize the streamer window while live — ffmpeg will rescale, but you may get a brief glitch.
* Keep the streamer window visible (not minimised). Browsers slow down hidden tabs.
* The stream key is only sent to this local relay, and is masked in its log output.
