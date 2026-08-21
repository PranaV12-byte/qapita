export default function PortalShell({
  children,
  measure = false,
}: {
  children: React.ReactNode;
  measure?: boolean;
}) {
  return (
    <div className="v9-content">
      <div className={measure ? "w-full max-w-[1120px]" : "w-full"}>
        {children}
      </div>
    </div>
  );
}
