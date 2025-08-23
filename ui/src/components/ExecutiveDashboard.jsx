import React from 'react';
import { FileText, CheckCircle2, PiggyBank, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const sampleApplications = [
  { applicant: 'Olivia Rhye', status: 'In Review', amount: '$400k', date: 'Jan 7, 2024' },
  { applicant: 'Phoenix Baker', status: 'Approved', amount: '$250k', date: 'Jan 5, 2024' },
  { applicant: 'Isabella Nguyen', status: 'Pending', amount: '$120k', date: 'Jan 2, 2024' },
  { applicant: 'Liam Johnson', status: 'Rejected', amount: '$300k', date: 'Dec 28, 2023' }
];

const disbursementData = [
  { name: 'Jan', disbursed: 40, remaining: 100 },
  { name: 'Feb', disbursed: 80, remaining: 95 },
  { name: 'Mar', disbursed: 120, remaining: 90 },
  { name: 'Apr', disbursed: 160, remaining: 85 }
];

const exposureData = [
  { name: 'Loan A', value: 400 },
  { name: 'Loan B', value: 300 },
  { name: 'Loan C', value: 200 },
  { name: 'Loan D', value: 100 }
];

const defaultRateData = [
  { name: 'Jan', rate: 1.2 },
  { name: 'Feb', rate: 1.1 },
  { name: 'Mar', rate: 1.4 },
  { name: 'Apr', rate: 1.3 }
];

export default function ExecutiveDashboard() {
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <aside className="w-20 bg-white border-r flex flex-col items-center py-6 space-y-8">
        <div className="text-xl font-bold text-indigo-600">K</div>
        <nav className="flex flex-col items-center gap-6 text-xs font-medium">
          <div className="flex flex-col items-center text-gray-500">
            <FileText className="h-5 w-5" />
            <span className="mt-1">Loans</span>
          </div>
          <div className="flex flex-col items-center text-gray-500">
            <CheckCircle2 className="h-5 w-5" />
            <span className="mt-1 text-center">Underwriting</span>
          </div>
          <div className="flex flex-col items-center text-gray-500">
            <PiggyBank className="h-5 w-5" />
            <span className="mt-1">Escrow</span>
          </div>
          <div className="flex flex-col items-center text-gray-500">
            <BarChart3 className="h-5 w-5" />
            <span className="mt-1">Analytics</span>
          </div>
        </nav>
      </aside>
      <main className="flex-1 p-6 grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Loan Applications</CardTitle>
            <Button size="sm">Upload Application</Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Applicant</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2">Submitted On</th>
                </tr>
              </thead>
              <tbody>
                {sampleApplications.map((app, idx) => (
                  <tr key={idx} className="border-b last:border-none">
                    <td className="py-2 pr-4 font-medium">{app.applicant}</td>
                    <td className="py-2 pr-4"><span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs">{app.status}</span></td>
                    <td className="py-2 pr-4">{app.amount}</td>
                    <td className="py-2">{app.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Intelligent Underwriting</CardTitle>
            <Button size="sm">Upload PDF(s)</Button>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Loan Agreement</h4>
              <p className="text-3xl font-bold mb-4">$350,000</p>
              <p className="text-gray-600">Fixed 6.5% APR</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Recommendations</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>Increase down payment to 25%</li>
                <li>Verify bank statements</li>
                <li>Collect insurance proof</li>
              </ul>
              <h4 className="font-semibold mt-4 mb-2">Document Insights</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>W-2 income verified</li>
                <li>ID matches applicant</li>
                <li>No missing pages detected</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Escrow Management</CardTitle>
            <Button size="sm">Create Escrow</Button>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
            <div>
              <div className="mb-4">
                <div className="text-gray-500">Upcoming Disbursements</div>
                <div className="text-2xl font-semibold">$120,000</div>
              </div>
              <div className="mb-4">
                <div className="text-gray-500">Reserved Balance</div>
                <div className="text-2xl font-semibold">$450,000</div>
              </div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={disbursementData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="disbursed" fill="#3b82f6" />
                    <Bar dataKey="remaining" fill="#a78bfa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Borrower Reminders</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>Inspection due Apr 8</li>
                <li>Insurance proof needed</li>
                <li>Taxes payable May 1</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Advanced Analytics Dashboard</CardTitle>
            <Button size="sm">Upload Portfolio Summary</Button>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
            <div className="h-32">
              <h4 className="font-semibold mb-2">Exposure</h4>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exposureData}>
                  <XAxis dataKey="name" hide />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="h-32">
                <h4 className="font-semibold mb-2">Default Rate</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={defaultRateData}>
                    <XAxis dataKey="name" hide />
                    <YAxis domain={[0, 2]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <h4 className="font-semibold mt-4 mb-2">Risk Monitoring</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>DSCR &lt; 1.10x on 2 loans</li>
                <li>3 loans nearing maturity</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
