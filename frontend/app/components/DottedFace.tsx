import Image from "next/image";
import dottedFace from "@/media/dottedface.gif";

// 16:9 placeholder, the same size as the avatar's video, shown before the call starts.
export default function DottedFace() {
  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-sm bg-simligray">
      <Image src={dottedFace} alt="" width={300} height={300} unoptimized priority />
    </div>
  );
}
