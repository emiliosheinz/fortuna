import {
  BarChart3,
  Bell,
  CreditCard,
  PieChart,
  RefreshCw,
  Shield,
} from "lucide-react";

const features = [
  {
    icon: CreditCard,
    title: "Instant Tracking",
    description:
      "Log expenses instantly from anywhere. Manual entry, receipt scanning, or automatic bank sync — all in one place.",
  },
  {
    icon: PieChart,
    title: "Smart Budgeting",
    description:
      "Set budgets by category and track progress in real time. Visual breakdowns make it easy to see where your money goes.",
  },
  {
    icon: BarChart3,
    title: "Spending Insights",
    description:
      "Natural language search across all your transactions. Contextual insights and automatic categorization of spending patterns.",
  },
  {
    icon: RefreshCw,
    title: "Automatic Categorization",
    description:
      "Transactions are categorized automatically. Your spending history forms patterns that improve over time.",
  },
  {
    icon: Bell,
    title: "Smart Alerts",
    description:
      "Get notified before you overspend. Budget alerts, bill reminders, and unusual activity detection keep you on track.",
  },
  {
    icon: Shield,
    title: "Cross-Platform Sync",
    description:
      "Real-time sync across desktop, mobile, and web. Works offline and syncs when you're back online.",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-16 lg:py-24 px-5">
      <div className="container mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-10 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-balance">
            Built for clarity, designed for control
          </h2>
          <p className="text-lg text-muted-foreground text-pretty leading-relaxed">
            Fortuna removes friction from every step — from tracking to
            budgeting to insights.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-lg border border-border bg-card/30 p-6 hover:border-foreground/30 hover:shadow-lg transition-all duration-300"
            >
              <div className="mb-4 inline-flex rounded-lg bg-accent/30 p-3 group-hover:bg-accent transition-colors">
                <feature.icon className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
