import React from "react";

interface MiniSparkProps {
  points?: string;
}

export default function MiniSpark({
  points = "0,36 20,30 40,32 60,24 80,28 100,18 120,22 140,16 160,24 180,14 200,20",
}: MiniSparkProps) {
  return (
    <svg viewBox="0 0 200 60" className="w-full h-16 text-sky-500">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        points={points}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
