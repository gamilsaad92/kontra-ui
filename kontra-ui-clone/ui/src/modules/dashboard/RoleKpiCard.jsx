import React from 'react';
import { useRole } from '../../lib/roles';
import Card from '../../components/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';

const roleInfo = {
  lender: {
    title: 'Draw Requests Pending',
    value: 5,
    chart: 'bar',
    link: '/draw-requests?status=pending'
  },
  developer: {
    title: 'Properties Analyzed',
    value: 8,
    chart: 'pie',
    link: '/projects?analyzed=1'
  },
  default: {
    title: 'Active Projects',
    value: 3,
    chart: 'bar',
    link: '/projects'
  }
};

export default function RoleKpiCard() {
  const role = useRole();
  const info = roleInfo[role] || roleInfo.default;
  const barData = [{ name: info.title, value: info.value }];
  const pieData = [
    { name: 'value', value: info.value },
    { name: 'rest', value: Math.max(0, 10 - info.value) }
  ];

  const chart = info.chart === 'pie' ? (
    <PieChart width={200} height={120} className="mx-auto">
      <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={40}>
        {pieData.map((_, idx) => (
          <Cell key={idx} fill={idx === 0 ? '#8884d8' : '#d1d5db'} />
        ))}
      </Pie>
      <Tooltip />
    </PieChart>
  ) : (
    <BarChart width={200} height={120} data={barData} className="mx-auto">
      <XAxis dataKey="name" hide />
      <YAxis allowDecimals={false} />
      <Tooltip />
      <Bar dataKey="value" fill="#8884d8" />
    </BarChart>
  );

  return (
    <Card title={info.title} footer={<span className="text-xl font-bold">{info.value}</span>} to={info.link}>
      {chart}
    </Card>
  );
}
