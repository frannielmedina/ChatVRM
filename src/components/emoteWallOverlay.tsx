import React, { useContext, useEffect, useRef } from "react";
import { ViewerContext } from "@/features/vrmViewer/viewerContext";
import { emoteWallQueue, EmoteDrop } from "@/features/emoteWall/emoteWallQueue";

const MAX_LIFETIME_MS = 30000;
const GRAVITY = 160; // vh-percent per second^2
const BOUNCE_DAMPING = 0.4;
const COLLISION_RADIUS_PCT = 7;

const FallingEmote = ({ drop, onDone }: { drop: EmoteDrop; onDone: (id: string) => void }) => {
  const { viewer } = useContext(ViewerContext);
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const head = viewer.getHeadScreenPosition();
    const headX = head?.xPct ?? 50;
    const headY = head?.yPct ?? 55;

    let x = headX + (Math.random() * 20 - 10);
    let y = -8;
    let vx = Math.random() * 10 - 5;
    let vy = 0;
    let rotation = Math.random() * 60 - 30;
    const rotationSpeed = Math.random() * 90 - 45;
    let bounced = false;

    const startedAt = performance.now();
    let lastT = startedAt;
    let raf = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      vy += GRAVITY * dt;
      x += vx * dt;
      y += vy * dt;
      rotation += rotationSpeed * dt;

      if (!bounced && y >= headY && Math.abs(x - headX) < COLLISION_RADIUS_PCT) {
        vy = -vy * BOUNCE_DAMPING;
        vx += Math.random() * 20 - 10;
        bounced = true;
      }

      if (elRef.current) {
        elRef.current.style.transform =
          `translate(-50%, -50%) translate(${x}vw, ${y}vh) rotate(${rotation}deg)`;
      }

      const elapsed = now - startedAt;
      const offScreen = y > 115;
      if (offScreen || elapsed > MAX_LIFETIME_MS) {
        onDone(drop.id);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drop.id]);

  return (
    <div
      ref={elRef}
      className="fixed top-0 left-0 pointer-events-none select-none"
      style={{ willChange: "transform", fontSize: "36px", lineHeight: 1, zIndex: 45 }}
    >
      {drop.isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={drop.content} alt="" width={40} height={40} draggable={false} />
      ) : (
        <span>{drop.content}</span>
      )}
    </div>
  );
};

export const EmoteWallOverlay = () => {
  const [drops, setDrops] = React.useState<EmoteDrop[]>([]);

  useEffect(() => {
    return emoteWallQueue.subscribe(setDrops);
  }, []);

  return (
    <>
      {drops.map((drop) => (
        <FallingEmote key={drop.id} drop={drop} onDone={(id) => emoteWallQueue.remove(id)} />
      ))}
    </>
  );
};
