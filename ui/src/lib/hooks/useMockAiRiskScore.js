import { useEffect, useState } from 'react';

export default function useMockAiRiskScore(dependency) {
  const [score, setScore] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setScore(Math.random());
    }, 300);
    return () => clearTimeout(t);
  }, [dependency]);

  return score;
}
