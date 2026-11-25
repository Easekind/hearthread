import { t } from "../i18n";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { HardDrive } from "lucide-react";
import type { Book } from "../model";
export default function StorageDetails({
  books,
  path,
}: {
  books: Book[];
  path: string;
}) {
  const data = ["EPUB", "PDF", "MD"].map((format) => ({
    format,
    count: books.filter((b) => b.type === format && !b.deleted).length,
  }));
  return (
    <>
      <p className="flex items-center gap-2 break-all">
        <HardDrive size={18} />
        {path}
      </p>
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={data}>
          <XAxis dataKey="format" />
          <YAxis allowDecimals={false} />
          <Bar
            dataKey="count"
            name={t("storage.bookCount")}
            fill="var(--brand-thread)"
          />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}
