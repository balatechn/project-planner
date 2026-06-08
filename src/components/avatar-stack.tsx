import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";

type Person = { id: string; name?: string | null; image?: string | null };

export function AvatarStack({
  people,
  max = 4,
  size = "h-7 w-7",
}: {
  people: Person[];
  max?: number;
  size?: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;

  return (
    <div className="flex -space-x-2">
      {shown.map((p) => (
        <Avatar
          key={p.id}
          className={`${size} border-2 border-card`}
          title={p.name ?? undefined}
        >
          {p.image && <AvatarImage src={p.image} alt={p.name ?? ""} />}
          <AvatarFallback className="text-[10px]">
            {initials(p.name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <div
          className={`${size} flex items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold`}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}
