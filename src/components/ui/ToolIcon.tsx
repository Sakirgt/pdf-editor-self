import React from "react";
import {
  FileText,
  FileCode,
  FileSpreadsheet,
  Presentation,
  Table,
  Image,
  FileEdit,
  Files,
  LucideProps,
} from "lucide-react";

interface ToolIconProps extends LucideProps {
  name: string;
}

export const ToolIcon: React.FC<ToolIconProps> = ({ name, ...props }) => {
  switch (name) {
    case "FileEdit":
      return <FileEdit {...props} />;
    case "FileText":
      return <FileText {...props} />;
    case "FileCode":
      return <FileCode {...props} />;
    case "FileSpreadsheet":
      return <FileSpreadsheet {...props} />;
    case "Presentation":
      return <Presentation {...props} />;
    case "Table":
      return <Table {...props} />;
    case "Image":
      return <Image {...props} />;
    default:
      return <Files {...props} />;
  }
};
