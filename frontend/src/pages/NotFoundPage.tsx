/**
 * 404 page. Rendered inside the app shell for unknown authenticated routes.
 */
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section>
      <h1>Page not found</h1>
      <p>The page you were looking for doesn’t exist.</p>
      <Link to="/">Back to dashboard</Link>
    </section>
  );
}
