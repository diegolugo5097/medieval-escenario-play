import { useEffect, useRef, useState } from "react";
import { API_URL, FRAME_HOLE } from "./config";

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
  const [songVolumes, setSongVolumes] = useState({});
  const [connected, setConnected] = useState(false);

  // Pergamino: "full" = desplegado, "mini" = enrollado pequeño
  const [scrollState, setScrollState] = useState("full");

  const playerRef = useRef(null);
  const ytReadyRef = useRef(false);
  const currentVideoRef = useRef(null);
  const wsRef = useRef(null);
  const hideTimerRef = useRef(null);
  const lastSongIdRef = useRef(null);
  const volumeRef = useRef(70);
  const holeRef = useRef(null);

  /* ---- Ajustar el iframe para CUBRIR el hueco (sin barras negras) ---- */
  function fitCover() {
    const hole = holeRef.current;
    const iframe = hole?.querySelector("iframe");
    if (!hole || !iframe) return;
    const hw = hole.clientWidth;
    const hh = hole.clientHeight;
    const videoRatio = 16 / 9;
    const holeRatio = hw / hh;
    let w, h;
    if (holeRatio > videoRatio) {
      // hueco más ancho: ajustar por ancho, sobra alto (se recorta)
      w = hw;
      h = hw / videoRatio;
    } else {
      // hueco más alto: ajustar por alto, sobra ancho
      h = hh;
      w = hh * videoRatio;
    }
    iframe.style.width = w + "px";
    iframe.style.height = h + "px";
  }

  function revealScroll() {
    setScrollState("full");
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setScrollState("mini"), 5000);
  }

  /* ---- WebSocket ---- */
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
          if (data.songVolumes) setSongVolumes(data.songVolumes);
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

  useEffect(() => { revealScroll(); }, []);

  /* ---- Reajustar el video al cambiar tamaño de ventana ---- */
  useEffect(() => {
    function onResize() { fitCover(); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ---- Player de YouTube ---- */
  useEffect(() => {
    loadYT().then((YT) => {
      playerRef.current = new YT.Player("yt-player", {
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, fs: 0, disablekb: 1 },
        events: {
          onReady: () => {
            ytReadyRef.current = true;
            if (playerRef.current?.setVolume) playerRef.current.setVolume(volumeRef.current);
            if (currentVideoRef.current) playerRef.current.loadVideoById(currentVideoRef.current);
            fitCover();
          },
          onStateChange: (e) => { if (e.data === 0) avanzar(); },
          onError: () => avanzar(),
        },
      });
    });
  }, []);

  useEffect(() => {
    const vid = nowPlaying?.videoId || null;
    currentVideoRef.current = vid;
    if (vid && ytReadyRef.current && playerRef.current?.loadVideoById) {
      playerRef.current.loadVideoById(vid);
    }
    if (!vid && ytReadyRef.current && playerRef.current?.stopVideo) {
      playerRef.current.stopVideo();
    }
    const sid = nowPlaying?.id || null;
    if (sid !== lastSongIdRef.current) {
      lastSongIdRef.current = sid;
      revealScroll();
    }
  }, [nowPlaying?.videoId, nowPlaying?.id]);

  useEffect(() => {
    const p = playerRef.current;
    if (!ytReadyRef.current || !p) return;
    if (paused && p.pauseVideo) p.pauseVideo();
    if (!paused && p.playVideo) p.playVideo();
  }, [paused]);

  useEffect(() => {
    // Si la canción actual tiene un ajuste propio, usarlo; si no, el volumen general
    const vid = nowPlaying?.videoId;
    const effective =
      vid && typeof songVolumes[vid] === "number" ? songVolumes[vid] : volume;
    volumeRef.current = effective;
    const p = playerRef.current;
    if (!ytReadyRef.current || !p || !p.setVolume) return;
    p.setVolume(effective);
    if (effective > 0 && p.isMuted && p.isMuted() && p.unMute) p.unMute();
    if (effective === 0 && p.mute) p.mute();
  }, [volume, songVolumes, nowPlaying?.videoId]);

  async function avanzar() {
    try { await fetch(`${API_URL}/api/next`, { method: "POST" }); } catch {}
  }

  return (
    <div className="stage">
      <div className="embers" />

      {/* Video (debajo) */}
      <div className="frame-wrap">
        <div className="frame-box">
          <div
            className="video-hole"
            ref={holeRef}
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
            {nowPlaying && paused && <div className="paused-badge">⏸ En pausa</div>}
          </div>
        </div>
      </div>

      {/* Pergamino vertical con la cola (se despliega de arriba a abajo) */}
      <aside className={`scroll-panel ${scrollState}`}>
        <div className="scroll-bg" />
        <div className="scroll-content">
          <div className="scroll-top">
            <h1 className="scroll-brand">La Cola del Bardo</h1>
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
            {queue.length === 0 && <li className="q-empty">— silencio en la taberna —</li>}
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
      </aside>

      {/* Marco SIEMPRE encima de todo (video y pergamino) */}
      <img className="frame-img" src="/marco_medieval.png" alt="" />
    </div>
  );
}
