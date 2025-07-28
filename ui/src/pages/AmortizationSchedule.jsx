import React, { useEffect, useState } from 'react';

// Simple amortization schedule generator
function generateSchedule(principal, annualRate, months, startDate) {
  const r = annualRate / 100 / 12;
  const payment = (principal * r) / (1 - Math.pow(1 + r, -months));

  const schedule = [];
  let balance = principal;
  let date = new Date(startDate);

  for (let i = 0; i < months; i++) {
    const interest = balance * r;
    const principalPaid = payment - interest;
    balance = Math.max(0, balance - principalPaid);

    schedule.push({
      date: date.toISOString().slice(0, 10),
      payment,
      interest,
      balance
    });

    date.setMonth(date.getMonth() + 1);
  }

  return schedule;
}

export default function AmortizationSchedule() {
    const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    const start = new Date();
    const data = generateSchedule(10000, 5, 24, start);
    setSchedule(data);
  }, []);

  return (
    <div className="bg-white text-black p-4 rounded shadow">
      <h4 className="font-semibold mb-2">Amortization Schedule</h4>
      <div className="overflow-y-auto max-h-80">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1">Date</th>
              <th className="px-2 py-1">Payment</th>
              <th className="px-2 py-1">Interest</th>
              <th className="px-2 py-1">Balance</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((row, i) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-1">{row.date}</td>
                <td className="px-2 py-1">${row.payment.toFixed(2)}</td>
                <td className="px-2 py-1">${row.interest.toFixed(2)}</td>
                <td className="px-2 py-1">${row.balance.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
