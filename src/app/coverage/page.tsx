export const metadata = {
  title: "VIN Coverage | Interpreter Metrics",
};

export default function CoveragePage() {
  return (
    // Fill exactly the viewport below the fixed navbar (h-16 = 64px).
    // Normal flow (not position:fixed) so scrollbar-gutter behaves the same
    // as Accuracy/Quality and the navbar never shifts position.
    <div style={{ height: "calc(100vh - 64px)", overflow: "hidden" }}>
      <iframe
        src="/coverage-dashboard.html"
        style={{ width: "100%", height: "100%", border: "none" }}
        title="VIN Coverage Dashboard"
      />
    </div>
  );
}
