export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  // template.tsx remounts on every navigation (unlike layout.tsx)
  // — triggers the CSS entry animation on each page change
  return (
    <div className="animate-fade-in">
      {children}
    </div>
  );
}
