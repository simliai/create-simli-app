import React from "react";

interface Props {
  className?: string;
}

const IconExit = ({ className }: Props) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="21"
      viewBox="0 0 20 21"
      fill="none"
      className={className}
    >
      <path
        d="M5 5.5L15 15.5M15 5.5L5 15.5"
        stroke="white"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};

export default IconExit;
