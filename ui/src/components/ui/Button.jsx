export function Button({ variant = 'primary', children, ...props }) {
  const base = 'px-4 py-2 rounded-2xl font-medium';
  const styles = {
    primary: 'bg-brand hover:bg-red-800 text-white',
    secondary: 'border border-brand text-brand hover:bg-brand/10'
  };
  return (
    <button className={`${base} ${styles[variant]}`} {...props}>
      {children}
    </button>
  );
}
export default Button;
