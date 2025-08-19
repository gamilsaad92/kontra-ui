export function MiniLine({ points }:{ points:number[] }) {
  if (!points || points.length === 0) points = [0];
  const max = Math.max(...points), min = Math.min(...points);
  const norm = (v:number)=> (max===min?0.5: (v-min)/(max-min));
  const d = points.map((p,i)=>{
    const x = (i/(points.length-1||1))*100; const y = 100 - norm(p)*100;
    return `${i===0?"M":"L"} ${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 30" className="w-full h-16">
      <path d={d} fill="none" stroke="currentColor" strokeOpacity="0.9" strokeWidth="2"/>
    </svg>
  );
}
