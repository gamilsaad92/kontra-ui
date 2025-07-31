import { NavLink } from 'react-router-dom';
const items = [
  { to: '/', icon: '🏠' }, /* others… */
];
export function Sidebar({ className }) {
  return (
    <nav className={`${className} flex flex-col items-center py-4`}>
      {items.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className="p-3 rounded hover:bg-gray-100 flex items-center"
          activeClassName="bg-brand text-white"
        >
          <span className="text-2xl">{item.icon}</span>
        </NavLink>
      ))}
    </nav>
  );
}
