import { redirect } from 'next/navigation';

/**
 * Main app page - redirects to dashboard or landing page
 */

import Image from "next/image";

export default function HomePage() {
  redirect('/dashboard');
}
