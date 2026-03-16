import React from "react";
import { Link } from "react-router-dom";

const cards = [
  { title: "Portfolio", value: "$42.6M", description: "Total managed assets" },
  { title: "Delinquency", value: "1.8%", description: "30+ day delinquent loans" },
  { title: "Open Tasks", value: "14", description: "Items requiring action today" },
];

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-64 border-r border-slate-200 bg-slate-950 p-4 text-slate-100">
          <h2 className="text-lg font-semibold">Kontra</h2>
          <nav className="mt-4 space-y-2 text-sm">
            <Link className="block rounded px-3 py-2 hover:bg-slate-800" to="/">
              Dashboard
            </Link>
            <Link className="block rounded px-3 py-2 hover:bg-slate-800" to="/login">
              Account
            </Link>
          </nav>
        </aside>

        <main className="flex-1 p-6">
          <h1 className="text-2xl font-semibold">Kontra</h1>
          <p className="mt-1 text-slate-600">Dashboard shell loaded.</p>

          <section className="mt-6 grid gap-4 md:grid-cols-3">
            {cards.map((card) => (
              <article key={card.title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm text-slate-500">{card.title}</h2>
                <p className="mt-2 text-2xl font-semibold">{card.value}</p>
                <p className="mt-1 text-sm text-slate-600">{card.description}</p>
              </article>
            ))}
          </section>

          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-medium">Data widgets</h2>
            <p className="mt-2 text-sm text-slate-600">
              API-backed modules now load after first paint. If data fails, show inline fallback here.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
