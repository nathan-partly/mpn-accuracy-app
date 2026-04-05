export const metadata = {
  title: "VIN Coverage | Interpreter Metrics",
};

export default function CoveragePage() {
  return (
    <div
      style={{
        position: "fixed",
        top: 64, // height of navbar (h-16)
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <iframe
        src="/coverage-dashboard.html"
        style={{ width: "100%", height: "100%", border: "none" }}
        title="VIN Coverage Dashboard"
      />
    </div>
  );
}
