import { useEffect, useState } from 'react';

export default function useMockRiskScore(loanId) {
  const [score, setScore] = useState(null);

  useEffect(() => {
    if (!loanId) return;
    // generate a pseudo-random credit risk score
    const randomScore = Math.floor(300 + Math.random() * 550);
    setScore(randomScore);
  }, [loanId]);

  return score;
}
