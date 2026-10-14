import type { Widget } from "@/lib/agent/widgets";

// Draws one widget. The numbers were computed on the server from live invoices.
export default function WidgetView({ widget }: { widget: Widget }) {
  return (
    <section className="rounded border border-gray-300 p-4">
      <h2 className="text-lg font-semibold">{widget.title}</h2>
      <p className="mb-3 text-xs text-gray-500">{widget.caption}</p>

      {widget.kind === "stat" && <p className="text-4xl font-bold">{widget.value}</p>}

      {widget.kind === "bar" &&
        (widget.bars.length === 0 ? (
          <p className="text-gray-500">No matching invoices.</p>
        ) : (
          <ul className="space-y-2">
            {widget.bars.map((bar) => {
              const max = Math.max(...widget.bars.map((b) => b.value), 1);
              const width = Math.max((bar.value / max) * 100, 2);
              return (
                <li key={bar.label}>
                  <div className="flex justify-between text-sm">
                    <span>{bar.label}</span>
                    <span className="font-medium">{bar.display}</span>
                  </div>
                  <div className="h-3 rounded bg-gray-200">
                    <div className="h-3 rounded bg-blue-700" style={{ width: `${width}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        ))}

      {widget.kind === "table" &&
        (widget.rows.length === 0 ? (
          <p className="text-gray-500">No matching invoices.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  {widget.columns.map((c) => (
                    <th key={c} className="p-2 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {widget.rows.map((row, i) => (
                  <tr key={i} className="border-b">
                    {row.map((cell, j) => (
                      <td key={j} className="p-2">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </section>
  );
}
