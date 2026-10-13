import Link from "next/link";
import type { ReactNode } from "react";

// Shared page shell with a title and an error banner.
export default function Page({
  title,
  error,
  children,
}: {
  title: string;
  error?: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <Link href="/" className="text-sm text-blue-600 underline">
        &larr; Home
      </Link>
      <h1 className="my-4 text-2xl font-bold">{title}</h1>
      {error ? (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
          {error}
        </p>
      ) : (
        children
      )}
    </main>
  );
}
