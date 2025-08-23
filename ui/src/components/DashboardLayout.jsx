/** Views — pixel match to reference layout */

function RiskScoreGauge({ score = 56, label = "Moderate" }) {
  // Build a 180° semi-donut using Recharts Pie
  const segments = [
    { name: "good", value: 35, color: "#10b981" },  // teal/emerald
    { name: "mid", value: 25, color: "#f59e0b" },  // amber
    { name: "high", value: 20, color: "#e2e8f0" }, // slate-200 (inactive)
    { name: "rest", value: 20, color: "#e2e8f0" },
  ];
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-800">Risk Score</CardTitle>
      </CardHeader>
      <CardContent className="h-56 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={segments}
              startAngle={180}
              endAngle={0}
              innerRadius={70}
              outerRadius={90}
              dataKey="value"
              paddingAngle={2}
            >
              {segments.map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Pie>
            <RTooltip />
          </PieChart>
        </ResponsiveContainer>
        {/* center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
          <div className="text-5xl font-semibold text-slate-900 leading-none">{score}</div>
          <div className="mt-1 text-sm text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function DelinquencyForecast({ data }) {
  // expects [{name:'Apr', value:14}, ...]
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-800">Delinquency Forecast</CardTitle>
      </CardHeader>
      <CardContent className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#64748b" }} axisLine={false} tickLine={false} />
            <RTooltip />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#60a5fa" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function RecentActivity() {
  const rows = [
    { icon: "doc", title: "Sign' doctuments", meta: "1 hour ago", right: "Robert Fox" },
    { icon: "check", title: "Approval request", meta: "2 hours ago", right: "Loan #2324" },
    { icon: "payment", title: "Payment received", meta: "3 hours ago", right: "Drawment" },
    { icon: "draw", title: "Draw request", meta: "1 day ago", right: "Opend" },
  ];
  const LeftIcon = ({ t }: { t: string }) => (
    <div className="h-6 w-6 rounded-full bg-slate-100 grid place-items-center">
      <span className="text-[10px] text-slate-600">
        {t === "doc" ? "📄" : t === "check" ? "✅" : t === "payment" ? "💵" : "🧾"}
      </span>
    </div>
  );
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-800">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-slate-200">
          {rows.map((r, i) => (
            <li key={i} className="py-3 flex items-center">
              <LeftIcon t={r.icon} />
              <div className="ml-3">
                <div className="text-slate-800">{r.title}</div>
                <div className="text-xs text-slate-500">{r.meta}</div>
              </div>
              <div className="ml-auto text-sm text-slate-500">{r.right}</div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function TroubledAssets() {
  const rows = [
    { addr: "456 Elm St.", level: "High", score: "" },
    { addr: "333 Cedar Ln.", level: "", score: "65" },
    { addr: "1201 Pine Cir.", level: "", score: "69" },
  ];
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-800">Troubled Assets</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left font-medium py-2">Risk level</th>
              <th className="text-left font-medium py-2">Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-200">
                <td className="py-2 text-slate-800">{r.addr}</td>
                <td className="py-2">
                  {r.level ? (
                    <span className="text-emerald-600 font-medium">{r.level}</span>
                  ) : (
                    <span className="text-slate-700">{r.score}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CampaignTable() {
  const rows = [
    { p: "459 Birch Rd.", c: "Miami", r: "$475,000" },
    { p: "29 Lakeview Dr.", c: "Dallas", r: "$675,000" },
    { p: "6722 Oak Ave.", c: "Chicago", r: "$510,000" },
  ];
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-800">Revived Sale Marketing Campaign</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="text-left font-medium py-2">Property</th>
              <th className="text-left font-medium py-2">City</th>
              <th className="text-left font-medium py-2">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-200">
                <td className="py-2 text-slate-800">{r.p}</td>
                <td className="py-2 text-slate-600">{r.c}</td>
                <td className="py-2 text-slate-800">{r.r}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function AssetList() {
  const rows = [
    { a: "459 Birch Rd.", v: "$475,000" },
    { a: "29 Lakeview Dr.", v: "623,000" },
    { a: "2702 Oak Ave.", v: "—" },
  ];
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-800">Troridcel Sale Assets</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between">
              <span className="text-slate-800">{r.a}</span>
              <span className="text-slate-600">{r.v}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function AssistantPanel() {
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-800">AI Assistant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="rounded-xl bg-slate-100 px-3 py-3 text-sm text-slate-600">
          How can I assist you today?
        </div>
        <div className="rounded-xl bg-slate-100 px-3 py-3 text-sm text-slate-600">
          {/* input placeholder bubbles */}
        </div>
        <div className="flex justify-end">
          <Button size="icon" variant="secondary" className="rounded-full">
            ➤
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LenderView() {
  // Sample forecast data shaped like the screenshot
  const forecast = useMemo(
    () => [
      { name: "Apr", value: 15 },
      { name: "May", value: 20 },
      { name: "Jun", value: 26 },
      { name: "Jul", value: 24 },
    ],
    []
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {/* Row 1: Risk gauge + Delinquency bars */}
      <div className="xl:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
        <RiskScoreGauge />
        <DelinquencyForecast data={forecast} />
      </div>

      {/* Row 2: three medium cards */}
      <div className="xl:col-span-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <RecentActivity />
        <TroubledAssets />
        <CampaignTable />
      </div>

      {/* Row 3: asset list (left) + assistant (right) */}
      <div className="xl:col-span-2">
        <AssetList />
      </div>
      <div>
        <AssistantPanel />
      </div>
    </div>
  );
}
