import SideRail from "./SideRail";

/**
 * Two-column portal layout for content pages.
 * Desktop (lg+): fixed 280px sticky left rail + content column.
 * Mobile/tablet: rail hidden, content full-width (top nav + drawer cover nav).
 * `measure` caps the content column for comfortable reading (articles: 680px).
 */
export default function PortalShell({
  children,
  measure = false,
}: {
  children: React.ReactNode;
  measure?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-6 lg:py-8">
      <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
        <aside className="hidden lg:block">
          <div className="sticky top-16 max-h-[calc(100vh-5rem)] overflow-y-auto pr-2">
            <SideRail />
          </div>
        </aside>
        <div className={measure ? "w-full max-w-[680px]" : "w-full"}>
          {children}
        </div>
      </div>
    </div>
  );
}
