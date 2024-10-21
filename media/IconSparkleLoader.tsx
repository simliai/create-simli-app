import React from "react";
import Image from "next/image";
import cn from "@/app/utils/TailwindMergeAndClsx";
import sparkle from "@/media/sparkle.svg";

interface Props {
  className?: string;
  isBlack?: boolean;
}

const IconSparkleLoader = ({ className, isBlack = false }: Props) => {
  return (
    <Image
      src={sparkle}
      alt="loader"
      className={cn(
        isBlack ? "filter invert" : "",
        className
      )}
    />
  );
};

export default IconSparkleLoader;
