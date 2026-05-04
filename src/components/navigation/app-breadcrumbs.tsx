"use client";

import type { MouseEvent } from "react";
import { Breadcrumb, BreadcrumbItem } from "@carbon/react";

type BreadcrumbEntry = {
  label: string;
  href?: string;
};

export function AppBreadcrumbs({
  items,
}: {
  items: BreadcrumbEntry[];
}) {
  return (
    <Breadcrumb noTrailingSlash size="sm" className="app-breadcrumbs" aria-label="Page breadcrumb">
      {items.map((item, index) => {
        const isCurrentPage = index === items.length - 1;

        const href = isCurrentPage ? undefined : item.href;

        function handleClick(event: MouseEvent<HTMLLIElement>) {
          if (!href) {
            return;
          }

          event.preventDefault();
          window.location.href = href;
        }

        return (
          <BreadcrumbItem
            key={`${item.label}-${index}`}
            href={href}
            isCurrentPage={isCurrentPage}
            onClick={handleClick}
          >
            {item.label}
          </BreadcrumbItem>
        );
      })}
    </Breadcrumb>
  );
}
