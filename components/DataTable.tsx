import type { ReactNode } from "react";

export type Column<T> = { header: string; render: (row: T) => ReactNode };

// Simple reusable table: pass rows and a list of columns.
export default function DataTable<T>({
  rows,
  columns,
}: {
  rows: T[];
  columns: Column<T>[];
}) {
  if (rows.length === 0) {
    return <p className="text-gray-500">No data found.</p>;
  }
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b">
          {columns.map((c) => (
            <th key={c.header} className="p-2 font-semibold">
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b">
            {columns.map((c) => (
              <td key={c.header} className="p-2">
                {c.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
