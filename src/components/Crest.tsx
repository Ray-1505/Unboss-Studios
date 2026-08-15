export function Crest({ className = "h-16 w-16" }: { className?: string }) {
  return (
    <img
      src="/favicon.png"
      alt="Unboss Studio crest"
      className={`${className} rounded-full object-cover ring-1 ring-primary/40`}
    />
  );
}
