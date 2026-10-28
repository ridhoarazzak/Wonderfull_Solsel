import data from "@/data/places.json";
import { Explorer } from "@/components/Explorer";
import type { Place } from "@/lib/places";

export default function Home() {
  return <Explorer places={data.places as Place[]} generated={data.generated} />;
}
