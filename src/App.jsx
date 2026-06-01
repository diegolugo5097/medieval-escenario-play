import { useEffect, useRef, useState } from "react";
import { API_URL } from "./config";

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
  const [volume, setVolume] = useState(70);
  const [connected, setConnected] = useState(false);

  // El pergamino: "full" = mostrado completo, "mini" = pequeño en esquina
  const [scrollState, setScrollState] = useState("full");

  const playerRef = useRef(null);
  const ytReadyRef = useRef(false);
  const currentVideoRef = useRef(null);
  const wsRef = useRef(null);
  const hideTimerRef = useRef(null);
  const lastSongIdRef = useRef(null);
  const volumeRef = useRef(70);

  /* ---- Mostrar pergamino completo y programar que se encoja en 5s ---- */
  function revealScroll() {
    setScrollState("full");
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setScrollState("mini"), 5000);
  }

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
          if (typeof data.volume === "number") setVolume(data.volume);
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
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  /* ---- Mostrar pergamino completo al cargar ---- */
  useEffect(() => {
    revealScroll();
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
            if (playerRef.current?.setVolume) playerRef.current.setVolume(volumeRef.current);
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

  /* ---- Cuando cambia la canción actual: cargar video + revelar pergamino ---- */
  useEffect(() => {
    const vid = nowPlaying?.videoId || null;
    currentVideoRef.current = vid;
    if (vid && ytReadyRef.current && playerRef.current?.loadVideoById) {
      playerRef.current.loadVideoById(vid);
    }
    if (!vid && ytReadyRef.current && playerRef.current?.stopVideo) {
      playerRef.current.stopVideo();
    }

    // Si de verdad cambió la canción (no solo un re-render), revelar pergamino
    const sid = nowPlaying?.id || null;
    if (sid !== lastSongIdRef.current) {
      lastSongIdRef.current = sid;
      revealScroll();
    }
  }, [nowPlaying?.videoId, nowPlaying?.id]);

  /* ---- Aplicar pausa/play que viene del backend ---- */
  useEffect(() => {
    const p = playerRef.current;
    if (!ytReadyRef.current || !p) return;
    if (paused && p.pauseVideo) p.pauseVideo();
    if (!paused && p.playVideo) p.playVideo();
  }, [paused]);

  /* ---- Aplicar volumen que viene del backend ---- */
  useEffect(() => {
    volumeRef.current = volume;
    const p = playerRef.current;
    if (!ytReadyRef.current || !p || !p.setVolume) return;
    p.setVolume(volume);
    // Si el video arrancó mudo (autoplay) y el admin sube el volumen, desmutear
    if (volume > 0 && p.isMuted && p.isMuted() && p.unMute) p.unMute();
    if (volume === 0 && p.mute) p.mute();
  }, [volume, nowPlaying?.videoId]);

  async function avanzar() {
    try {
      await fetch(`${API_URL}/api/next`, { method: "POST" });
    } catch {}
  }

  return (
    <div className="stage">
      {/* Video a pantalla completa */}
      <div className="video-full">
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

      {/* Pergamino de la cola a la derecha */}
      <aside className={`scroll-panel ${scrollState}`}>
        <div className="scroll-inner">
          <div className="scroll-top">
            <span className="scroll-crest">⚜</span>
            <h1 className="scroll-brand">Café Medieval</h1>
            <span className={`dot ${connected ? "on" : "off"}`} />
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
        </div>

        {/* Versión mini: solo un resumen cuando está encogido */}
        <div className="scroll-mini-label">
          <span className="mini-icon">📜</span>
          <span className="mini-count">{queue.length}</span>
        </div>
      </aside>
    </div>
  );
}
