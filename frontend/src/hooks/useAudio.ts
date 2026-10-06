import { useCallback, useEffect, useRef, useState } from "react";

import { toast } from "@/stores/toast";

/** Plays one ayah recitation, optionally several times in a row. */
export function useAudio(url: string | undefined) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const left = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [loops, setLoops] = useState(0);

  const stop = useCallback(() => {
    left.current = 0;
    ref.current?.pause();
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (!url) return;
    const audio = new Audio();
    audio.preload = "none";
    audio.src = url;
    ref.current = audio;
    const onEnded = () => {
      setLoops((n) => n + 1);
      if (--left.current > 0) {
        audio.currentTime = 0;
        void audio.play();
      } else setPlaying(false);
    };
    const onError = () => {
      if (left.current > 0) toast("Récitation indisponible pour le moment. Vérifie ta connexion.", "error");
      left.current = 0;
      setPlaying(false);
    };
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.pause();
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      ref.current = null;
      left.current = 0;
      setPlaying(false);
      setLoops(0);
    };
  }, [url]);

  const play = useCallback((times = 1) => {
    const audio = ref.current;
    if (!audio) return;
    left.current = times;
    audio.currentTime = 0;
    setPlaying(true);
    audio.play().catch(() => {
      left.current = 0;
      setPlaying(false);
    });
  }, []);

  return { playing, loops, play, stop, toggle: (times = 1) => (playing ? stop() : play(times)) };
}
