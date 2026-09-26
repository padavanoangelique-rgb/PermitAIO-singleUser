import { BrowserFrame } from "@/components/marketing/browser-frame";
import { FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";

const shots = [
  {
    src: "/screenshots/dashboard.png",
    alt: "PermitAIO dashboard with named techs and status tiles",
    caption: "Dashboard",
    pill: FILL_BLUE,
    width: 1797,
    height: 794,
  },
  {
    src: "/screenshots/inventory-board.png",
    alt: "Permit inventory job rows with circled job numbers",
    caption: "Permit inventory",
    pill: FILL_PURPLE,
    width: 1947,
    height: 732,
  },
  {
    src: "/screenshots/job-overview.png",
    alt: "Job overview with permit tools and assigned dates",
    caption: "Job overview",
    pill: FILL_GREEN,
    width: 1875,
    height: 957,
  },
  {
    src: "/screenshots/forms-generator.png",
    alt: "Permit builder with Forms, Floor Plans, and Package buttons",
    caption: "Permit builder",
    pill: FILL_PURPLE,
    width: 1855,
    height: 565,
  },
];

export function ProductShots() {
  return (
    <div className="space-y-10">
      {shots.map((s, i) => (
        <div key={s.src}>
          <span className={`mb-3 inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold shadow-sm ${s.pill}`}>
            {s.caption}
          </span>
          <BrowserFrame
            src={s.src}
            alt={s.alt}
            width={s.width}
            height={s.height}
            priority={i === 0}
          />
        </div>
      ))}
    </div>
  );
}