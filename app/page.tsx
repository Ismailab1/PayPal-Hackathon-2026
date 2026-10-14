import Link from "next/link";

const links = [
  { href: "/ask", label: "Ask about your invoices (AI assistant)" },
  { href: "/invoices", label: "Invoices (send a reminder)" },
  { href: "/audit", label: "Audit log" },
  { href: "/transactions", label: "Transactions" },
  { href: "/subscriptions", label: "Subscriptions (billing plans)" },
  { href: "/balances", label: "Balances" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-3xl font-bold">PayPal AI Dashboard</h1>
      <p className="my-4 text-gray-600">
        Browse your PayPal Sandbox data, or ask the AI assistant a question about your invoices.
      </p>
      <ul className="list-disc pl-6">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-blue-600 underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
