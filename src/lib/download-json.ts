/**
 * Trigger a browser download of a JSON file. Used by the GDPR data-export
 * flow so admins can hand a data-subject request response back to the user
 * as a single file.
 *
 * Filename should NOT include the `.json` extension — it's appended here.
 */
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
