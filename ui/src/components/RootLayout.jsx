import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
export default function RootLayout({ children }) {
  return (
    <div className="flex h-screen">
      <Sidebar className="w-56 bg-surface shadow-lg" />
      <div className="flex-1 flex flex-col">
        <TopBar className="h-16 bg-surface shadow-sm px-6 flex items-center" />
        <main className="p-6 overflow-auto bg-bg-color">{children}</main>
      </div>
    </div>
  );
}
