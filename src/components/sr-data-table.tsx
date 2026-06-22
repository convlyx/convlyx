import * as React from "react";

/**
 * Visually-hidden data table — the screen-reader alternative to a chart.
 * Render it next to the (aria-hidden) chart so non-visual users get the same
 * data in a navigable table. First cell of each row is treated as the row
 * header.
 */
export function SrDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: React.ReactNode[][];
}) {
  return (
    // The wrapper is positioned so the visually-hidden (position:absolute)
    // table is contained here rather than against the document — otherwise its
    // deep static position extends the page height and adds a second (window)
    // scrollbar on top of the scroll container. See the analytics page.
    <div className="relative">
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((col, i) => (
            <th key={i} scope="col">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) =>
              j === 0 ? (
                <th key={j} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={j}>{cell}</td>
              )
            )}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
