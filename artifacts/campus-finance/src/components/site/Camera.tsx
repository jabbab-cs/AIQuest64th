import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Loader2 } from "lucide-react";

export type CameraState = "starting" | "live" | "insecure" | "denied" | "missing";

// Rear camera stream for one step; tracks stop when `on` turns false or the step unmounts.
export function useCamera(on: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CameraState>("starting");

  useEffect(() => {
    if (!on) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setState("insecure"); return; }
    let stream: MediaStream | null = null;
    let cancelled = false;
    setState("starting");
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        const video = videoRef.current;
        if (video) { video.srcObject = s; video.play().catch(() => {}); }
        setState("live");
      })
      .catch((e: { name?: string }) => {
        if (cancelled) return;
        setState(e?.name === "NotAllowedError" || e?.name === "SecurityError" ? "denied" : "missing");
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [on]);

  return { videoRef, state };
}

// Copies the current video frame so the photo step can show what was captured.
export function grabFrame(video: HTMLVideoElement | null) {
  if (!video || video.readyState < 2 || !video.videoWidth) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")?.drawImage(video, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.8);
}

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  state: CameraState;
  starting: string;
  problem?: ReactNode;
  frozen?: string | null;
  overlay?: ReactNode;
};

export function Viewfinder({ videoRef, state, starting, problem, frozen, overlay }: Props) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-card-border bg-[#1B1F1C]">
      <video ref={videoRef} aria-hidden="true" muted playsInline autoPlay className="absolute inset-0 h-full w-full object-cover" />
      {frozen && <img src={frozen} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {state === "live" && !frozen && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-[14%] rounded-md border-2 border-white/70" />
      )}
      {state === "starting" && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{starting}
        </div>
      )}
      {problem && (
        <div className="absolute inset-0 flex items-center justify-center bg-card p-5 text-center text-[15px] leading-relaxed text-foreground">
          {problem}
        </div>
      )}
      {overlay}
    </div>
  );
}
