/** Professional content is always part of the article, not a hidden control. */
export default function Advanced({ children }: { children: React.ReactNode }) {
  return <section className="v9-professional-detail">{children}</section>;
}
