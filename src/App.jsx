import { useEffect, useRef, useState } from "react";
import { API_URL, FRAME_HOLE } from "./config";

/* Carga la YouTube IFrame API una sola vez */
function loadYT() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
  });
}

export default function App() {
  const [nowPlaying, setNowPlaying] = useState(null);
  const [queue, setQueue] = useState([]);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);

  const playerRef = useRef(null);
  const ytReadyRef = useRef(false);
  const currentVideoRef = useRef(null);
  const wsRef = useRef(null);

  /* ---- Conexión WebSocket con el backend ---- */
  useEffect(() => {
    let alive = true;
    function connect() {
      const ws = new WebSocket(API_URL.replace(/^http/, "ws"));
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === "state") {
          setQueue(data.queue || []);
          setNowPlaying(data.nowPlaying || null);
          setPaused(!!data.paused);
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (alive) setTimeout(connect, 2000);
      };
    }
    connect();
    return () => {
      alive = false;
      wsRef.current?.close();
    };
  }, []);

  /* ---- Inicializar el player de YouTube ---- */
  useEffect(() => {
    loadYT().then((YT) => {
      playerRef.current = new YT.Player("yt-player", {
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          disablekb: 1,
        },
        events: {
          onReady: () => {
            ytReadyRef.current = true;
            if (currentVideoRef.current) {
              playerRef.current.loadVideoById(currentVideoRef.current);
            }
          },
          onStateChange: (e) => {
            if (e.data === 0) avanzar();
          },
          onError: () => avanzar(),
        },
      });
    });
  }, []);

  /* ---- Cuando cambia la canción actual, cargarla ---- */
  useEffect(() => {
    const vid = nowPlaying?.videoId || null;
    currentVideoRef.current = vid;
    if (vid && ytReadyRef.current && playerRef.current?.loadVideoById) {
      playerRef.current.loadVideoById(vid);
    }
    if (!vid && ytReadyRef.current && playerRef.current?.stopVideo) {
      playerRef.current.stopVideo();
    }
  }, [nowPlaying?.videoId]);

  /* ---- Aplicar pausa/play que viene del backend ---- */
  useEffect(() => {
    const p = playerRef.current;
    if (!ytReadyRef.current || !p) return;
    if (paused && p.pauseVideo) p.pauseVideo();
    if (!paused && p.playVideo) p.playVideo();
  }, [paused]);

  // Lo dispara el propio reproductor al terminar un video (no requiere admin).
  async function avanzar() {
    try {
      await fetch(`${API_URL}/api/next`, { method: "POST" });
    } catch {}
  }

  return (
    <div className="stage">
      <div className="embers" />

      <div className="frame-wrap">
        <div className="frame-box">
          <div
            className="video-hole"
            style={{
              left: `${FRAME_HOLE.left}%`,
              top: `${FRAME_HOLE.top}%`,
              width: `${FRAME_HOLE.width}%`,
              height: `${FRAME_HOLE.height}%`,
            }}
          >
            <div id="yt-player" className="yt-player" />

            {!nowPlaying && (
              <div className="idle">
                <div className="idle-crest">⚜</div>
                <h2>El escenario aguarda</h2>
                <p>Pedid una canción desde la app del Café Medieval</p>
                <div className="idle-flame">♪ ♫ ♪</div>
              </div>
            )}

            {nowPlaying && paused && (
              <div className="paused-badge">⏸ En pausa</div>
            )}
          </div>

          <img className="frame-img" src="/marco_medieval.png" alt="" />
        </div>
      </div>

      <aside className="sidebar">
        <h1 className="brand">Café Medieval</h1>
        <div className={`status ${connected ? "on" : "off"}`}>
          {connected ? "● Conectado" : "○ Reconectando…"}
        </div>

        {nowPlaying && (
          <div className="np">
            <span className="np-label">Sonando ahora</span>
            <span className="np-title">{nowPlaying.title}</span>
            <span className="np-by">pedida por {nowPlaying.addedBy}</span>
          </div>
        )}

        <div className="q-head">A continuación · {queue.length}</div>
        <ol className="q-list">
          {queue.length === 0 && (
            <li className="q-empty">— silencio en la taberna —</li>
          )}
          {queue.map((s, i) => (
            <li key={s.id} className="q-item">
              <span className="q-num">{i + 1}</span>
              <div className="q-info">
                <span className="q-song">{s.title}</span>
                <span className="q-by">{s.addedBy}</span>
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
