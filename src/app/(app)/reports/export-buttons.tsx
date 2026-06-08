"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportButtons() {
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={() => window.open("/api/reports/export?format=xlsx", "_blank")}
      >
        <FileSpreadsheet className="h-4 w-4" /> Excel
      </Button>
      <Button
        variant="outline"
        onClick={() => window.open("/api/reports/export?format=pdf", "_blank")}
      >
        <FileText className="h-4 w-4" /> PDF
      </Button>
    </div>
  );
}
