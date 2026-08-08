import logoAsset from "@/assets/unboss-logo.png.asset.json";

export function Crest({ className = "h-16 w-16" }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Unboss Studio crest"
      className={`${className} rounded-full object-cover ring-1 ring-primary/40`}
    />
  );
}
