/**
 * Lists the tenant's categories.
 */
import type { Category } from '../../services/categoryService.js';

interface Props {
  categories: Category[];
}

export function CategoryTable({ categories }: Props) {
  if (categories.length === 0) return <p><small>No categories.</small></p>;
  return (
    <table style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }}>Name</th>
          <th style={{ textAlign: 'left' }}>Type</th>
        </tr>
      </thead>
      <tbody>
        {categories.map((c) => (
          <tr key={c.id} style={{ borderTop: '1px solid #eee' }}>
            <td>{c.name}</td>
            <td><small>{c.isSystem ? 'system' : 'custom'}</small></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
