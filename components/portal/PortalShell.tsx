export default function PortalShell({
  children,
  measure = false,
}: {
  children: React.ReactNode;
  measure?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6 md:px-8 lg:px-10 lg:py-8">
      <div className={measure ? "w-full max-w-[1240px]" : "w-full"}>
        {children}
      </div>
    </div>
  );
}
