/**
 * Category badge (placeholder).
 */
interface CategoryBadgeProps {
  name: string;
  color?: string;
}

export function CategoryBadge({ name, color }: CategoryBadgeProps) {
  return <span className="category-badge" style={{ borderColor: color }}>{name}</span>;
}
