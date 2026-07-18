/**
 * File upload control (placeholder). Client-side type hint only; real
 * validation happens server-side by content, not extension (docs/security.md §4.4).
 */
interface FileUploadProps {
  accept: string;
  label: string;
}

export function FileUpload({ accept, label }: FileUploadProps) {
  return (
    <div className="file-upload">
      <label>
        {label}
        <input type="file" accept={accept} disabled />
      </label>
      <p><small>Upload handling arrives in Phase 6.</small></p>
    </div>
  );
}
