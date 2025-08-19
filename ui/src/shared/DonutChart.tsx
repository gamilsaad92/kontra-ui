import React from "react";

export function DonutChart({ data }: { data: {label:string; value:number}[] }) {
  const total = data.reduce((s,d)=>s+d.value,0) || 1;
  let acc = 0;
  return (
    <svg viewBox="0 0 120 120" className="w-full max-w-xs">
      <g transform="translate(60,60)">
        {data.map((d, i) => {
          const a0 = (acc/total)*2*Math.PI; acc += d.value;
          const a1 = (acc/total)*2*Math.PI;
          const r = 50, ir = 32;
          const p0 = polar(r, a0), p1 = polar(r, a1);
          const large = a1-a0 > Math.PI ? 1 : 0;
          const path = [
            `M ${p0.x} ${p0.y}`,
            `A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`,
            `L ${p1.x*ir/r} ${p1.y*ir/r}`,
            `A ${ir} ${ir} 0 ${large} 0 ${p0.x*ir/r} ${p0.y*ir/r}`,
            "Z"
          ].join(" ");
          return <path key={i} d={path} className="fill-white/20 stroke-white/10"/>;
        })}
        <circle r="24" className="fill-transparent"/>
      </g>
    </svg>
  );
}
function polar(r:number,a:number){return {x:r*Math.cos(a), y:r*Math.sin(a)};}
