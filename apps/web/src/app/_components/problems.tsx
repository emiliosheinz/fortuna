import { AlertCircle, FolderX, Layers, Link2Off } from "lucide-react";

const problems = [
  {
    icon: AlertCircle,
    title: "Friction in tracking",
    description:
      "Existing tools ask too many questions before you can log a purchase. That costs accuracy and consistency.",
  },
  {
    icon: FolderX,
    title: "Lost spending history",
    description:
      "Transactions get buried in bank statements or messy spreadsheets, never to be analyzed again.",
  },
  {
    icon: Layers,
    title: "Rigid categorization",
    description:
      "Forced to fit spending into categories that don't match your actual habits.",
  },
  {
    icon: Link2Off,
    title: "Disconnected accounts",
    description:
      "Money stays siloed across banks and cards, so the full picture never surfaces when you need it.",
  },
];

export function Problems() {
  return (
    <section id="problem" className="scroll-mt-20 py-16 lg:py-24 px-5">
      <div className="container mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-10 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-balance">
            The problem with traditional finance apps
          </h2>
          <p className="text-lg text-muted-foreground text-pretty leading-relaxed">
            Most tools make tracking harder than it needs to be. By the time you
            figure out where to log something, the moment has passed.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {problems.map((problem) => (
            <div
              key={problem.title}
              className="group relative rounded-lg border border-border bg-card/30 p-6 hover:border-foreground/30 transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-accent/30 p-3 group-hover:bg-accent transition-colors">
                  <problem.icon className="h-6 w-6 text-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    {problem.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {problem.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
