import { useEffect, useState } from "react";

type Props = {
  onComplete: () => void;
};

export const LoadingScreen = ({ onComplete }: Props) => {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "fading">("loading");

  useEffect(() => {
    // Simulate staged loading progress
    const stages = [
      { target: 30, delay: 200 },
      { target: 60, delay: 600 },
      { target: 85, delay: 400 },
      { target: 100, delay: 500 },
    ];

    let current = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    let elapsed = 0;
    stages.forEach(({ target, delay }) => {
      elapsed += delay;
      const t = setTimeout(() => {
        // Animate from current to target
        const start = current;
        const duration = 300;
        const startTime = performance.now();
        const animate = (now: number) => {
          const pct = Math.min((now - startTime) / duration, 1);
          setProgress(Math.round(start + (target - start) * pct));
          if (pct < 1) requestAnimationFrame(animate);
          else current = target;
        };
        requestAnimationFrame(animate);
      }, elapsed);
      timers.push(t);
    });

    const fadeTimer = setTimeout(() => {
      setPhase("fading");
      setTimeout(onComplete, 600);
    }, elapsed + 400);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(fadeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-600 ${
        phase === "fading" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        background: "linear-gradient(135deg, #1a0d22 0%, #2d1a3d 40%, #1a0d22 100%)",
        fontFamily: "'Arial', sans-serif",
      }}
    >
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute rounded-full opacity-20"
          style={{
            width: 400,
            height: 400,
            background: "radial-gradient(circle, #856292, transparent)",
            top: "10%",
            left: "15%",
            animation: "pulse 3s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full opacity-15"
          style={{
            width: 300,
            height: 300,
            background: "radial-gradient(circle, #FF617F, transparent)",
            bottom: "20%",
            right: "10%",
            animation: "pulse 4s ease-in-out infinite 1s",
          }}
        />
      </div>

      {/* Logo / Title */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* VRM character silhouette placeholder */}
        <div className="relative mb-8">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #856292, #FF617F)",
              boxShadow: "0 0 40px rgba(133, 98, 146, 0.5)",
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.3))" }}
            >
              {/* Simple person silhouette */}
              <circle cx="12" cy="6" r="3" fill="white" opacity="0.9" />
              <path
                d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
                opacity="0.9"
              />
              <path
                d="M9 11l-2 4M15 11l2 4"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.7"
              />
            </svg>
          </div>
          {/* Spinning ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: "2px solid transparent",
              borderTopColor: "#856292",
              borderRightColor: "#FF617F",
              animation: "spin 1.5s linear infinite",
              margin: -4,
            }}
          />
        </div>

        <h1
          className="text-4xl font-bold tracking-widest"
          style={{
            color: "white",
            textShadow: "0 0 20px rgba(133, 98, 146, 0.8)",
            letterSpacing: "0.15em",
          }}
        >
          ChatVRM
        </h1>

        <p
          className="text-sm tracking-wider"
          style={{ color: "rgba(255,255,255,0.5)", letterSpacing: "0.2em" }}
        >
          INITIALIZING
        </p>

        {/* Progress bar */}
        <div className="mt-10 w-64">
          <div
            className="w-full rounded-full overflow-hidden"
            style={{
              height: 3,
              background: "rgba(255,255,255,0.1)",
            }}
          >
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #856292, #FF617F)",
                boxShadow: "0 0 8px rgba(255, 97, 127, 0.6)",
              }}
            />
          </div>
          <div
            className="mt-4 text-right text-xs font-bold"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            {progress}%
          </div>
        </div>

        {/* Loading steps */}
        <div className="mt-4 flex flex-col gap-2 items-center">
          {[
            { threshold: 10, label: "Loading 3D engine…" },
            { threshold: 40, label: "Preparing VRM model…" },
            { threshold: 70, label: "Connecting AI provider…" },
            { threshold: 90, label: "Almost ready…" },
          ].map(({ threshold, label }) => (
            <div
              key={label}
              className="text-xs transition-all duration-300"
              style={{
                color:
                  progress >= threshold
                    ? "rgba(255,255,255,0.7)"
                    : "rgba(255,255,255,0.2)",
                transform: progress >= threshold ? "translateY(0)" : "translateY(4px)",
              }}
            >
              {progress >= threshold ? "✓ " : "○ "}{label}
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.1); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};
