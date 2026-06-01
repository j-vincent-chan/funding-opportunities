"use client";

import { useEffect, useMemo, useRef } from "react";

type PageLoadingVariant = "light" | "terminal";

type SphereDot = {
  lat: number;
  lon: number;
  phase: number;
};

function buildSphereLattice(latBands: number, lonBands: number): SphereDot[] {
  const dots: SphereDot[] = [];
  for (let i = 0; i < latBands; i += 1) {
    const v = latBands <= 1 ? 0 : i / (latBands - 1);
    const lat = -Math.PI / 2 + v * Math.PI;
    const rowLonBands = Math.max(3, Math.round(lonBands * Math.cos(lat)));
    for (let j = 0; j < rowLonBands; j += 1) {
      const lon = (j / rowLonBands) * Math.PI * 2;
      dots.push({ lat, lon, phase: lat * 1.7 + lon * 2.3 });
    }
  }
  return dots;
}

function projectDot(
  dot: SphereDot,
  rotY: number,
  cx: number,
  cy: number,
  radius: number,
  pulse: number
) {
  const cosLat = Math.cos(dot.lat);
  const sinLat = Math.sin(dot.lat);
  const cosLon = Math.cos(dot.lon);
  const sinLon = Math.sin(dot.lon);

  const x = cosLat * cosLon;
  const y = cosLat * sinLon;
  const z = sinLat;

  const cosR = Math.cos(rotY);
  const sinR = Math.sin(rotY);
  const x2 = x * cosR + z * sinR;
  const z2 = -x * sinR + z * cosR;

  const depth = (z2 + 1) / 2;
  const scale = 0.28 + depth * 0.72;
  const shimmer = 0.72 + 0.28 * Math.sin(pulse + dot.phase);
  const opacity = (0.22 + depth * 0.78) * shimmer;

  return {
    cx: cx + x2 * radius,
    cy: cy - y * radius * 0.96,
    rx: scale * 1.05,
    ry: scale * 0.88,
    opacity,
    z2,
  };
}

export function DotSphereIcon({
  variant = "light",
  size = 112,
  className = "",
}: {
  variant?: PageLoadingVariant;
  size?: number;
  className?: string;
}) {
  const dots = useMemo(() => buildSphereLattice(14, 28), []);
  const frameRef = useRef<number | null>(null);
  const stateRef = useRef({ rotY: 0, pulse: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const fill = variant === "terminal" ? "#94a3b8" : "var(--fo-ink-muted)";
  const glow = variant === "terminal" ? "rgba(34, 211, 238, 0.28)" : "rgba(14, 107, 120, 0.2)";
  const viewSize = 64;
  const center = viewSize / 2;
  const sphereRadius = 22;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ellipses = Array.from(svg.querySelectorAll<SVGEllipseElement>("[data-dot]"));

    if (reducedMotion) {
      for (let i = 0; i < dots.length; i += 1) {
        const projected = projectDot(dots[i], 0.35, center, center, sphereRadius, 0);
        const node = ellipses[i];
        if (!node) continue;
        node.setAttribute("cx", projected.cx.toFixed(2));
        node.setAttribute("cy", projected.cy.toFixed(2));
        node.setAttribute("rx", projected.rx.toFixed(2));
        node.setAttribute("ry", projected.ry.toFixed(2));
        node.setAttribute("opacity", projected.opacity.toFixed(3));
      }
      return;
    }

    const tick = (time: number) => {
      const t = time / 1000;
      stateRef.current.rotY = t * 0.55;
      stateRef.current.pulse = t * 2.4;

      for (let i = 0; i < dots.length; i += 1) {
        const projected = projectDot(
          dots[i],
          stateRef.current.rotY,
          center,
          center,
          sphereRadius,
          stateRef.current.pulse
        );
        const node = ellipses[i];
        if (!node) continue;
        node.setAttribute("cx", projected.cx.toFixed(2));
        node.setAttribute("cy", projected.cy.toFixed(2));
        node.setAttribute("rx", projected.rx.toFixed(2));
        node.setAttribute("ry", projected.ry.toFixed(2));
        node.setAttribute("opacity", projected.opacity.toFixed(3));
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [dots, center, sphereRadius]);

  const initial = dots.map((dot) =>
    projectDot(dot, 0, center, center, sphereRadius, 0)
  );

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div
        className="absolute inset-0 rounded-full blur-xl"
        style={{ background: glow, animation: "page-load-glow 2.4s ease-in-out infinite" }}
      />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewSize} ${viewSize}`}
        width={size}
        height={size}
        className="relative"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {initial.map((p, index) => (
          <ellipse
            key={index}
            data-dot
            cx={p.cx}
            cy={p.cy}
            rx={p.rx}
            ry={p.ry}
            fill={fill}
            opacity={p.opacity}
          />
        ))}
      </svg>
    </div>
  );
}
