import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { IconDownload } from "@/components/icons";

export const metadata: Metadata = { title: "Laporan & Export" };

export default async function LaporanPage() {
  await requireUser(["ADMIN"]);
  const monthStart = new Date();
  monthStart.setDate(1);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Laporan &amp; Export</h1>
        <p className="text-sm text-muted">
          Unduh CSV (terbuka rapi di Excel) untuk laporan P2K3 / manajemen.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Export Temuan"
          subtitle="Semua kolom: status, PIC, target, tindakan, verifikasi"
        />
        <CardBody>
          <form
            action="/api/export/findings"
            method="get"
            className="space-y-3"
            target="_blank"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="dari">Dari tanggal</Label>
                <Input
                  id="dari"
                  name="dari"
                  type="date"
                  defaultValue={monthStart.toISOString().slice(0, 10)}
                />
              </div>
              <div>
                <Label htmlFor="sampai">Sampai</Label>
                <Input
                  id="sampai"
                  name="sampai"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
            </div>
            <Button type="submit">
              <IconDownload size={16} />
              Unduh CSV Temuan
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Export Audit 5S"
          subtitle="Skor total + rincian per pilar per audit"
        />
        <CardBody>
          <form action="/api/export/audits" method="get" target="_blank">
            <Button type="submit">
              <IconDownload size={16} />
              Unduh CSV Audit
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
