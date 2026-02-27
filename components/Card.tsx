export default function Card({
  title,
  tag,
  children
}: {
  title?: string;
  tag?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      {title ? (
        <div className="card-header">
          <div className="section-title">{title}</div>
          {tag ? <span className="card-tag">{tag}</span> : null}
        </div>
      ) : null}
      <div className="card-body">{children}</div>
    </div>
  );
}
