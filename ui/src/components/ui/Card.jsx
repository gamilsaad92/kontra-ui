export function Card({ children, className }) {
  return (
    <div className={`bg-surface rounded-2xl shadow-lg p-6 ${className}`}>
      {children}
    </div>
  );
}
export default Card;
