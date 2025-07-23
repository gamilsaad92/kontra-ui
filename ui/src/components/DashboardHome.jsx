import { useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Menu, MenuItem } from "./ui/menu";
import { Dropdown } from "./ui/dropdown";
import { Sidebar } from "./ui/sidebar";
import { Avatar } from "./ui/avatar";
import { Search } from "./ui/search";

export default function Dashboard() {
  const [user] = useState({ name: "Admin" });

  return (
    <div className="flex min-h-screen bg-[#111827] text-white">
      {/* Sidebar */}
      <Sidebar className="w-64 bg-[#1F2937] text-white">
        <div className="text-2xl font-bold px-4 py-6">K Kontra</div>
        <nav className="flex flex-col space-y-2 px-4">
          <a href="#" className="text-sm text-white hover:text-blue-400">Dashboard</a>
          <a href="#" className="text-sm text-white hover:text-blue-400">Land Acquisition</a>
          <a href="#" className="text-sm text-white hover:text-blue-400">Market Analysis</a>
          <a href="#" className="text-sm text-white hover:text-blue-400">Settings</a>
        </nav>
      </Sidebar>

      {/* Main Content */}
      <main className="flex-1 p-10">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-4xl font-bold">Dashboard</h1>
          <div className="flex items-center space-x-4">
            <Search placeholder="Search..." className="w-64" />
            <Dropdown label={user.name}>
              <Menu>
                <MenuItem>Profile</MenuItem>
                <MenuItem>Logout</MenuItem>
              </Menu>
            </Dropdown>
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-2 gap-6">
          <Card className="bg-[#1F2937] text-white">
            <CardContent>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-[#3B82F6] flex items-center justify-center">
                  <span className="text-white text-xl">🔍</span>
                </div>
                <div>
                  <p className="text-sm text-gray-300">AI-Powered</p>
                  <p className="text-lg font-semibold">Property Search</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1F2937] text-white">
            <CardContent>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-[#3B82F6] flex items-center justify-center">
                  <span className="text-white text-xl">📍</span>
                </div>
                <div>
                  <p className="text-sm text-gray-300">Site Suitability</p>
                  <p className="text-lg font-semibold">Analysis</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1F2937] text-white">
            <CardContent>
              <p className="text-sm text-gray-400 mb-1">Recent Market Analysis</p>
              <p className="text-3xl font-bold mb-1">12 <span className="text-lg font-medium">Reports</span></p>
              <p className="text-sm text-gray-500">Generated this month</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1F2937] text-white">
            <CardContent>
              <p className="text-sm text-gray-400 mb-1">Pending Property Transactions</p>
              <p className="text-3xl font-bold mb-1">8 <span className="text-lg font-medium">Transactions</span></p>
              <p className="text-sm text-gray-500">Awaiting review</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
