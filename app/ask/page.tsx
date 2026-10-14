import AskPanel from "@/components/AskPanel";
import Page from "@/components/Page";

export default function AskPage() {
  return (
    <Page title="Ask about your invoices">
      <p className="mb-4 text-sm text-gray-600">
        Ask in plain language. The assistant reads live invoices from the PayPal Sandbox. The figures in each chart and table are
        computed by the app from that live data. The short summary above them is written by the model. It can suggest
        reminders but cannot send them.
      </p>
      <AskPanel />
    </Page>
  );
}
